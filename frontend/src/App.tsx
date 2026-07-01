import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FullMapView } from './components/map/FullMapView';
import { SearchPanel } from './components/search/SearchPanel';
import { DriveComparisonView } from './components/drive/DriveComparisonView';
import { RouterWrapper } from './components/routing/RouterWrapper';
import { useDriveState } from './components/providers/DriveStateProvider';
import {
  MapIcon,
  SquareStackIcon,
} from 'lucide-react';
import { useAlert } from './hooks/useAlert';

import { AlertDialog } from './components/ui/AlertDialog';

import { GoToSolButton } from './components/map/GoToSolButton';
import { SettingsButton } from './components/ui/SettingsButton';

import { ThemeProvider } from './contexts/ThemeContext';
import { useAppStore, type AppState } from './state/store';

// Extend Window interface for global alert function
declare global {
  interface Window {
    showSegmentAlert?: (message: string) => void;
  }
}

function AppContent() {
  // Use centralized drive state
  const driveState = useDriveState();
  const { alert, showAlert, hideAlert } = useAlert();

  const similarityMode = useAppStore((s: AppState) => s.similarityMode)

  const viewMode = useAppStore((s: AppState) => s.viewMode)
  const navigateToView = useAppStore((s: AppState) => s.navigateToView)
  const isSearchPanelOpen = useAppStore((s: AppState) => s.isSearchPanelOpen)
  const toggleSearchPanelInStore = useAppStore((s: AppState) => s.toggleSearchPanel)
  const setFocusedSol = useAppStore((s: AppState) => s.setFocusedSol)

  // Track previous drive count to detect when drives are first selected
  const prevDriveCountRef = useRef(0);

  // Handle view mode changes based on drive selection
  useEffect(() => {
    const currentDriveCount = driveState.selectedDrives.length;
    const prevDriveCount = prevDriveCountRef.current;

    // Only trigger when the number of drives changes
    if (prevDriveCount !== currentDriveCount) {
      if (currentDriveCount > prevDriveCount) {
        // Whenever a new drive is added, switch to drives view
        navigateToView('drives');
        driveState.setSegmentSelectionMode('none');
      } else if (currentDriveCount === 0) {
        // When drives go from 1+ to 0, switch to map view
        navigateToView('map');
      }
    }

    // Update the ref with current count
    prevDriveCountRef.current = currentDriveCount;
  }, [driveState.selectedDrives.length, navigateToView]);

  // Set up global alert function for segment selection
  useEffect(() => {
    window.showSegmentAlert = (message: string) => {
      showAlert('Invalid Selection', message, 'warning');
    };

    return () => {
      delete window.showSegmentAlert;
    };
  }, [showAlert]);

  const toggleSearchPanel = () => {
    toggleSearchPanelInStore()
  }
  return (
    <>
      <div className="h-screen w-full relative overflow-hidden bg-white dark:bg-stellar-dark-background">
        {/* Search Panel - Overlay, slides in/out without resizing contents */}
        <div
          className={`absolute top-0 left-0 h-full w-96 bg-white dark:bg-stellar-dark-surface bg-opacity-95 dark:bg-opacity-95 shadow-lg overflow-y-auto transform transition-transform duration-300 ease-in-out z-20 ${isSearchPanelOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}`}
        >
          <SearchPanel />
        </div>
        {/* Layout row: spacer (affects layout) + main content */}
        <div className="h-full w-full flex">
          {/* Spacer controls page resizing without touching panel internals */}
          <div className={`transition-[width] duration-300 ease-in-out ${isSearchPanelOpen ? 'w-96' : 'w-0'}`} />
          {/* Main Content Area - Fills remaining space */}
          <div className="flex-1 relative">
            {/* Top-right toolbar: GoToSol + Settings + Share + View Toggle */}
            <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 9999 }}>
              <GoToSolButton
                mode={viewMode}
                onSolFocus={(sol) => setFocusedSol(sol)}
                onAddDrive={(sol) => driveState.toggleDriveSelection(sol)}
              />
              {/* <SettingsButton /> */}
              <div className="bg-white dark:bg-stellar-dark-surface rounded-full shadow-md p-1">
                <div className="flex">
                  <button
                    className={`p-2 rounded-full ${viewMode === 'map' ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black' : 'text-gray-600 dark:text-stellar-dark-text-secondary hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated'}`}
                    onClick={() => navigateToView('map')}
                    title="Map View"
                  >
                    <MapIcon className="h-6 w-6" />
                  </button>
                  <button
                    className={`p-2 rounded-full ${viewMode === 'drives' ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black' : 'text-gray-600 dark:text-stellar-dark-text-secondary hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated'}`}
                    onClick={() => navigateToView('drives')}
                    title="Drives View"
                  >
                    <SquareStackIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>


            {/* Main View Area - Both views preserved in DOM */}
            <div className="w-full h-full relative">
              {/* Map View - Always rendered, shown/hidden via CSS */}
              <div
                className={`absolute inset-0 ${viewMode === 'map' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <FullMapView enableSegmentSelection={similarityMode === 'segment'} />
              </div>

              {/* Drive Multi Compare View - Always rendered, shown/hidden via CSS */}
              <div
                className={`absolute inset-0 ${viewMode === 'drives' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <DriveComparisonView />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={hideAlert}
        title={alert.title}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route
            path="/hindsight/:view"
            element={
              <RouterWrapper>
                <AppContent />
              </RouterWrapper>
            }
          />
          <Route
            path="/hindsight"
            element={<Navigate to="/hindsight/map" replace />}
          />
          <Route
            path="/"
            element={<Navigate to="/hindsight/map" replace />}
          />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}
