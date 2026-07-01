import type { DeepLinkState } from '../utils/urlState';
import { serializeStateToUrl, deserializeStateFromUrl, generateShareableUrl } from '../utils/urlState';

// Type for the navigate function from useNavigate
type NavigateFunction = ReturnType<typeof import('react-router-dom').useNavigate>;

export interface UrlState {
  // State tracking
  isHydrating: boolean;
  urlState: DeepLinkState | null;
  navigate: NavigateFunction | null;

  // URL sync control
  skipNextUrlSync: boolean;
  isUpdatingFromUrl: boolean;
}

export interface UrlActions {
  // Router integration
  setNavigate: (navigate: NavigateFunction) => void;

  // State hydration
  hydrateFromUrl: (searchParams: URLSearchParams) => void;
  finishHydration: () => void;

  // URL synchronization
  syncToUrl: () => void;
  skipNextSync: () => void;
  setUpdatingFromUrl: (updating: boolean) => void;

  // Sharing
  generateShareableUrl: () => string;
  copyUrlToClipboard: () => Promise<boolean>;

  // Navigation helpers
  navigateToView: (view: 'map' | 'drives', preserveState?: boolean) => void;
  navigateToSol: (sol: string, view?: 'map' | 'drives') => void;

  // URL management
  updateUrlWithoutNavigation: (path: string, search?: string) => void;
}

export type UrlSlice = UrlState & UrlActions;

// Default URL state
export const defaultUrlState: UrlState = {
  isHydrating: false,
  urlState: null,
  navigate: null,
  skipNextUrlSync: false,
  isUpdatingFromUrl: false,
};

