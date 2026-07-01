import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { Polyline, Marker, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useDriveState } from '../providers/DriveStateProvider';
import { DRIVE_COLORS, DRIVE_WEIGHTS, DRIVE_OPACITY, DRIVE_PRESENTATION, darkenColor, getSelectedDriveColor, FAULT_RED } from '../../constants/drivePresentation';
import type { SolPDI, PDIImage, FaultRecord } from '../../types';
import { SolTooltip } from './SolTooltip';
import { ImageModal } from './ImageModal';
import type { SegmentMarker } from '../../state/store';
import { latLngToPixel, isValidLatLng } from './util/marsCoordinateUtils';
import type { RoverPathData } from './util/marsMapTypes';
import { usePlayhead } from '../providers/TimelinePlayheadProvider';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';
import { imageRepository } from '../../api/repositories/imageRepository';
import { useSolData } from '../../hooks/useSol';
// roverTopdown asset used in overlay (InteractiveMarsMap)

// Custom marker icons for segment selection with improved appearance
const createMarkerIcon = (color: string) => new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`
    <svg width="26" height="42" viewBox="0 0 26 42" xmlns="http://www.w3.org/2000/svg">
      <path fill="#000" d="M13,1 C19.627,1 25,6.373 25,13 C25,20.18 13,41 13,41 C13,41 1,20.18 1,13 C1,6.373 6.373,1 13,1 Z"/>
      <path fill="${color}" d="M13,2 C19.075,2 24,6.925 24,13 C24,19.589 13,39 13,39 C13,39 2,19.589 2,13 C2,6.925 6.925,2 13,2 Z"/>
      <circle fill="#fff" cx="13" cy="13" r="6"/>
      <circle fill="none" stroke="#333" stroke-width="0.5" cx="13" cy="13" r="6"/>
    </svg>
  `)))}`,
  iconSize: [26, 42],
  iconAnchor: [13, 42],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
  className: 'segment-marker'
});

const startMarkerIcon = createMarkerIcon('#000000'); // black
const endMarkerIcon = createMarkerIcon('#000000'); // black
const hoverMarkerIcon = createMarkerIcon('#6b7280'); // gray

// Global alert function for use in non-React components
declare global {
  interface Window {
    showSegmentAlert?: (message: string) => void;
  }
}

interface RoverPathRendererProps {
  roverPathData: RoverPathData | null;
  selectedDrives: string[];
  onDriveSelect: (driveId: string) => void;
  focusDrive?: string;
  searchResults?: Array<{ sol: number }>;
  isThumbnail?: boolean;
  enableSegmentSelection?: boolean;
  faults?: FaultRecord[];
  allowFocusedDriveInteraction?: boolean;
}

// Component to render rover path as polylines with clickable sol segments
export function RoverPathLayer({
  roverPathData,
  selectedDrives,
  onDriveSelect,
  focusDrive,
  searchResults = [],
  isThumbnail = false,
  enableSegmentSelection = false,
  faults = [],
  allowFocusedDriveInteraction = false
}: RoverPathRendererProps) {
  // Constant for fault circle offset and connecting line length
  const FAULT_OFFSET_DISTANCE = 50;
  const map = useMap();
  const [hoveredSol, setHoveredSol] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFault, setHoveredFault] = useState<FaultRecord | null>(null);
  const [hoverMarkerPosition, setHoverMarkerPosition] = useState<[number, number] | null>(null);
  const [hoveredSolEnd, setHoveredSolEnd] = useState<{ sol: number; distance: number; points: number; sclk?: number; endSclk?: number; position: { x: number; y: number } } | null>(null);
  const [solEndTooltipPosition, setSolEndTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [solPDIData, setSolPDIData] = useState<{ [sol: number]: SolPDI }>({});
  const [loadingPDI, setLoadingPDI] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [imageModalState, setImageModalState] = useState<{
    isOpen: boolean;
    sol: number;
    camera: string;
    images: { left?: PDIImage; right?: PDIImage };
  } | null>(null);

  const driveState = useDriveState();
  const { setDrivePosition, drivePositions } = usePlayhead();

  // Use throttled callback for drive position updates
  const scheduleSetDrivePosition = useThrottledCallback(
    (driveId: string, normalized: number) => setDrivePosition(driveId, normalized),
    { getValue: (_driveId: string, normalized: number) => normalized, epsilon: 0.0005 }
  );

  // Get sol data for the focused drive to calculate normalized position
  const { data: solData } = useSolData(focusDrive ? parseInt(focusDrive) : 0, !!focusDrive);



  // Function to fetch PDI data for a sol
  const queryClient = useQueryClient();
  const fetchSolPDI = useCallback(async (sol: number) => {
    if (solPDIData[sol] || loadingPDI.has(sol)) return;

    setLoadingPDI(prev => new Set(prev).add(sol));
    try {
      const pdi = await queryClient.fetchQuery({
        queryKey: ['pdi', sol],
        queryFn: () => imageRepository.getPDIForSol(sol),
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
      });
      if (pdi) {
        setSolPDIData(prev => ({ ...prev, [sol]: pdi }));
      }
    } catch (error) {
      console.error(`Failed to fetch PDI data for sol ${sol}:`, error);
    } finally {
      setLoadingPDI(prev => {
        const newSet = new Set(prev);
        newSet.delete(sol);
        return newSet;
      });
    }
  }, [solPDIData, loadingPDI, queryClient]);

  // Handle image modal opening
  const handleImageExpand = useCallback((sol: number, image: { filename?: string; sclk?: number; source: 'pdi' | 'vce' }) => {
    // Normalize to a single image payload for modal
    const filename = image.filename || '';
    setImageModalState({
      isOpen: true,
      sol,
      camera: '',
      images: { left: filename ? ({ filename } as PDIImage) : undefined }
    });
  }, []);

  // Handle image modal closing
  const handleImageModalClose = useCallback(() => {
    setImageModalState(null);
  }, []);



  // Convert rover path points to Leaflet coordinates (only if data exists)
  const pathPositions: L.LatLngTuple[] = roverPathData?.points?.map(point => {
    const [pixelX, pixelY] = latLngToPixel(point.latitude, point.longitude);
    return [-pixelY, pixelX] as L.LatLngTuple;
  }) || [];

  // Precompute SCLK bounds and index ranges per sol for efficient playhead calculation
  const solSclkBounds = useMemo(() => {
    const bounds: Record<string, { min: number; max: number; startIndex: number; endIndex: number; ascending: boolean }> = {};
    if (!roverPathData?.points || roverPathData.points.length === 0) {
      return bounds;
    }
    let currentSol = roverPathData.points[0].sol;
    let startIndex = 0;
    for (let i = 1; i <= roverPathData.points.length; i++) {
      const isBoundary = i === roverPathData.points.length || roverPathData.points[i].sol !== currentSol;
      if (isBoundary) {
        // Compute min/max sclk within [startIndex, i-1]
        let min = Infinity;
        let max = -Infinity;
        let firstSclk: number | null = null;
        let lastSclk: number | null = null;
        for (let j = startIndex; j < i; j++) {
          const s = roverPathData.points[j].sclk;
          if (s !== null) {
            if (firstSclk === null) firstSclk = s;
            lastSclk = s;
            min = Math.min(min, s);
            max = Math.max(max, s);
          }
        }
        if (min !== Infinity && max !== -Infinity && firstSclk !== null && lastSclk !== null) {
          bounds[currentSol.toString()] = {
            min,
            max,
            startIndex,
            endIndex: i - 1,
            ascending: lastSclk >= firstSclk,
          };
        }
        if (i < roverPathData.points.length) {
          currentSol = roverPathData.points[i].sol;
          startIndex = i;
        }
      }
    }
    return bounds;
  }, [roverPathData]);

  // Helper function to find the closest point on the path to a given position
  // Optionally restrict search to a range of point indices [startIndex, endIndex]
  const findClosestPathPoint = useCallback((mousePos: [number, number], range?: { startIndex: number; endIndex: number }) => {
    if (!roverPathData?.points || pathPositions.length === 0) {
      return null;
    }

    const startIdx = Math.max(0, range ? range.startIndex : 0);
    const endIdx = Math.min(pathPositions.length - 2, range ? range.endIndex - 1 : pathPositions.length - 2);
    if (endIdx < startIdx) return null;

    let closestDistance = Infinity;
    let closestPointIndex = startIdx;
    let closestPositionOnSegment: [number, number] = mousePos;
    let closestT = 0;

    for (let i = startIdx; i <= endIdx; i++) {
      const start = pathPositions[i] as [number, number];
      const end = pathPositions[i + 1] as [number, number];

      // Project to segment and compute distance
      const proj = projectPointOnSegment(mousePos, start, end);
      const distance = getDistance(mousePos, proj.point);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPointIndex = i;
        closestPositionOnSegment = proj.point;
        closestT = proj.t;
      }
    }

    return {
      index: closestPointIndex,
      t: closestT,
      position: closestPositionOnSegment,
      distance: closestDistance,
      pathData: roverPathData.points[closestPointIndex]
    };
  }, [pathPositions, roverPathData]);

  // Helper function: project point to a line segment, returning interpolation parameter and point
  const projectPointOnSegment = (
    point: [number, number],
    start: [number, number],
    end: [number, number]
  ): { t: number; point: [number, number] } => {
    const [px, py] = point;
    const [sx, sy] = start;
    const [ex, ey] = end;

    const dx = ex - sx;
    const dy = ey - sy;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { t: 0, point: start };
    const tRaw = ((px - sx) * dx + (py - sy) * dy) / len2;
    const t = Math.max(0, Math.min(1, tRaw));
    return { t, point: [sx + t * dx, sy + t * dy] };
  };

  // Helper function to calculate distance between two points
  const getDistance = (p1: [number, number], p2: [number, number]): number => {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  };

  // Find sol start points (first colored position of each sol). Each node maps
  // to the sol that BEGINS at that node, so hovering shows the tooltip for the
  // drive about to start.
  //
  // The visual position is the boundary joint between the previous sol's last
  // point and the next sol's first data point — that's where the next sol's
  // colored polyline visually begins (boundary segment is attributed to the
  // NEXT sol in solPaths above). The `index` field still points at the next
  // sol's first DATA point so the tooltip's start_sclk lookup gets the right
  // value even though the position is at the previous point's location.
  let solStartPoints: Array<{ position: [number, number], sol: number, index: number }> = [];
  if (roverPathData?.points && roverPathData.points.length > 0) {
    // First point of the dataset: visual position and data start coincide.
    const firstPoint = roverPathData.points[0];
    const [firstPixelX, firstPixelY] = latLngToPixel(firstPoint.latitude, firstPoint.longitude);
    solStartPoints.push({
      position: [-firstPixelY, firstPixelX],
      sol: firstPoint.sol,
      index: 0
    });

    // At each sol-boundary, place the node at the joint (point[i]) but record
    // index i+1 so SCLK metadata reflects the new sol's first data point.
    for (let i = 0; i < roverPathData.points.length - 1; i++) {
      const currentSol = roverPathData.points[i].sol;
      const nextSol = roverPathData.points[i + 1].sol;

      if (currentSol !== nextSol) {
        const jointPoint = roverPathData.points[i];
        const [pixelX, pixelY] = latLngToPixel(jointPoint.latitude, jointPoint.longitude);
        solStartPoints.push({
          position: [-pixelY, pixelX],
          sol: nextSol,
          index: i + 1
        });
      }
    }
  }



  // Playhead is rendered as an overlay in InteractiveMarsMap

  // Compute filled path segments up to the playhead position for the focused drive
  const filledPathSegments = useMemo(() => {
    if (!roverPathData || !focusDrive) return [] as Array<[L.LatLngTuple, L.LatLngTuple]>;
    const norm = drivePositions[focusDrive];
    if (norm === null || norm === undefined) return [] as Array<[L.LatLngTuple, L.LatLngTuple]>;
    const bounds = solSclkBounds[focusDrive];
    if (!bounds) return [] as Array<[L.LatLngTuple, L.LatLngTuple]>;

    const { min, max, startIndex, endIndex, ascending } = bounds;
    const range = max - min;
    if (!isFinite(range) || range === 0) return [] as Array<[L.LatLngTuple, L.LatLngTuple]>;
    const target = min + norm * range;

    const segments: Array<[L.LatLngTuple, L.LatLngTuple]> = [];

    // Add fully completed segments
    for (let i = startIndex; i < endIndex; i++) {
      const s0 = roverPathData.points[i].sclk;
      const s1 = roverPathData.points[i + 1].sclk;
      if (s0 === null || s1 === null) continue;

      const segMin = Math.min(s0, s1);
      const segMax = Math.max(s0, s1);

      const isCompleted = ascending
        ? segMax <= target
        : segMin >= target;

      if (isCompleted) {
        segments.push([pathPositions[i], pathPositions[i + 1]]);
      }
    }

    // Add partial segment at the playhead position
    for (let i = startIndex; i < endIndex; i++) {
      const s0 = roverPathData.points[i].sclk;
      const s1 = roverPathData.points[i + 1].sclk;
      if (s0 === null || s1 === null) continue;

      const segMin = Math.min(s0, s1);
      const segMax = Math.max(s0, s1);
      if (target < segMin || target > segMax) continue;

      const denom = (s1 - s0);
      const t = denom === 0 ? 0 : (target - s0) / denom;
      const start = pathPositions[i] as [number, number];
      const end = pathPositions[i + 1] as [number, number];
      const interp: [number, number] = [
        start[0] + t * (end[0] - start[0]),
        start[1] + t * (end[1] - start[1])
      ];

      if (ascending) {
        segments.push([start, interp as L.LatLngTuple]);
      } else {
        segments.push([interp as L.LatLngTuple, end]);
      }
      break; // only one partial segment
    }

    return segments;
  }, [roverPathData, focusDrive, drivePositions, solSclkBounds, pathPositions]);

  // Handle mouse events for drag interaction (placed after all dependencies are defined)
  const handleMouseDown = useCallback((e: L.LeafletMouseEvent, solString: string, isFocused: boolean) => {
    if (!isFocused) return;

    setIsDragging(true);
    dragStartRef.current = { x: e.originalEvent.clientX, y: e.originalEvent.clientY };

    // Update playhead immediately on click
    const bounds = solSclkBounds[solString];
    if (bounds) {
      const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
      const closest = findClosestPathPoint(mousePos, { startIndex: bounds.startIndex, endIndex: bounds.endIndex });
      if (closest) {
        const p0 = roverPathData?.points[closest.index];
        const p1 = roverPathData?.points[closest.index + 1];
        if (p0 && p1 && p0.sclk !== null && p1.sclk !== null) {
          const sInterp = p0.sclk + closest.t * (p1.sclk - p0.sclk);
          const { min, max } = bounds;
          const range = max - min;
          if (isFinite(range) && range !== 0) {
            const normalized = Math.max(0, Math.min(1, (sInterp - min) / range));
            scheduleSetDrivePosition(solString, normalized);
          }
        }
      }
    }
  }, [solSclkBounds, findClosestPathPoint, roverPathData, scheduleSetDrivePosition]);

  const handleMouseMove = useCallback((e: L.LeafletMouseEvent, solString: string, isFocused: boolean) => {
    if (!isDragging || !isFocused) return;

    // Update playhead during drag
    const bounds = solSclkBounds[solString];
    if (bounds) {
      const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
      const closest = findClosestPathPoint(mousePos, { startIndex: bounds.startIndex, endIndex: bounds.endIndex });
      if (closest) {
        const p0 = roverPathData?.points[closest.index];
        const p1 = roverPathData?.points[closest.index + 1];
        if (p0 && p1 && p0.sclk !== null && p1.sclk !== null) {
          const sInterp = p0.sclk + closest.t * (p1.sclk - p0.sclk);
          const { min, max } = bounds;
          const range = max - min;
          if (isFinite(range) && range !== 0) {
            const normalized = Math.max(0, Math.min(1, (sInterp - min) / range));
            scheduleSetDrivePosition(solString, normalized);
          }
        }
      }
    }
  }, [isDragging, solSclkBounds, findClosestPathPoint, roverPathData, scheduleSetDrivePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Add global mouse event listeners for drag
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleMouseUp();
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  // Pre-compute per-sol drive paths: group consecutive points by sol into single polylines
  // to avoid overlap artifacts at joints when using opacity < 1.
  // Group SEGMENTS (not points) by attributed sol. Each segment k is between
  // points k and k+1; a boundary segment (sol[k] !== sol[k+1]) is attributed
  // to the next sol. Adjacent sol polylines share their joint endpoint, so
  // sol B's polyline visually starts at point[k] of the boundary — which is
  // where the start-node for sol B is also placed (see solStartPoints below).
  const solPaths = useMemo(() => {
    if (!roverPathData || !roverPathData.points || pathPositions.length < 2) return [];
    const points = roverPathData.points;
    const segmentCount = points.length - 1;
    const segmentSols: number[] = new Array(segmentCount);
    for (let k = 0; k < segmentCount; k++) {
      const a = points[k].sol;
      const b = points[k + 1].sol;
      segmentSols[k] = a === b ? a : b;
    }
    const paths: Array<{ sol: number; solString: string; positions: L.LatLngExpression[] }> = [];
    let i = 0;
    while (i < segmentCount) {
      const sol = segmentSols[i];
      let j = i;
      while (j < segmentCount && segmentSols[j] === sol) j++;
      paths.push({
        sol,
        solString: sol.toString(),
        positions: pathPositions.slice(i, j + 1),
      });
      i = j;
    }
    return paths;
  }, [pathPositions, roverPathData?.points]);

  // Compute style for a given sol
  const getSolStyle = useCallback((solString: string, sol: number) => {
    const isSelected = selectedDrives.includes(solString);
    const isFocused = !!focusDrive && solString === focusDrive;
    const isHovered = hoveredSol === solString;
    const isInSearchResults = searchResults.some(result => result.sol === sol);
    const isGloballyHovered = driveState.isHovered(solString);

    let baseColor: string = DRIVE_COLORS.DEFAULT;
    let weight: number = DRIVE_WEIGHTS.DEFAULT;
    let opacity: number = DRIVE_OPACITY.DEFAULT;

    if (isThumbnail || focusDrive) {
      if (isFocused) {
        baseColor = DRIVE_PRESENTATION.COLORS.FOCUSED_WHITE;
        weight = isThumbnail ? DRIVE_PRESENTATION.WEIGHTS.THUMBNAIL_PRIMARY : DRIVE_PRESENTATION.WEIGHTS.PRIMARY;
        // When the user can scrub the playhead on the focused drive (DriveMapView),
        // render the underlying path at 50% opacity so the remaining-portion reads
        // as faded white. The fully-opaque white "filled" overlay (rendered below)
        // then represents the completed portion start→playhead.
        opacity = (!isThumbnail && allowFocusedDriveInteraction)
          ? 0.5
          : DRIVE_PRESENTATION.OPACITY.OPAQUE;
      } else {
        baseColor = DRIVE_PRESENTATION.COLORS.DEFAULT;
        weight = isThumbnail ? DRIVE_PRESENTATION.WEIGHTS.THUMBNAIL_OTHER : DRIVE_PRESENTATION.WEIGHTS.OTHER;
        opacity = isThumbnail ? DRIVE_PRESENTATION.OPACITY.THUMBNAIL_NON_FOCUSED : DRIVE_PRESENTATION.OPACITY.NON_FOCUSED;
      }
    } else {
      if (isSelected) {
        baseColor = getSelectedDriveColor(solString, selectedDrives) ?? DRIVE_PRESENTATION.COLORS.FOCUSED_WHITE;
        opacity = DRIVE_PRESENTATION.OPACITY.OPAQUE;
      } else if (isInSearchResults) {
        baseColor = DRIVE_PRESENTATION.COLORS.DEFAULT;
        opacity = DRIVE_PRESENTATION.OPACITY.OPAQUE;
      } else {
        baseColor = DRIVE_PRESENTATION.COLORS.DEFAULT;
        opacity = 0.5;
      }
      weight = DRIVE_PRESENTATION.WEIGHTS.PRIMARY;
    }

    let color = baseColor;
    const shouldDarkenOnMapHover = !isThumbnail && isHovered && !isFocused;
    const shouldDarkenOnGlobalHover = !isThumbnail && isGloballyHovered && !isFocused;
    if (shouldDarkenOnMapHover || shouldDarkenOnGlobalHover) {
      color = darkenColor(baseColor, 0.3);
    }

    // Stroke underlay is reserved for "prominent" drives so the rest of the
    // map reads as a sea of background paths without each one carrying its
    // own dark outline. Selected, focused, and in-search-results drives keep
    // the stroke.
    const showStroke = isSelected || isFocused || isInSearchResults;

    return { color, weight, opacity, isFocused, showStroke };
  }, [selectedDrives, focusDrive, hoveredSol, searchResults, driveState, isThumbnail, allowFocusedDriveInteraction]);

  // If we don't have data or enough positions, render nothing (after all hooks)
  if (!roverPathData || !roverPathData.points || pathPositions.length < 2) {
    return null;
  }

  // Width (px on each side) of the dark stroke drawn underneath colored paths
  // so each line reads as a colored band against the Martian terrain.
  const PATH_STROKE_WIDTH_PX = 1;
  const PATH_STROKE_COLOR = '#303030';

  return (
    <>
      {/* Per-sol stroke underlay — sits beneath the colored line so each visible
          polyline reads as a colored band with a thin dark outline. Only drawn
          for drives that are selected, focused, or in search results. */}
      {solPaths.map(({ sol, solString, positions }) => {
        const { weight, opacity, showStroke } = getSolStyle(solString, sol);
        if (!showStroke) return null;
        return (
          <Polyline
            key={`sol-stroke-${sol}-${roverPathData.detail_level}-${roverPathData.total_points}`}
            positions={positions}
            pathOptions={{
              color: PATH_STROKE_COLOR,
              weight: weight + PATH_STROKE_WIDTH_PX * 2,
              opacity,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        );
      })}
      {/* Visible per-sol polylines — single path per drive to avoid overlap artifacts */}
      {solPaths.map(({ sol, solString, positions }) => {
        const { color, weight, opacity } = getSolStyle(solString, sol);
        return (
          <Polyline
            key={`sol-path-${sol}-${roverPathData.detail_level}-${roverPathData.total_points}`}
            positions={positions}
            pathOptions={{
              color,
              weight,
              opacity,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        );
      })}

      {/* Per-segment invisible hit-test polylines for hover/click detection */}
      {pathPositions.map((startPos, i) => {
        if (i === pathPositions.length - 1) return null;

        const endPos = pathPositions[i + 1];
        const currentSol = roverPathData.points[i].sol;
        const nextSolVal = roverPathData.points[i + 1]?.sol;
        const sol = nextSolVal !== undefined && nextSolVal !== currentSol ? nextSolVal : currentSol;
        const solString = sol.toString();
        const isFocused = !!focusDrive && solString === focusDrive;

        if (isThumbnail) return null;

        return (
          <Polyline
            key={`hit-${i}-${roverPathData.detail_level}-${roverPathData.total_points}`}
            positions={[startPos, endPos]}
            pathOptions={{
              color: 'transparent',
              weight: 40,
              opacity: 0,
              className: isFocused ? 'focused-drive-path' : undefined,
            }}
            eventHandlers={{
              mouseover: () => {
                if (focusDrive && !allowFocusedDriveInteraction) return;
                if (!isFocused) {
                  setHoveredSol(solString);
                }
              },
              mousemove: (e) => {
                if (focusDrive && !allowFocusedDriveInteraction) return;

                if (!isFocused || !isDragging) {
                  if (!isFocused) {
                    setTooltipPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY - 5 });
                  }
                }

                if (enableSegmentSelection && driveState.segmentSelectionMode !== 'none') {
                  const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
                  const closest = findClosestPathPoint(mousePos);
                  if (closest) {
                    setHoverMarkerPosition(closest.position);
                  }
                }

                handleMouseMove(e, solString, isFocused);
              },
              mouseout: () => {
                if (hoveredSol === solString) {
                  setHoveredSol(null);
                  setTooltipPosition(null);
                }
                if (!enableSegmentSelection || driveState.segmentSelectionMode === 'none') {
                  setHoverMarkerPosition(null);
                }
              },
              mousedown: (e) => {
                handleMouseDown(e, solString, isFocused);
              },
              mouseup: () => {
                handleMouseUp();
              },
              click: (e) => {
                if (enableSegmentSelection && driveState.segmentSelectionMode !== 'none') {
                  const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
                  const closest = findClosestPathPoint(mousePos);
                  if (!closest) return;
                  if (closest.pathData.sclk === null) return;
                  if (closest.pathData.sol < 1041 || closest.pathData.sol > 1055) {
                    if (window.showSegmentAlert) {
                      window.showSegmentAlert('Please select a point from Sol 1041-1055 for segment similarity search.');
                    } else {
                      alert('Please select a point from Sol 1041-1055 for segment similarity search.');
                    }
                    return;
                  }

                  const marker: SegmentMarker = {
                    position: closest.position,
                    sclk: closest.pathData.sclk,
                    distanceKm: closest.index * 0.1
                  };

                  if (driveState.segmentSelectionMode === 'start') {
                    driveState.setSegmentStartMarker(marker);
                    if (!driveState.segmentEndMarker) {
                      driveState.setSegmentSelectionMode('end');
                    } else {
                      driveState.setSegmentSelectionMode('none');
                    }
                  } else if (driveState.segmentSelectionMode === 'end') {
                    driveState.setSegmentEndMarker(marker);
                    if (!driveState.segmentStartMarker) {
                      driveState.setSegmentSelectionMode('start');
                    } else {
                      driveState.setSegmentSelectionMode('none');
                    }
                  }
                  setHoverMarkerPosition(null);
                } else if (!focusDrive && (!isFocused || allowFocusedDriveInteraction)) {
                  onDriveSelect(sol.toString());
                } else if (isFocused && allowFocusedDriveInteraction) {
                  const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
                  const bounds = solSclkBounds[solString];
                  if (bounds) {
                    const closest = findClosestPathPoint(mousePos, { startIndex: bounds.startIndex, endIndex: bounds.endIndex });
                    if (closest) {
                      const p0 = roverPathData?.points[closest.index];
                      const p1 = roverPathData?.points[closest.index + 1];
                      if (p0 && p1 && p0.sclk !== null && p1.sclk !== null) {
                        const sInterp = p0.sclk + closest.t * (p1.sclk - p0.sclk);
                        const { min, max } = bounds;
                        const range = max - min;
                        if (isFinite(range) && range !== 0) {
                          const normalized = Math.max(0, Math.min(1, (sInterp - min) / range));
                          setDrivePosition(solString, normalized);
                        }
                      }
                    }
                  }
                }
              }
            }}
          />
        );
      })}

      {/* Filled path up to playhead for focused drive (disabled in thumbnails and when drive is focused in FullMapView, but enabled in DriveMapView) */}
      {!isThumbnail && (!focusDrive || allowFocusedDriveInteraction) && filledPathSegments.length > 0 && filledPathSegments.map((seg, idx) => (
        <Polyline
          key={`filled-${idx}-${roverPathData.detail_level}-${roverPathData.total_points}`}
          positions={seg}
          pathOptions={{
            // White fill for the completed portion (start → current playhead). Pairs with
            // the underlying focused-drive polyline which is rendered at 50% opacity to
            // represent the remaining (un-driven) portion.
            color: '#ffffff',
            weight: isThumbnail ? DRIVE_PRESENTATION.WEIGHTS.THUMBNAIL_PRIMARY : DRIVE_PRESENTATION.WEIGHTS.PRIMARY,
            opacity: 1,
            className: 'filled-path-segment',
          }}
          eventHandlers={{
            mousedown: (e) => {
              // Handle drag start for playhead updates on filled segments
              if (focusDrive && allowFocusedDriveInteraction) {
                handleMouseDown(e, focusDrive, true);
              }
            },
            mousemove: (e) => {
              // Handle drag movement for playhead updates on filled segments
              if (focusDrive && allowFocusedDriveInteraction) {
                handleMouseMove(e, focusDrive, true);
              }
            },
            mouseup: () => {
              // Handle drag end
              handleMouseUp();
            },
            click: (e) => {
              // Handle playhead positioning for focused drives on filled segments
              if (focusDrive && allowFocusedDriveInteraction) {
                const mousePos: [number, number] = [e.latlng.lat, e.latlng.lng];
                const bounds = solSclkBounds[focusDrive];
                if (bounds) {
                  const closest = findClosestPathPoint(mousePos, { startIndex: bounds.startIndex, endIndex: bounds.endIndex });
                  if (closest) {
                    const p0 = roverPathData?.points[closest.index];
                    const p1 = roverPathData?.points[closest.index + 1];
                    if (p0 && p1 && p0.sclk !== null && p1.sclk !== null) {
                      const sInterp = p0.sclk + closest.t * (p1.sclk - p0.sclk);
                      const { min, max } = bounds;
                      const range = max - min;
                      if (isFinite(range) && range !== 0) {
                        const normalized = Math.max(0, Math.min(1, (sInterp - min) / range));
                        setDrivePosition(focusDrive, normalized);
                      }
                    }
                  }
                }
              }
            }
          }}
        />
      ))}

      {/* Segment highlighting */}
      {enableSegmentSelection && driveState.segmentStartMarker && driveState.segmentEndMarker && (
        <>
          {(() => {
            const startSclk = driveState.segmentStartMarker.sclk;
            const endSclk = driveState.segmentEndMarker.sclk;
            const minSclk = Math.min(startSclk, endSclk);
            const maxSclk = Math.max(startSclk, endSclk);

            const highlightSegments = [];
            for (let i = 0; i < pathPositions.length - 1; i++) {
              const pointSclk = roverPathData.points[i].sclk;
              if (pointSclk !== null && pointSclk >= minSclk && pointSclk <= maxSclk) {
                const startPos = pathPositions[i];
                const endPos = pathPositions[i + 1];
                highlightSegments.push(
                  <Polyline
                    key={`highlight-${i}`}
                    positions={[startPos, endPos]}
                    pathOptions={{
                      color: '#f97316',
                      weight: 6,
                      opacity: 0.8,
                    }}
                  />
                );
              }
            }
            return highlightSegments;
          })()}
        </>
      )}

      {/* Segment markers */}
      {enableSegmentSelection && (
        <>
          {driveState.segmentStartMarker && isValidLatLng(driveState.segmentStartMarker.position) && (
            <Marker
              position={driveState.segmentStartMarker.position}
              icon={startMarkerIcon}
            />
          )}
          {driveState.segmentEndMarker && isValidLatLng(driveState.segmentEndMarker.position) && (
            <Marker
              position={driveState.segmentEndMarker.position}
              icon={endMarkerIcon}
            />
          )}
          {hoverMarkerPosition && driveState.segmentSelectionMode !== 'none' && isValidLatLng(hoverMarkerPosition) && (
            <Marker
              position={hoverMarkerPosition}
              icon={hoverMarkerIcon}
            />
          )}
        </>
      )}



      {/* Hover tooltip */}
      {!isThumbnail && tooltipPosition && createPortal(
        <div
          className="fixed bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm pointer-events-none z-[250]"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {hoveredSol && `Sol ${hoveredSol}`}
          {hoveredFault && (
            <div>
              <div className="font-semibold">{hoveredFault.fault_type}</div>
              <div className="text-xs opacity-90">SCLK: {hoveredFault.sclk}</div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Sol end circle tooltip */}
      {!isThumbnail && hoveredSolEnd && solEndTooltipPosition && driveState.segmentSelectionMode === 'none' && (
        <SolTooltip
          sol={hoveredSolEnd.sol}
          distance={hoveredSolEnd.distance}
          start_sclk={hoveredSolEnd.sclk}
          end_sclk={hoveredSolEnd.endSclk}
          position={solEndTooltipPosition}
          pdi={solPDIData[hoveredSolEnd.sol]}
          isLoadingPDI={loadingPDI.has(hoveredSolEnd.sol)}
          onImageExpand={(img) => handleImageExpand(hoveredSolEnd.sol, img)}
          onClose={() => {
            setHoveredSolEnd(null);
            setSolEndTooltipPosition(null);
          }}
        />
      )}

      {/* Sol start circles - rendered AFTER all polylines to ensure they appear on top */}
      {!isThumbnail && solStartPoints.map((solStart) => {
        const point = roverPathData.points[solStart.index];
        if (!point) return null;

        // Calculate distance only within this sol, not cumulative from start
        const solPoints = roverPathData.points.filter(p => p.sol === solStart.sol);
        const distance = solPoints.reduce((acc, curr, idx, arr) => {
          if (idx === 0) return 0;
          const prev = arr[idx - 1];
          const deltaX = curr.longitude - prev.longitude;
          const deltaY = curr.latitude - prev.latitude;
          return acc + Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 111320;
        }, 0);

        return (
          <CircleMarker
            key={`sol-start-${solStart.sol}-${roverPathData.detail_level}-${roverPathData.total_points}`}
            center={solStart.position}
            radius={6}
            pathOptions={{
              fillColor: 'white',
              color: '#666',
              weight: 2,
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              mouseover: (e) => {
                // Disable hover effects when a drive is focused
                if (focusDrive || isThumbnail) return;

                // Compute viewport position using Leaflet's container coordinates
                const evt = e as unknown as L.LeafletMouseEvent;
                const containerPoint = map.latLngToContainerPoint(evt.latlng);
                const mapRect = map.getContainer().getBoundingClientRect();
                const staticPosition = {
                  x: mapRect.left + containerPoint.x,
                  y: mapRect.top + containerPoint.y - 12,
                };
                // Find start and end SCLK for this sol
                const solPoints = roverPathData.points.filter(p => p.sol === solStart.sol);
                const startSclk = point.sclk || undefined;
                const endSclk = solPoints.length > 0 ? (solPoints[solPoints.length - 1].sclk || undefined) : undefined;

                setHoveredSolEnd({
                  sol: solStart.sol,
                  distance: distance,
                  points: solPoints.length,
                  sclk: startSclk || undefined,
                  endSclk: endSclk,
                  position: staticPosition
                });
                setSolEndTooltipPosition(staticPosition);

                // Fetch PDI data for this sol
                fetchSolPDI(solStart.sol);
              },
              mouseout: (e) => {
                if (!isThumbnail) {
                  const relatedTarget = e.originalEvent.relatedTarget as HTMLElement;
                  // Only close if mouse didn't move to tooltip area
                  if (!relatedTarget?.closest('[data-tooltip-area="true"]')) {
                    setHoveredSolEnd(null);
                    setSolEndTooltipPosition(null);
                  }
                }
              }
            }}
          />
        );
      })}

      {/* Fault circles - rendered on top of everything */}
      {!isThumbnail && faults.length > 0 && roverPathData && (
        <>
          {faults.map((fault, index) => {
            // Find the path point with the smallest SCLK delta. The previous
            // implementation used `find()` with a 1000-SCLK tolerance, which
            // returns the FIRST in-range point — when sampling is sparse near
            // the end of a drive (e.g. Sol 1041), that's an earlier path point
            // and the fault renders ~90% along the path instead of ~100%.
            let faultPoint: typeof roverPathData.points[number] | undefined;
            let bestDelta = Infinity;
            for (const point of roverPathData.points) {
              if (point.sclk == null) continue;
              const delta = Math.abs(point.sclk - fault.sclk);
              if (delta < bestDelta) {
                bestDelta = delta;
                faultPoint = point;
              }
            }
            if (!faultPoint || bestDelta > 1000) return null;

            // Pin extends straight up (north on the map) from the path point.
            // Coordinates here are inverted-Y pixels: position [-pixelY, pixelX]
            // means decreasing pixelY = higher lat = up on screen.
            const [originalPixelX, originalPixelY] = latLngToPixel(faultPoint.latitude, faultPoint.longitude);
            const originalPosition: L.LatLngTuple = [-originalPixelY, originalPixelX];
            // Pin offset goes straight up (north): decrease pixelY in inverted-Y space.
            const position: L.LatLngTuple = [-(originalPixelY - FAULT_OFFSET_DISTANCE), originalPixelX];

            return (
              <React.Fragment key={`fault-${index}-${fault.sclk}`}>
                {/* Subtle dark casing under the connecting line for terrain contrast. */}
                <Polyline
                  positions={[originalPosition, position]}
                  pathOptions={{
                    color: '#404040',
                    weight: 3,
                    opacity: 0.35,
                  }}
                  pane="overlayPane"
                  interactive={false}
                />
                {/* Connecting line from path to fault circle */}
                <Polyline
                  positions={[originalPosition, position]}
                  pathOptions={{
                    color: FAULT_RED,
                    weight: 2,
                    opacity: 0.95,
                  }}
                  pane="overlayPane"
                />
                {/* Fault circle */}
                <CircleMarker
                  center={position}
                  radius={6}
                  pathOptions={{
                    fillColor: FAULT_RED,
                    color: '#404040',
                    weight: 1,
                    opacity: 0.5,
                    fillOpacity: 1,
                  }}
                  pane="overlayPane"
                  eventHandlers={{
                    mouseover: (e) => {
                      // Disable hover effects when a drive is focused
                      if (focusDrive) return;

                      const evt = e as unknown as L.LeafletMouseEvent;
                      const containerPoint = map.latLngToContainerPoint(evt.latlng);
                      const mapRect = map.getContainer().getBoundingClientRect();
                      const staticPosition = {
                        x: mapRect.left + containerPoint.x,
                        y: mapRect.top + containerPoint.y - 16,
                      };

                      // Show fault tooltip with enhanced content
                      setHoveredFault(fault);
                      setTooltipPosition(staticPosition);
                    },
                    mouseout: () => {
                      setHoveredFault(null);
                      setTooltipPosition(null);
                    },
                    click: () => {
                      // Move playhead to fault's SCLK timestamp when clicked
                      if (focusDrive && solData && fault.sclk) {
                        const startSclk = solData.start_sclk;
                        const endSclk = solData.end_sclk;
                        const duration = endSclk - startSclk;

                        if (duration > 0) {
                          // Calculate normalized position (0-1) based on fault's SCLK
                          const normalized = Math.max(0, Math.min(1, (fault.sclk - startSclk) / duration));
                          setDrivePosition(focusDrive, normalized);
                        }
                      }
                    }
                  }}
                />
              </React.Fragment>
            );
          })}
        </>
      )}

      {/* Image Modal */}
      {imageModalState && (
        <ImageModal
          isOpen={imageModalState.isOpen}
          onClose={handleImageModalClose}
          sol={imageModalState.sol}
          image={imageModalState.images.left ? { filename: imageModalState.images.left.filename || '', sclk: imageModalState.images.left.sclk, source: 'pdi' } : null}
        />
      )}

      {/* Playhead marker removed; rendered by overlay in InteractiveMarsMap */}
    </>
  );
}