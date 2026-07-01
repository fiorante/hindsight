import type { StateCreator } from 'zustand';
import type { AppState } from '../state/store';
import { createDebouncedUrlSync } from '../state/urlSlice';

/**
 * Middleware that automatically syncs state changes to the URL
 */
export const urlSyncMiddleware = <T extends AppState>(
  config: StateCreator<T, [], [], T>
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    // Create debounced sync function
    let debouncedSync: (() => void) | null = null;
    let lastUrlState: string | null = null;

    const wrappedSet: typeof set = (...args) => {
      // Apply the state change first
      set(...args);

      // Initialize debounced sync if not already done
      if (!debouncedSync) {
        debouncedSync = createDebouncedUrlSync(() => {
          const state = get();
          if (state.syncToUrl) {
            // Check if URL state actually changed to prevent unnecessary updates
            const drivePositionsStr = state.drivePositions && state.selectedDrives ?
              Object.entries(state.drivePositions)
                .filter(([id, pos]) => pos !== null && state.selectedDrives.includes(id))
                .map(([id, pos]) => `${id}:${pos}`)
                .join(',') : '';
            const currentUrlState = `${state.viewMode || 'map'}-${state.focusedSol || ''}-${state.selectedDrives.join(',')}-${state.searchMode || ''}-${drivePositionsStr}`;
            if (currentUrlState !== lastUrlState) {
              state.syncToUrl();
              lastUrlState = currentUrlState;
            }
          }
        }, 200); // Reduced debounce time for better responsiveness
      }

      // Trigger URL sync after state change
      const state = get();
      if (!state.isUpdatingFromUrl && !state.skipNextUrlSync && !state.isHydrating) {
        debouncedSync();
      }
    };

    return config(wrappedSet, get, api);
  };
};
