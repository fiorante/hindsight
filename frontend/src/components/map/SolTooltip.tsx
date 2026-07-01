import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon, PinIcon, CornerRightUpIcon } from 'lucide-react';
import type { SolPDI, PDICameraSet, PDIImage } from '../../types/index';
import { imageRepository } from '../../api/repositories/imageRepository';
import { useAppStore } from '../../state/store';
import { useDriveState } from '../providers/DriveStateProvider';
import { ParameterSelector } from '../ui/ParameterSelector';
import { useTelemetryRanges } from '../../hooks/useTelemetryRanges';
import { useSol } from '../../hooks/useSol';
import { useFaults } from '../../hooks/useFaults';

// Simple CSS spinner styles
const spinnerStyles = `
  .loader {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.querySelector('#sol-tooltip-styles')) {
  const style = document.createElement('style');
  style.id = 'sol-tooltip-styles';
  style.textContent = spinnerStyles;
  document.head.appendChild(style);
}

interface SolTooltipProps {
  sol: number;
  distance: number;
  start_sclk?: number;
  end_sclk?: number;
  position: { x: number; y: number };
  pdi?: SolPDI;
  isLoadingPDI?: boolean;
  onImageExpand?: (image: { filename: string; sclk?: number; source: 'pdi' | 'vce' }) => void;
  onClose?: () => void;
}

interface PDIImageDisplayProps {
  image?: PDIImage;
  side: 'left' | 'right';
  onExpand?: () => void;
}

const PDIImageDisplay: React.FC<PDIImageDisplayProps> = ({ image, side, onExpand }) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (image && image.filename) {
      const img = new Image();
      img.src = imageRepository.getPDIImageUrl(image.filename);
      img.onload = () => setIsLoading(false);
      img.onerror = () => setImageError(true);
    } else {
      setIsLoading(false);
    }
  }, [image]);

  if (!image || !image.filename) {
    return (
      <div className="w-24 h-18 bg-gray-100 border border-gray-200 rounded flex items-center justify-center flex-shrink-0">
        <div className="text-xs text-gray-400 text-center">
          <div>📷</div>
          <div>No {side}</div>
          <div>image</div>
        </div>
      </div>
    );
  }

  const imageUrl = imageRepository.getPDIImageUrl(image.filename);

  return (
    <div
      className="relative w-24 h-18 border border-gray-200 rounded overflow-hidden cursor-pointer hover:border-gray-400 transition-colors flex-shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onExpand}
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="loader" />
        </div>
      ) : imageError ? (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-xs text-gray-400 text-center">
            <div>❌</div>
            <div>Error</div>
          </div>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={image.description}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )}

      {isHovered && !imageError && !isLoading && (
        <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded p-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      )}
    </div>
  );
};

interface CameraGroupProps {
  cameraSet: PDICameraSet;
  onExpand?: (image: { filename: string; sclk?: number; source: 'pdi' | 'vce' }) => void;
}

const CameraGroup: React.FC<CameraGroupProps> = ({ cameraSet, onExpand }) => {
  const handleExpand = (side: 'left' | 'right') => {
    const img = side === 'left' ? cameraSet.left : cameraSet.right;
    if (img && img.filename && onExpand) {
      onExpand({ filename: img.filename, sclk: img.sclk, source: 'pdi' });
    }
  };

  // Get SCLK from available image (left or right)
  const sclk = cameraSet.left?.sclk || cameraSet.right?.sclk;

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-medium text-gray-700 mb-1 text-center">
        {cameraSet.description}
        {sclk && <span className="text-gray-500 ml-1">(SCLK: {sclk})</span>}
      </div>
      <div className="flex gap-2">
        <PDIImageDisplay
          image={cameraSet.left}
          side="left"
          onExpand={() => handleExpand('left')}
        />
        <PDIImageDisplay
          image={cameraSet.right}
          side="right"
          onExpand={() => handleExpand('right')}
        />
      </div>
    </div>
  );
};

export const SolTooltip: React.FC<SolTooltipProps> = ({
  sol,
  distance,
  start_sclk,
  end_sclk,
  position,
  pdi,
  isLoadingPDI,
  onImageExpand,
  onClose
}) => {
  const [showParameterSelector, setShowParameterSelector] = useState(false);
  const [parameterSelectorPosition, setParameterSelectorPosition] = useState({ top: 0, left: 0 });
  const { pinnedParameters, addPinnedParameter, removePinnedParameter, setViewMode } = useAppStore();
  const { toggleDriveSelection, selectedDrives } = useDriveState();

  // Fetch parameter ranges for pinned parameters
  const { ranges: paramRanges, isLoading: rangesLoading } = useTelemetryRanges(sol, pinnedParameters);

  // Fetch sol data for distance parameter if needed
  const hasDistanceParameter = pinnedParameters.some(p => p === 'distance');
  const { data: solData, isLoading: solLoading } = useSol(hasDistanceParameter ? sol : null);

  // Fetch fault data for drive outcome
  const { data: faults, error: faultsError } = useFaults(sol);

  // Determine drive outcome
  const driveOutcome = useMemo(() => {
    // If there's a 404 error, the sol doesn't exist
    if (faultsError && (faultsError as any)?.response?.status === 404) {
      return { status: 'SOL NOT FOUND', color: 'gray' };
    }

    // If faults is null, we're still loading or there was an error
    if (!faults) {
      return { status: 'LOADING...', color: 'gray' };
    }

    if (faults.length === 0) {
      return { status: 'SUCCESS', color: 'green' };
    }
    // Get the last fault type
    const lastFault = faults[faults.length - 1];
    return { status: lastFault.fault_type, color: 'red' };
  }, [faults, faultsError]);

  const handleCameraExpand = (image: { filename: string; sclk?: number; source: 'pdi' | 'vce' }) => {
    onImageExpand?.(image);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    // Only close if mouse didn't move to another tooltip area
    if (!relatedTarget || !relatedTarget.closest || !relatedTarget.closest('[data-tooltip-area="true"]')) {
      onClose?.();
    }
  };

  const handleParameterSelect = (parameter: string) => {
    addPinnedParameter(parameter);
    setShowParameterSelector(false);
  };

  const handleRemoveParameter = (parameter: string) => {
    removePinnedParameter(parameter);
  };

  const handleAddParameterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Calculate position for the parameter selector relative to the button
    const buttonElement = event.currentTarget;
    const buttonRect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const selectorHeight = 400; // Approximate height of ParameterSelector

    // Check if there's enough space below the button
    if (buttonRect.bottom + selectorHeight < viewportHeight) {
      // Position below the button
      setParameterSelectorPosition({
        top: buttonRect.bottom + 5,
        left: buttonRect.left
      });
    } else {
      // Position above the button
      setParameterSelectorPosition({
        top: buttonRect.top - selectorHeight - 5,
        left: buttonRect.left
      });
    }
    setShowParameterSelector(true);
  };

  const handleOpenDriveClick = () => {
    // Always add the drive to selection (don't toggle)
    const driveId = sol.toString();
    // Pass pinned parameters as initial parameters for the drive if this is the first drive
    if (selectedDrives.length === 0 && pinnedParameters.length > 0) {
      // Store the pinned parameters as initial parameters for this drive
      // This will be used by DrivePanel when creating the DriveChartView
      useAppStore.getState().setLastSearchParameters(pinnedParameters);
    }

    if (!selectedDrives.includes(driveId)) {
      toggleDriveSelection(driveId);
    }
    setViewMode('drives');
    onClose?.();
  };

  return createPortal(
    <>
      {/* Invisible bridge connecting sol circle to tooltip */}
      <div
        className="fixed pointer-events-auto z-[9998]"
        data-tooltip-area="true"
        style={{
          position: 'fixed',
          left: position.x - 30,
          top: position.y,
          width: 60,
          height: 20,
          transform: 'translate(0, 0)',
          // backgroundColor: 'rgba(255, 0, 0, 0.3)',
        }}
        onMouseLeave={handleMouseLeave}
      />

      {/* Main tooltip */}
      <div
        className="fixed bg-white dark:bg-stellar-dark-surface border border-gray-300 dark:border-stellar-dark-border shadow-lg rounded-lg p-3 text-sm pointer-events-auto z-[9999] max-w-full"
        data-tooltip-area="true"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%)',
        }}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-row gap-4">
          {/* Basic Sol Info */}
          <div className="flex-1 min-w-64">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">Sol {sol}</div>
              <button
                onClick={handleOpenDriveClick}
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-black dark:bg-stellar-cta hover:bg-gray-800 dark:hover:bg-stellar-dark-text-secondary text-white dark:text-black rounded border border-gray-700 dark:border-stellar-cta transition-colors"
              >
                Open Drive
                <CornerRightUpIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="text-gray-600 dark:text-stellar-dark-text-secondary space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">Distance:</span>
                <span className="dark:text-stellar-dark-text-primary">{distance.toFixed(2)} m</span>
              </div>
              {start_sclk && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">Start SCLK:</span>
                  <span className="dark:text-stellar-dark-text-primary">{start_sclk}</span>
                </div>
              )}
              {end_sclk && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">End SCLK:</span>
                  <span className="dark:text-stellar-dark-text-primary">{end_sclk}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">Drive outcome:</span>
                <div className="flex items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full ${driveOutcome.color === 'green'
                      ? 'bg-green-500 dark:bg-green-400'
                      : driveOutcome.color === 'red'
                        ? 'bg-red-500 dark:bg-red-400'
                        : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                  />
                  <span className={`text-xs ${driveOutcome.color === 'green'
                    ? 'text-green-700 dark:text-green-300'
                    : driveOutcome.color === 'red'
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-600 dark:text-gray-400'
                    }`}>
                    {driveOutcome.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Dividing line */}
            <div className="border-t border-gray-200 dark:border-stellar-dark-border my-3"></div>

            {/* Pinned Parameters */}
            <div className="mb-2">
              <div className="text-sm font-medium text-gray-700 dark:text-stellar-dark-text-primary">Pinned Parameters</div>
            </div>

            {/* Pinned Parameters List */}
            <div className="space-y-2 mb-3">
              {pinnedParameters.map((parameter) => {
                // Handle special cases
                if (parameter === 'distance') {
                  if (solLoading) {
                    return (
                      <div key={parameter} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveParameter(parameter)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated rounded transition-colors"
                            title="Remove parameter"
                          >
                            <PinIcon className="w-3 h-3 text-black dark:text-stellar-dark-text-primary fill-black dark:fill-stellar-dark-text-primary" />
                          </button>
                          <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">{parameter}</span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-stellar-dark-text-primary">Loading...</span>
                      </div>
                    );
                  } else if (solData) {
                    const fmt = (v: number | null) => (v === null || v === undefined) ? 'N/A' : Number(v).toFixed(2);
                    return (
                      <div key={parameter} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveParameter(parameter)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated rounded transition-colors"
                            title="Remove parameter"
                          >
                            <PinIcon className="w-3 h-3 text-black dark:text-stellar-dark-text-primary fill-black dark:fill-stellar-dark-text-primary" />
                          </button>
                          <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">{parameter}</span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-stellar-dark-text-primary">{fmt(solData.distance)} m</span>
                      </div>
                    );
                  } else {
                    return (
                      <div key={parameter} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveParameter(parameter)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated rounded transition-colors"
                            title="Remove parameter"
                          >
                            <PinIcon className="w-3 h-3 text-black dark:text-stellar-dark-text-primary fill-black dark:fill-stellar-dark-text-primary" />
                          </button>
                          <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">{parameter}</span>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-stellar-dark-text-primary">N/A</span>
                      </div>
                    );
                  }
                }

                // Handle telemetry parameters
                const rng = paramRanges[parameter];
                const fmt = (v: number | null) => (v === null || v === undefined) ? 'N/A' : Number(v).toFixed(2);

                return (
                  <div key={parameter} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveParameter(parameter)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated rounded transition-colors"
                        title="Remove parameter"
                      >
                        <PinIcon className="w-3 h-3 text-black dark:text-stellar-dark-text-primary fill-black dark:fill-stellar-dark-text-primary" />
                      </button>
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">{parameter}</span>
                    </div>
                    <span className="text-xs text-gray-600 dark:text-stellar-dark-text-primary">
                      {rangesLoading ? 'Loading...' : rng ? `${fmt(rng.min)}-${fmt(rng.max)}` : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Add Parameter Button */}
            <button
              onClick={handleAddParameterClick}
              className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-100 dark:bg-stellar-dark-surface hover:bg-gray-200 dark:hover:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary rounded border border-gray-300 dark:border-stellar-dark-border transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              Add parameter
            </button>

            {/* Parameter Selector Modal */}
            {showParameterSelector && (
              <div className="fixed z-[10000]">
                <ParameterSelector
                  isOpen={showParameterSelector}
                  onClose={() => setShowParameterSelector(false)}
                  onSelectParameter={handleParameterSelect}
                  onSelectParameterValue={() => { }} // Not used in parameter-only mode
                  mode="parameter-only"
                  position={parameterSelectorPosition}
                  hideDriveCategory={true}
                />
              </div>
            )}
          </div>

          {/* PDI Images */}
          <div className="flex-1 border-l border-gray-200 dark:border-stellar-dark-border pl-3">
            <div className="text-sm font-medium text-gray-700 dark:text-stellar-dark-text-primary mb-2">Post Drive Imagery</div>

            {pdi ? (
              <div className="flex flex-col gap-3">
                <CameraGroup
                  cameraSet={pdi.fhaz}
                  onExpand={(image) => handleCameraExpand(image)}
                />

                <CameraGroup
                  cameraSet={pdi.rhaz}
                  onExpand={(image) => handleCameraExpand(image)}
                />

                <CameraGroup
                  cameraSet={pdi.ncam}
                  onExpand={(image) => handleCameraExpand(image)}
                />
              </div>
            ) : isLoadingPDI ? (
              <div className="flex items-center gap-2">
                <div className="loader" />
                <span className="text-gray-500">Loading imagery...</span>
              </div>
            ) : (
              <div className="text-gray-500">Not Available</div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
