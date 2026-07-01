import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { InteractiveMarsMap } from './InteractiveMarsMap';
import { useDriveState } from '../providers/DriveStateProvider';
import { X } from 'lucide-react';
import { API_BASE_URL } from '../../api/client';
import { latLngToPixel } from './util/marsCoordinateUtils';
import L from 'leaflet';

// Component to handle flying to last drive
function FlyToLastDrive() {
  const map = useMap();
  const hasFlownToLastDrive = useRef(false);

  useEffect(() => {
    const flyToLastDrive = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/map/rover-path/sols`);
        if (!response.ok) {
          console.error('Failed to fetch rover path sols data');
          return;
        }

        const data = await response.json();
        const sols = data.sols;

        if (!sols || Object.keys(sols).length === 0) {
          console.warn('No sols data available');
          return;
        }

        // Find the highest sol number (last drive)
        const solNumbers = Object.keys(sols).map(Number);
        const lastSol = Math.max(...solNumbers);
        const lastSolString = lastSol.toString();

        // Get the sol data to calculate center point
        const solData = sols[lastSolString];
        if (!solData) return;

        const startLat = Number(solData.start_point?.latitude);
        const startLng = Number(solData.start_point?.longitude);
        const endLat = Number(solData.end_point?.latitude);
        const endLng = Number(solData.end_point?.longitude);
        const validStart = Number.isFinite(startLat) && Number.isFinite(startLng);
        const validEnd = Number.isFinite(endLat) && Number.isFinite(endLng);

        // Calculate center point
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

        if (centerLat !== null && centerLng !== null) {
          // Convert to Leaflet coordinates
          const [px, py] = latLngToPixel(centerLat, centerLng);
          if (Number.isFinite(px) && Number.isFinite(py)) {
            const leafletCenter: [number, number] = [-py, px];

            if (!hasFlownToLastDrive.current) {
              map.flyTo(leafletCenter, -1, { animate: true, duration: 0.35 });
              hasFlownToLastDrive.current = true;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching rover path sols data:', error);
      }
    };

    // Only fly to last drive if we haven't flown yet
    if (!hasFlownToLastDrive.current) {
      flyToLastDrive();
    }
  }, [map]);

  return null;
}

export const FullMapView: React.FC<{ enableSegmentSelection?: boolean }> = ({
  enableSegmentSelection,
}) => {
  const driveState = useDriveState();
  const { segmentSelectionMode, setSegmentSelectionMode } = driveState;

  const handleCancelPlacement = () => {
    setSegmentSelectionMode('none');
  };

  const isInPlacementMode = segmentSelectionMode === 'start' || segmentSelectionMode === 'end';
  const placementText = segmentSelectionMode === 'start' ? 'start' : 'end';

  return (
    <div className="w-full h-full relative">
      {/* White gradient border ring for placement mode */}
      {isInPlacementMode && (
        <div className="absolute inset-0 pointer-events-none z-40">
          {/* Top border */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-white via-transparent to-white opacity-40"></div>
          {/* Bottom border */}
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-white via-transparent to-white opacity-40"></div>
          {/* Left border */}
          <div className="absolute top-0 left-0 bottom-0 w-3 bg-gradient-to-b from-white via-transparent to-white opacity-40"></div>
          {/* Right border */}
          <div className="absolute top-0 right-0 bottom-0 w-3 bg-gradient-to-b from-white via-transparent to-white opacity-40"></div>
        </div>
      )}
      <InteractiveMarsMap
        enableSegmentSelection={enableSegmentSelection}
        showPlayheadOverlay={false}
        mapChildren={<FlyToLastDrive />}
      />

      {/* Floating placement indicator */}
      {isInPlacementMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white dark:bg-stellar-dark-surface text-gray-800 dark:text-stellar-dark-text-primary px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 border border-gray-200 dark:border-stellar-dark-border">
            <span className="text-sm font-medium">
              Placing {placementText} marker
            </span>
            <button
              onClick={handleCancelPlacement}
              className="text-gray-600 dark:text-stellar-dark-text-secondary hover:text-gray-800 dark:hover:text-stellar-dark-text-primary transition-colors"
              title="Cancel marker placement"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
