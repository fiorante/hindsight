import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useDriveState } from '../providers/DriveStateProvider';
import { MarsTerrainTileLayer } from './MarsTerrainTileLayer';
import { RoverPathLayer } from './RoverPathLayer';
import { latLngToPixel, leafletBoundsToGeographic } from './util/marsCoordinateUtils';
import type { MapViewProps, MapBounds, RoverPathData } from './util/marsMapTypes';
import type { FaultRecord } from '../../types';
import { useAppStore } from '../../state/store';
import { API_BASE_URL } from '../../api/client';

// Component to handle map events and rover path loading
function MapController({
  onZoomChange,
  onViewportChange,
  onMapReady,
}: {
  onZoomChange: (zoom: number) => void;
  onViewportChange: (bounds: L.LatLngBounds) => void;
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
      onViewportChange(map.getBounds());
    },
    moveend: () => {
      onViewportChange(map.getBounds());
    },
  });

  // Notify parent after the map is ready (handles already-ready case too)
  useEffect(() => {
    map.whenReady(() => {
      onZoomChange(map.getZoom());
      onViewportChange(map.getBounds());
      onMapReady(map);
    });
  }, [map, onZoomChange, onViewportChange, onMapReady]);

  return null;
}

export function InteractiveMarsMap({
  focusDrive,
  initialZoom = -3,
  showDebugInfo = true,
  onMapReady,
  enableSegmentSelection = false,
  showPlayheadOverlay = true,
  refocusTrigger,
  faults = [],
  allowFocusedDriveInteraction = false,
  mapChildren,
}: Partial<MapViewProps> & { focusDrive?: string; enableSegmentSelection?: boolean; showPlayheadOverlay?: boolean; refocusTrigger?: number; faults?: FaultRecord[]; allowFocusedDriveInteraction?: boolean; mapChildren?: React.ReactNode }) {
  const hasFocusedRef = useRef<string | null>(null);
  const lastProcessedBoundsRef = useRef<L.LatLngBounds | null>(null);
  const driveState = useDriveState();
  const selectedDrives = driveState.selectedDrives;
  const searchResults = driveState.searchResults;
  const onDriveSelect = driveState.toggleDriveSelection;

  const [zoom, setZoom] = useState(initialZoom);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [roverPathData, setRoverPathData] = useState<RoverPathData | null>(null);

  const [currentViewBounds, setCurrentViewBounds] = useState<L.LatLngBounds | null>(null);
  const [solsData, setSolsData] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Smooth transition state management
  const [displayedData, setDisplayedData] = useState<RoverPathData | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTimeout, setTransitionTimeout] = useState<number | null>(null);
  const [viewportChangeTimeout, setViewportChangeTimeout] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayRafRef = useRef<number | null>(null);
  const pendingCenterRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  const isMapContainerVisible = useCallback((): boolean => {
    if (!mapInstance) return false;
    const el = mapInstance.getContainer();
    if (!el) return false;
    const hasSize = el.clientWidth > 0 && el.clientHeight > 0;
    const inLayout = el.offsetParent !== null; // false when display:none in ancestor
    return hasSize && inLayout;
  }, [mapInstance]);

  // Determine detail level based on zoom
  const getDetailLevel = useCallback((zoom: number): string => {
    if (zoom <= -4) return 'low';
    if (zoom <= -2) return 'medium';
    return 'high';
  }, []);

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/map/bounds`).then(res => res.json()),
      fetch(`${API_BASE_URL}/map/rover-path/sols`).then(res => res.json())
    ]).then(([bounds, sols]) => {
      setMapBounds(bounds);
      setSolsData(sols);
    }).catch(console.error);
  }, []);

  // Load rover path data based on zoom level and viewport
  const loadRoverPathData = useCallback((zoom: number, viewBounds: L.LatLngBounds | null) => {
    const detailLevel = getDetailLevel(zoom);

    let url = `${API_BASE_URL}/map/rover-path?detail=${detailLevel}`;

    if (viewBounds) {
      const geoBounds = leafletBoundsToGeographic(viewBounds);
      const latBuffer = (geoBounds.max_lat - geoBounds.min_lat) * 0.1;
      const lngBuffer = (geoBounds.max_lng - geoBounds.min_lng) * 0.1;

      url += `&min_lat=${geoBounds.min_lat - latBuffer}` +
        `&max_lat=${geoBounds.max_lat + latBuffer}` +
        `&min_lng=${geoBounds.min_lng - lngBuffer}` +
        `&max_lng=${geoBounds.max_lng + lngBuffer}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (displayedData && !isTransitioning) {
          setIsTransitioning(true);
          if (transitionTimeout) {
            clearTimeout(transitionTimeout);
          }
          const timeout = setTimeout(() => {
            setDisplayedData(data);
            setIsTransitioning(false);
            setTransitionTimeout(null);
          }, 150);
          setTransitionTimeout(timeout);
        } else {
          setDisplayedData(data);
        }
        setRoverPathData(data);
      })
      .catch(err => {
        console.error('Failed to load rover path:', err);
      });
  }, [getDetailLevel]);

  // Load data when zoom or viewport changes (with debouncing)
  useEffect(() => {
    if (currentViewBounds) {
      // Check if bounds have changed significantly to avoid unnecessary API calls
      const lastBounds = lastProcessedBoundsRef.current;
      const boundsChanged = !lastBounds ||
        Math.abs(currentViewBounds.getNorth() - lastBounds.getNorth()) > 0.0001 ||
        Math.abs(currentViewBounds.getSouth() - lastBounds.getSouth()) > 0.0001 ||
        Math.abs(currentViewBounds.getEast() - lastBounds.getEast()) > 0.0001 ||
        Math.abs(currentViewBounds.getWest() - lastBounds.getWest()) > 0.0001;

      if (boundsChanged) {
        // Clear any existing timeout
        if (viewportChangeTimeout) {
          clearTimeout(viewportChangeTimeout);
        }

        // Debounce viewport changes to prevent excessive API calls
        const timeout = setTimeout(() => {
          loadRoverPathData(zoom, currentViewBounds);
          lastProcessedBoundsRef.current = currentViewBounds;
        }, 200); // 200ms debounce

        setViewportChangeTimeout(timeout);
      }
    }
  }, [zoom, currentViewBounds, loadRoverPathData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (viewportChangeTimeout) {
        clearTimeout(viewportChangeTimeout);
      }
    };
  }, [viewportChangeTimeout]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleViewportChange = useCallback((bounds: L.LatLngBounds) => {
    setCurrentViewBounds(bounds);
  }, []);

  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map);
  }, []);

  // Inform parent when the map instance is ready (decoupled from centering)
  useEffect(() => {
    if (!mapInstance || !onMapReady) return;
    const t = window.setTimeout(() => onMapReady(), 50);
    return () => window.clearTimeout(t);
  }, [mapInstance, onMapReady]);

  // Handle map resize
  useEffect(() => {
    if (mapInstance) {
      const timer = setTimeout(() => {
        mapInstance.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapInstance]);

  // Resize observer
  useEffect(() => {
    if (mapInstance) {
      const resizeObserver = new ResizeObserver(() => {
        mapInstance.invalidateSize();
        // If a move was deferred while hidden, apply it now after size is valid
        if (pendingCenterRef.current && isMapContainerVisible()) {
          const { center, zoom } = pendingCenterRef.current;
          if (Number.isFinite(center[0]) && Number.isFinite(center[1])) {
            try { mapInstance.setView(center as any, zoom, { animate: false }); } catch { /* noop */ }
          }
          pendingCenterRef.current = null;
        }
      });
      const mapContainer = mapInstance.getContainer();
      resizeObserver.observe(mapContainer);
      return () => resizeObserver.disconnect();
    }
  }, [mapInstance, isMapContainerVisible]);

  // Visibility observer to detect when the map container becomes visible (e.g., GL tab activated)
  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    if (!container) return;
    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Ensure Leaflet recalculates sizes
            try { mapInstance.invalidateSize(); } catch { /* noop */ }
            if (pendingCenterRef.current) {
              const { center, zoom } = pendingCenterRef.current;
              if (Number.isFinite(center[0]) && Number.isFinite(center[1])) {
                try { mapInstance.setView(center as any, zoom, { animate: false }); } catch { /* noop */ }
              }
              pendingCenterRef.current = null;
            }
          }
        }
      }, { root: null, threshold: 0 });
      io.observe(container);
    } catch { /* noop */ }
    return () => { try { io?.disconnect(); } catch { /* noop */ } };
  }, [mapInstance]);



  // Precompute SCLK bounds per sol for playhead interpolation
  const solSclkBounds = useMemo(() => {
    const bounds: Record<string, { min: number; max: number; startIndex: number; endIndex: number }> = {};
    const points = displayedData?.points;
    if (!points || points.length === 0) return bounds;
    let currentSol = points[0].sol;
    let startIndex = 0;
    for (let i = 1; i <= points.length; i++) {
      const boundary = i === points.length || points[i].sol !== currentSol;
      if (boundary) {
        let min = Infinity, max = -Infinity;
        for (let j = startIndex; j < i; j++) {
          const s = points[j].sclk;
          if (s !== null) {
            min = Math.min(min, s);
            max = Math.max(max, s);
          }
        }
        if (min !== Infinity && max !== -Infinity) {
          bounds[currentSol.toString()] = { min, max, startIndex, endIndex: i - 1 };
        }
        if (i < points.length) {
          currentSol = points[i].sol;
          startIndex = i;
        }
      }
    }
    return bounds;
  }, [displayedData]);

  // Narrow subscription to focused drive normalized position
  const focusedDriveNormalized = useAppStore((s) => (focusDrive ? s.drivePositions[focusDrive] ?? null : null));

  // Update overlay position using map container coordinates
  const updateOverlay = useCallback(() => {
    if (!mapInstance || !overlayRef.current || !displayedData || !focusDrive) return;
    const driveId = focusDrive.toString();
    const norm = focusedDriveNormalized;
    const bounds = solSclkBounds[driveId];
    if (norm === null || norm === undefined || !bounds) return;

    const { min, max, startIndex, endIndex } = bounds;
    const range = max - min;
    if (!isFinite(range) || range === 0) return;
    const target = min + norm * range;

    const pts = displayedData.points;
    let idx = -1;
    for (let j = startIndex; j < endIndex; j++) {
      const s0 = pts[j].sclk;
      const s1 = pts[j + 1].sclk;
      if (s0 === null || s1 === null) continue;
      const low = Math.min(s0, s1);
      const high = Math.max(s0, s1);
      if (target >= low && target <= high) { idx = j; break; }
    }
    if (idx === -1) return;

    const p0 = displayedData.points[idx];
    const p1 = displayedData.points[idx + 1];
    if (p0.sclk === null || p1.sclk === null) return;
    const t = (p1.sclk - p0.sclk) === 0 ? 0 : (target - p0.sclk) / (p1.sclk - p0.sclk);
    const [px0, py0] = latLngToPixel(p0.latitude, p0.longitude);
    const [px1, py1] = latLngToPixel(p1.latitude, p1.longitude);
    const interpPx = px0 + t * (px1 - px0);
    const interpPy = py0 + t * (py1 - py0);

    const leafletLatLng = L.latLng(-interpPy, interpPx);
    const containerPoint = mapInstance.latLngToContainerPoint(leafletLatLng);

    // orientation toward increasing sclk on the chosen segment
    const increasing = p1.sclk >= p0.sclk;
    const dirFrom = increasing ? { x: px0, y: py0 } : { x: px1, y: py1 };
    const dirTo = increasing ? { x: px1, y: py1 } : { x: px0, y: py0 };
    const angleDeg = Math.atan2(dirTo.y - dirFrom.y, dirTo.x - dirFrom.x) * 180 / Math.PI;

    const el = overlayRef.current;
    el.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
    el.style.left = `${containerPoint.x}px`;
    el.style.top = `${containerPoint.y}px`;
    el.style.display = 'block';
  }, [mapInstance, displayedData, focusDrive, focusedDriveNormalized, solSclkBounds]);

  // Run overlay update on relevant changes
  useEffect(() => { updateOverlay(); }, [updateOverlay]);

  // Keep overlay synced on map movements/zoom
  useEffect(() => {
    if (!mapInstance) return;
    const handler = () => {
      if (overlayRafRef.current !== null) return;
      overlayRafRef.current = requestAnimationFrame(() => {
        overlayRafRef.current = null;
        updateOverlay();
      });
    };
    mapInstance.on('move', handler);
    mapInstance.on('zoom', handler);
    return () => {
      mapInstance.off('move', handler);
      mapInstance.off('zoom', handler);
    };
  }, [mapInstance, updateOverlay]);

  // Allow external trigger to refocus on the same drive
  useEffect(() => {
    if (refocusTrigger !== undefined) {
      hasFocusedRef.current = null;
    }
  }, [refocusTrigger]);

  // Focus on specific drive (on load and when refocus is triggered) after Leaflet 'load' has fired
  useEffect(() => {
    if (!focusDrive || !solsData || !mapInstance) return;
    if (hasFocusedRef.current === focusDrive) return;

    const solData = solsData.sols[focusDrive];
    if (!solData) return;

    const startLat = Number(solData.start_point?.latitude);
    const startLng = Number(solData.start_point?.longitude);
    const endLat = Number(solData.end_point?.latitude);
    const endLng = Number(solData.end_point?.longitude);
    const validStart = Number.isFinite(startLat) && Number.isFinite(startLng);
    const validEnd = Number.isFinite(endLat) && Number.isFinite(endLng);

    // Kick off data load in background
    if (validStart || validEnd) {
      let minLat: number, maxLat: number, minLng: number, maxLng: number;
      if (validStart && validEnd) {
        minLat = Math.min(startLat, endLat) - 0.01;
        maxLat = Math.max(startLat, endLat) + 0.01;
        minLng = Math.min(startLng, endLng) - 0.01;
        maxLng = Math.max(startLng, endLng) + 0.01;
      } else if (validStart) {
        minLat = startLat - 0.01; maxLat = startLat + 0.01;
        minLng = startLng - 0.01; maxLng = startLng + 0.01;
      } else {
        minLat = endLat - 0.01; maxLat = endLat + 0.01;
        minLng = endLng - 0.01; maxLng = endLng + 0.01;
      }
      const url = `${API_BASE_URL}/map/rover-path?detail=medium&min_lat=${minLat}&max_lat=${maxLat}&min_lng=${minLng}&max_lng=${maxLng}`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          setDisplayedData(data);
          setRoverPathData(data);
        })
        .catch(console.error);
    }

    // Compute target center and delay slightly after 'load' to ensure layout is stable
    let centerLat: number | null = null;
    let centerLng: number | null = null;
    if (validStart && validEnd) {
      centerLat = (startLat + endLat) / 2;
      centerLng = (startLng + endLng) / 2;
    } else if (validStart) {
      centerLat = startLat;
      centerLng = startLng;
    } else if (validEnd) {
      centerLat = endLat;
      centerLng = endLng;
    }
    let leafletCenter: [number, number] | null = null;
    if (centerLat !== null && centerLng !== null) {
      if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        const [px, py] = latLngToPixel(centerLat, centerLng);
        if (Number.isFinite(px) && Number.isFinite(py)) {
          leafletCenter = [-py, px];
        }
      }
    }
    if (!leafletCenter && mapBounds) {
      const [px, py] = latLngToPixel(mapBounds.center.lat, mapBounds.center.lng);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        leafletCenter = [-py, px];
      }
    }
    const timeout = window.setTimeout(() => {
      if (!mapInstance || hasFocusedRef.current === focusDrive) return;
      if (!leafletCenter) return;
      if (!Number.isFinite(leafletCenter[0]) || !Number.isFinite(leafletCenter[1])) return;
      // If hidden or zero-sized (e.g., inactive GL tab), defer until visible
      if (!isMapContainerVisible()) {
        pendingCenterRef.current = { center: leafletCenter, zoom: -1 };
        return;
      }
      mapInstance.flyTo(leafletCenter, -1, { animate: true, duration: 0.35 });
      hasFocusedRef.current = focusDrive;
    }, 50);

    return () => clearTimeout(timeout);
  }, [focusDrive, solsData, mapInstance, onMapReady, refocusTrigger, mapBounds, isMapContainerVisible]);

  // Center on search results
  useEffect(() => {
    // Do not override an explicit drive focus
    if (focusDrive) return;
    if (searchResults && searchResults.length > 0 && solsData && mapInstance) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;

      searchResults.forEach(result => {
        const solData = solsData.sols[result.sol.toString()];
        if (solData) {
          minLat = Math.min(minLat, solData.start_point.latitude, solData.end_point.latitude);
          maxLat = Math.max(maxLat, solData.start_point.latitude, solData.end_point.latitude);
          minLng = Math.min(minLng, solData.start_point.longitude, solData.end_point.longitude);
          maxLng = Math.max(maxLng, solData.start_point.longitude, solData.end_point.longitude);
        }
      });

      if (minLat !== Infinity) {
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
          const [px, py] = latLngToPixel(centerLat, centerLng);
          if (Number.isFinite(px) && Number.isFinite(py)) {
            const leafletCenter: [number, number] = [-py, px];
            if (!isMapContainerVisible()) {
              pendingCenterRef.current = { center: leafletCenter, zoom: -2 };
              return;
            }
            mapInstance.setView(leafletCenter, -2, { animate: true });
          }
        }
      }
    }
  }, [searchResults, solsData, mapInstance, focusDrive, isMapContainerVisible]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (transitionTimeout) {
        clearTimeout(transitionTimeout);
      }
    };
  }, [transitionTimeout]);

  if (!mapBounds) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading map configuration...</div>
      </div>
    );
  }

  const { center } = mapBounds;
  const [centerPixelX, centerPixelY] = latLngToPixel(center.lat, center.lng);
  const mapCenter: [number, number] = [-centerPixelY, centerPixelX];

  return (
    <div className="w-full h-full relative" style={{ overflow: 'hidden' }}>
      <MapContainer
        center={mapCenter}
        zoom={initialZoom}
        minZoom={mapBounds.minZoom}
        maxZoom={mapBounds.maxZoom}
        zoomSnap={0.5}
        style={{ height: '100%', width: '100%' }}
        crs={L.CRS.Simple}
        zoomControl={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        boxZoom={true}
        keyboard={true}
        attributionControl={false}
        preferCanvas={true}
      >
        <MarsTerrainTileLayer
          minZoom={mapBounds.minZoom}
          maxZoom={mapBounds.maxZoom}
          maxNativeZoom={mapBounds.maxNativeZoom}
          visible={true}
        />

        <MapController
          onZoomChange={handleZoomChange}
          onViewportChange={handleViewportChange}
          onMapReady={handleMapReady}
        />

        {displayedData && (
          <RoverPathLayer
            roverPathData={displayedData}
            selectedDrives={selectedDrives}
            onDriveSelect={onDriveSelect}
            focusDrive={focusDrive}
            searchResults={searchResults}
            isThumbnail={false}
            enableSegmentSelection={enableSegmentSelection}
            faults={faults}
            allowFocusedDriveInteraction={allowFocusedDriveInteraction}
          />
        )}

        {mapChildren}
      </MapContainer>

      {/* Playhead overlay */}
      {showPlayheadOverlay && (
        <div
          ref={overlayRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 28,
            height: 28,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 200,
            display: 'none',
          }}
        >
          <img
            src="/perseverance.png"
            style={{
              width: 24,
              height: 24,
              filter: [
                'drop-shadow(1px 0 0 #404040)',
                'drop-shadow(-1px 0 0 #404040)',
                'drop-shadow(0 1px 0 #404040)',
                'drop-shadow(0 -1px 0 #404040)',
                'drop-shadow(0 0 3px rgba(0,0,0,0.5))',
              ].join(' '),
              transform: 'rotate(90deg)',
              transformOrigin: '50% 50%',
            }}
          />
        </div>
      )}

      {/* Debug info */}
      {showDebugInfo && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
          Zoom: {zoom} | Detail: {getDetailLevel(zoom)}
          {roverPathData && ` | Points: ${roverPathData.total_points}`}
        </div>
      )}
    </div>
  );
}