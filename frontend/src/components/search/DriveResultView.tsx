import React, { useState, useCallback } from 'react'
import { getSelectedDriveColor } from '../../constants/drivePresentation'
import { MarsMapThumbnail } from '../map/MarsMapThumbnail'
import { useDriveState } from '../providers/DriveStateProvider'
// import { telemetryRepository } from '../../api/repositories'
import { useAppStore } from '../../state/store'
import { useTelemetryRanges } from '../../hooks/useTelemetryRanges'
import { useFaults } from '../../hooks/useFaults'
import { useSol } from '../../hooks/useSol'

interface Drive {
  id: string
  title: string
  description: string
  thumbnail: string
  isReference?: boolean
}

interface DriveResultViewProps {
  drive: Drive
  isSelected: boolean
  onClick: () => void
}

// Tweak this to adjust the thickness (in pixels) of the colored selection bar
// shown on the left edge of each search result row.
const SEARCH_RESULT_COLOR_BAR_WIDTH_PX = 6;

export const DriveResultView: React.FC<DriveResultViewProps> = ({ drive, isSelected, onClick }) => {
  const driveState = useDriveState();
  const [isLoading, setIsLoading] = useState(true);
  const selectedDrives = useAppStore((s) => s.selectedDrives)
  const lastSearchParameters = useAppStore((s) => s.lastSearchParameters)
  const params = Array.isArray(lastSearchParameters) ? lastSearchParameters : []
  const solNum = parseInt(drive.id, 10)

  // Filter out special parameters that need different handling
  const telemetryParams = params.filter((p) => p !== 'terrain' && p !== 'fault' && p !== 'distance' && p !== 'duration')
  const { ranges: paramRanges, isLoading: rangesLoading } = useTelemetryRanges(Number.isFinite(solNum) ? solNum : null, telemetryParams)

  // Check if we have fault-related filters
  const hasFaultFilter = params.some(p => p === 'fault')
  const { data: faults, isLoading: faultsLoading } = useFaults(hasFaultFilter ? solNum : null)

  // Check if we have distance parameter
  const hasDistanceFilter = params.some(p => p === 'distance')
  const { data: solData, isLoading: solLoading } = useSol(hasDistanceFilter ? solNum : null)

  // Check if we have duration parameter
  const hasDurationFilter = params.some(p => p === 'duration')
  const { data: durationSolData, isLoading: durationSolLoading } = useSol(hasDurationFilter ? solNum : null)

  const handleMouseEnter = () => {
    driveState.setHoveredDrive(drive.id);
  };

  const handleMouseLeave = () => {
    driveState.setHoveredDrive(null);
  };

  const handleMapReady = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Ranges are now fetched via useTelemetryRanges

  const driveColor = isSelected ? getSelectedDriveColor(drive.id, selectedDrives) : undefined;

  return (
    <div
      className={`bg-white dark:bg-stellar-dark-surface p-3 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated ${isSelected ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : ''} px-4 pb-2 relative`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Color indicator bar for selected drives */}
      {driveColor && (
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ backgroundColor: driveColor, width: SEARCH_RESULT_COLOR_BAR_WIDTH_PX }}
        />
      )}
      <div className="flex gap-4">
        {/* Map Column */}
        <div className="flex-shrink-0">
          <div className="bg-gray-100 dark:bg-stellar-dark-surface-elevated rounded-md h-24 w-32 relative overflow-hidden">
            {/* Loading spinner for thumbnail */}
            <div className={`absolute inset-0 bg-white dark:bg-stellar-dark-surface flex items-center justify-center z-50 transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 dark:border-stellar-dark-text-primary"></div>
            </div>

            {/* LeafletMapView thumbnail */}
            <MarsMapThumbnail
              focusDrive={drive.id}
              isThumbnail={true}
              showDebugInfo={false}
              initialZoom={-2}
              onMapReady={handleMapReady}
            />
          </div>
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Sol number and reference indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold text-sm text-gray-900 dark:text-stellar-dark-text-primary">
              Sol {drive.id}
              {drive.isReference && (
                <span className="ml-1 font-normal text-gray-500 dark:text-stellar-dark-text-secondary">(REF)</span>
              )}
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-1">
            {(() => {
              const params = Array.isArray(lastSearchParameters) ? lastSearchParameters : []
              if (params.length === 0) {
                return (
                  <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">
                    {drive.description}
                  </div>
                )
              }

              const parameterLines: React.ReactNode[] = []
              let parameterCount = 0

              // Handle fault display
              if (hasFaultFilter && parameterCount < 3) {
                if (faultsLoading) {
                  parameterLines.push(
                    <div key="fault" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">LAST FAULT:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">Loading...</span>
                    </div>
                  )
                } else if (faults && faults.length > 0) {
                  const lastFault = faults[faults.length - 1].fault_type
                  parameterLines.push(
                    <div key="fault" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">LAST FAULT:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">{lastFault}</span>
                    </div>
                  )
                } else {
                  parameterLines.push(
                    <div key="fault" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">LAST FAULT:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">None</span>
                    </div>
                  )
                }
                parameterCount++
              }

              // Handle distance parameter (special case - show single value)
              if (hasDistanceFilter && parameterCount < 3) {
                if (solLoading) {
                  parameterLines.push(
                    <div key="distance" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DISTANCE:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">Loading...</span>
                    </div>
                  )
                } else if (solData) {
                  const distance = solData.distance
                  const fmt = (v: number | null) => (v === null || v === undefined) ? 'N/A' : Number(v).toFixed(2)
                  parameterLines.push(
                    <div key="distance" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DISTANCE:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">{fmt(distance)} m</span>
                    </div>
                  )
                } else {
                  parameterLines.push(
                    <div key="distance" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DISTANCE:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">N/A</span>
                    </div>
                  )
                }
                parameterCount++
              }

              // Handle duration parameter (special case - show single value)
              if (hasDurationFilter && parameterCount < 3) {
                if (durationSolLoading) {
                  parameterLines.push(
                    <div key="duration" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DURATION:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">Loading...</span>
                    </div>
                  )
                } else if (durationSolData) {
                  const duration = durationSolData.duration
                  const fmt = (v: number | null) => (v === null || v === undefined) ? 'N/A' : Number(v).toFixed(2)
                  parameterLines.push(
                    <div key="duration" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DURATION:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">{fmt(duration)} s</span>
                    </div>
                  )
                } else {
                  parameterLines.push(
                    <div key="duration" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">DURATION:</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">N/A</span>
                    </div>
                  )
                }
                parameterCount++
              }

              // Handle telemetry parameters (excluding special cases)
              if (telemetryParams.length > 0 && parameterCount < 3) {
                if (rangesLoading && Object.keys(paramRanges).length === 0) {
                  parameterLines.push(
                    <div key="loading" className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">Loading...</span>
                      <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">--</span>
                    </div>
                  )
                } else {
                  telemetryParams.slice(0, 3 - parameterCount).forEach((p) => {
                    const rng = paramRanges[p]
                    const label = p.toUpperCase()

                    // For numerical parameters, show range
                    const fmt = (v: number | null) => (v === null || v === undefined) ? 'N/A' : Number(v).toFixed(2)
                    parameterLines.push(
                      <div key={p} className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">{label}:</span>
                        <span className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">{fmt(rng?.min ?? null)}-{fmt(rng?.max ?? null)}</span>
                      </div>
                    )
                  })
                }
              }

              return parameterLines
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}; 