// URL slice factory function
export const createUrlSlice = (set: any, get: any): UrlSlice => ({
  ...defaultUrlState,

  // Router integration
  setNavigate: (navigate) => set({ navigate }),

  // State hydration
  hydrateFromUrl: (searchParams) => {
    const urlState = deserializeStateFromUrl(searchParams);
    set({
      isHydrating: true,
      urlState,
      isUpdatingFromUrl: true
    });

    // Apply the URL state to the store
    const currentState = get();
    const updates: any = {};

    // Apply view mode
    if (urlState.viewMode !== undefined) {
      updates.viewMode = urlState.viewMode;
    }

    // Apply focused sol
    if (urlState.focusedSol !== undefined) {
      updates.focusedSol = urlState.focusedSol;
    }

    // Apply search state
    if (urlState.searchMode !== undefined) {
      updates.searchMode = urlState.searchMode;
    }
    if (urlState.similarityMode !== undefined) {
      updates.similarityMode = urlState.similarityMode;
    }
    if (urlState.solNumber !== undefined) {
      updates.solNumber = urlState.solNumber;
    }
    if (urlState.filters !== undefined) {
      updates.filters = urlState.filters;
    }
    if (urlState.parameterFilters !== undefined) {
      updates.parameterFilters = urlState.parameterFilters;
    }
    if (urlState.searchResults !== undefined) {
      updates.searchResults = urlState.searchResults;
    }

    // Set lastSearchParameters based on filters and parameter filters
    const searchParamList: string[] = [];
    if (urlState.filters) {
      searchParamList.push(...urlState.filters.map(f => f.type));
    }
    if (urlState.parameterFilters) {
      searchParamList.push(...urlState.parameterFilters.map(pf => pf.parameter));
    }
    if (searchParamList.length > 0) {
      updates.lastSearchParameters = searchParamList;
    }

    // Apply drive selection
    if (urlState.selectedDrives !== undefined) {
      updates.selectedDrives = urlState.selectedDrives;
    }

    // Apply timeline state
    if (urlState.timelinePosition !== undefined) {
      updates.position = urlState.timelinePosition;
    }
    if (urlState.timelineExpanded !== undefined) {
      updates.timelineExpanded = urlState.timelineExpanded;
    }
    if (urlState.timelineSpeed !== undefined) {
      updates.timelineSpeed = urlState.timelineSpeed;
    }
    if (urlState.drivePositions !== undefined) {
      updates.drivePositions = urlState.drivePositions;
    }

    // Apply panel configuration
    if (urlState.activeCharts !== undefined) {
      updates.activeCharts = urlState.activeCharts;
    }
    if (urlState.isSearchPanelOpen !== undefined) {
      updates.isSearchPanelOpen = urlState.isSearchPanelOpen;
    }
    if (urlState.vceImageSideMode !== undefined) {
      updates.vceImageSideMode = urlState.vceImageSideMode;
    }
    if (urlState.pdiImageSideMode !== undefined) {
      updates.pdiImageSideMode = urlState.pdiImageSideMode;
    }
    if (urlState.faultOverlayEnabled !== undefined) {
      updates.faultOverlayEnabled = urlState.faultOverlayEnabled;
    }
    if (urlState.syncDrivePanels !== undefined) {
      updates.syncDrivePanels = urlState.syncDrivePanels;
    }

    // Apply updates if there are any
    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  finishHydration: () => set({
    isHydrating: false,
    isUpdatingFromUrl: false
  }),

  // URL synchronization
  syncToUrl: () => {
    const state = get();

    // Don't sync if we're in the middle of hydrating or if we should skip
    if (state.isHydrating || state.skipNextUrlSync || state.isUpdatingFromUrl) {
      if (state.skipNextUrlSync) {
        set({ skipNextUrlSync: false });
      }
      return;
    }

    try {
      const params = serializeStateToUrl(state);
      const viewMode = state.viewMode || 'map';
      const search = params.toString();

      // Update URL without triggering navigation/re-renders
      const path = `/hindsight/${viewMode}`;
      const fullUrl = search ? `${path}?${search}` : path;

      // Only update if the URL actually changed
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const currentUrl = `${currentPath}${currentSearch}`;

      if (fullUrl !== currentUrl) {
        // Use history.replaceState to update URL without navigation
        window.history.replaceState(null, '', fullUrl);

        // Dispatch a custom event to notify components that URL changed
        // This allows components to react to URL changes without full re-renders
        window.dispatchEvent(new CustomEvent('urlStateChanged', {
          detail: { url: fullUrl, state }
        }));
      }
    } catch (error) {
      console.error('Error syncing state to URL:', error);
    }
  },

  skipNextSync: () => set({ skipNextUrlSync: true }),

  setUpdatingFromUrl: (updating) => set({ isUpdatingFromUrl: updating }),

  // Sharing
  generateShareableUrl: () => {
    const state = get();
    return generateShareableUrl(state);
  },

  copyUrlToClipboard: async () => {
    try {
      const state = get();
      const shareableUrl = generateShareableUrl(state);
      await navigator.clipboard.writeText(shareableUrl);
      return true;
    } catch (error) {
      console.error('Failed to copy URL to clipboard:', error);
      return false;
    }
  },

  // Navigation helpers
  navigateToView: (view, preserveState = true) => {
    const state = get();

    if (preserveState) {
      // Update view mode and let syncToUrl handle the URL update
      set({ viewMode: view });
    } else {
      // Direct navigation without preserving other state
      if (state.navigate) {
        state.navigate(`/hindsight/${view}`, { replace: true });
      } else {
        // Fallback to history API if navigate is not available
        window.history.replaceState(null, '', `/hindsight/${view}`);
      }
    }
  },

  navigateToSol: (sol, view) => {
    const state = get();

    const targetView = view || state.viewMode || 'map';
    set({
      focusedSol: sol,
      viewMode: targetView
    });
  },

  // URL management
  updateUrlWithoutNavigation: (path, search) => {
    const url = search ? `${path}?${search}` : path;
    window.history.replaceState(null, '', url);
  },
});

// Utility function to debounce URL updates
export function createDebouncedUrlSync(syncFn: () => void, delay = 200) {
  let timeoutId: number | null = null;
  let lastCallTime = 0;

  return () => {
    const now = Date.now();

    // If called too frequently, extend the timeout
    if (now - lastCallTime < 50) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        syncFn();
        timeoutId = null;
        lastCallTime = Date.now();
      }, delay);
    } else {
      // Normal debounce behavior
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        syncFn();
        timeoutId = null;
        lastCallTime = Date.now();
      }, delay);
    }
  };
}
