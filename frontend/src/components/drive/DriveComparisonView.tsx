import React, { useEffect, useState } from 'react'
import { DrivePanel } from './DrivePanel'
import { ArrowRightLeftIcon } from 'lucide-react'
import { useDriveState } from '../providers/DriveStateProvider'
import { useAppStore } from '../../state/store'

interface PanelState {
  view: 'map' | 'chart' | 'evrs' | 'vce';
  charts: string[];
  layoutJson?: string; // GoldenLayout config per drive panel
}

export const DriveComparisonView: React.FC = () => {
  const { selectedDrives, toggleDriveSelection } = useDriveState()
  const driveIds = selectedDrives
  const syncEnabled = useAppStore((s) => s.syncDrivePanels)
  const setSyncEnabled = useAppStore((s) => s.setSyncDrivePanels)
  const [lastModifiedPanelId, setLastModifiedPanelId] = useState<string | null>(null);
  const [panelStates, setPanelStates] = useState<Record<string, PanelState>>({});

  // Initialize panel states when driveIds change
  useEffect(() => {
    const initialStates: Record<string, PanelState> = {};
    driveIds.forEach((id) => {
      initialStates[id] = {
        view: 'map',
        charts: ['elevation', 'slope', 'terrain'], // Default charts
        layoutJson: undefined,
      };
    });
    setPanelStates(initialStates);
  }, [driveIds]);
  // Apply a panel state to all panels
  const applyStateToAllPanels = (sourceState: PanelState) => {
    const updatedStates = { ...panelStates };
    driveIds.forEach((id) => {
      updatedStates[id] = { ...sourceState };
    });
    setPanelStates(updatedStates);
  };

  // Handle layout change (GoldenLayout config) for a specific panel
  const handlePanelLayoutChange = (driveId: string, layoutJson: string) => {
    setLastModifiedPanelId(driveId);

    const newState: PanelState = {
      ...panelStates[driveId],
      layoutJson,
    };

    if (syncEnabled) {
      applyStateToAllPanels(newState);
    } else {
      setPanelStates({
        ...panelStates,
        [driveId]: newState,
      });
    }
  };

  // (View and chart toggles removed in favor of GoldenLayout-controlled panels)

  // Toggle sync mode
  const toggleSync = () => {
    const newSyncState = !syncEnabled;
    setSyncEnabled(newSyncState);

    if (newSyncState && lastModifiedPanelId && panelStates[lastModifiedPanelId]) {
      // WHEN SYNC BUTTON ENABLED: Apply the most recently modified panel's state to all panels
      applyStateToAllPanels(panelStates[lastModifiedPanelId]);
    }
    // WHEN SYNC BUTTON DISABLED: Do nothing - panels keep their current state
  };
  return (
    <div className="w-full h-full bg-gray-100 dark:bg-stellar-dark-background p-4 flex flex-col overflow-hidden">
      {/* Top controls */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex items-center h-12">
          <h2 className="text-lg font-medium text-gray-800 dark:text-stellar-dark-text-primary mr-3">
            Drive Details
          </h2>
          {driveIds.length > 1 && (
            <div className="relative group">
              <button
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${syncEnabled
                  ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black shadow-md'
                  : 'bg-white dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated border dark:border-stellar-dark-border'
                  }`}
                onClick={toggleSync}
                title="Synchronize drive panels"
              >
                <ArrowRightLeftIcon className="h-5 w-5" />
              </button>
              {/* Tooltip */}
              <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-1 translate-y-full bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-10">
                Synchronize drive panels
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Drive panels or empty state */}
      {driveIds.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="relative text-center max-w-xl px-6">
            <div className="text-xl font-semibold text-gray-800 dark:text-stellar-dark-text-primary mb-2">No drives to compare</div>
            <div className="text-gray-600 dark:text-stellar-dark-text-secondary mb-4">Perform a search to select drives, or add a drive directly using the add button above.</div>
            {/* Curved arrow to left search panel (bowing right) */}
            <div className="absolute left-[-140px] top-1/2 -translate-y-1/2 hidden md:block" aria-hidden>
              <svg width="140" height="80" viewBox="0 0 140 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="arrowhead-left" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#9CA3AF" />
                  </marker>
                </defs>
                <path d="M140 40 C 160 20, 100 60, 20 30" stroke="#9CA3AF" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-left)" />
              </svg>
            </div>
            {/* Curved arrow to top-right add button (bowing right) */}
            <div className="absolute right-[-90px] top-[-30px] hidden md:block" aria-hidden>
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="arrowhead-top-right" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#9CA3AF" />
                  </marker>
                </defs>
                <path d="M0 100 C 50 120, 110 60, 90 20" stroke="#9CA3AF" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-top-right)" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-4 flex-1 min-h-0 ${driveIds.length === 1 ? 'grid-cols-1' : driveIds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          {driveIds.map((driveId) => (
            <DrivePanel
              key={driveId}
              driveId={driveId}
              onClose={() => toggleDriveSelection(driveId)}
              panelLayout={panelStates[driveId]?.layoutJson}
              onLayoutChange={(json) => handlePanelLayoutChange(driveId, json)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
