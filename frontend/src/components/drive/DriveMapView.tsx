import React, { useState, useCallback, useEffect } from 'react';
import { InteractiveMarsMap } from '../map/InteractiveMarsMap';
import { useSolData } from '../../hooks/useSol';
import { Crosshair } from 'lucide-react';
import type { FaultRecord } from '../../types';


interface DriveMapViewProps {
  driveId: string;
  onMapReady?: () => void;
  faults?: FaultRecord[];
  faultOverlayEnabled?: boolean;
}

export const DriveMapView: React.FC<DriveMapViewProps> = ({
  driveId,
  onMapReady,
  faults = [],
  faultOverlayEnabled = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading drive data...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refocusNonce, setRefocusNonce] = useState(0);

  // Fetch sol data to detect missing drive data and surface errors
  const { error: solError } = useSolData(parseInt(driveId));

  useEffect(() => {
    if (solError) {
      setErrorMessage('No Drive Data Available');
      setLoadingMessage('');
      setIsLoading(false);
    }
  }, [solError]);

  const handleMapReady = useCallback(() => {
    setIsLoading(false);
    if (onMapReady) {
      onMapReady();
    }
  }, [onMapReady]);

  const handleRefocus = useCallback(() => {
    setRefocusNonce((n) => n + 1);
  }, []);

  return (
    <div className="h-full w-full relative">
      {/* Loading / Error overlay */}
      <div className={`absolute inset-0 bg-white dark:bg-stellar-dark-surface flex items-center justify-center z-50 transition-opacity duration-300 ${(isLoading || errorMessage) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="text-center">
          {errorMessage ? (
            <>
              <div className="text-gray-800 dark:text-stellar-dark-text-primary text-lg font-medium">{errorMessage}</div>
              <div className="text-gray-600 dark:text-stellar-dark-text-secondary text-sm mt-2">Sol {driveId}</div>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 dark:border-stellar-dark-text-primary mx-auto mb-4"></div>
              <div className="text-gray-800 dark:text-stellar-dark-text-primary text-lg font-medium">{loadingMessage}</div>
              <div className="text-gray-600 dark:text-stellar-dark-text-secondary text-sm mt-2">Sol {driveId}</div>
            </>
          )}
        </div>
      </div>

      {/* Interactive Mars Map */}
      <InteractiveMarsMap
        focusDrive={driveId}
        initialZoom={-1}
        showDebugInfo={false}
        onMapReady={handleMapReady}
        enableSegmentSelection={false}
        refocusTrigger={refocusNonce}
        faults={faultOverlayEnabled ? faults : []}
        allowFocusedDriveInteraction={true}
      />

      {/* Floating focus button */}
      <button
        aria-label="Center map on focused drive"
        title="Center on focused drive"
        onClick={handleRefocus}
        className="absolute top-4 right-4 z-50 rounded-full bg-white dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary shadow-lg border border-gray-200 dark:border-stellar-dark-border p-3 hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated active:scale-95 transition"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      {/* Drive info overlay */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-stellar-dark-surface bg-opacity-90 dark:bg-opacity-90 rounded px-3 py-2 text-sm font-medium shadow-lg text-gray-900 dark:text-stellar-dark-text-primary">
        Sol {driveId} Drive Detail
      </div>


    </div>
  );
}; 