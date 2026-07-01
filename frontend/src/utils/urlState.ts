import type { AppState } from '../state/store';
import type { UIFilter, ParameterFilter } from '../types';

const DEFAULT_SOL_NUMBER = '1041';

// URL parameter keys
export const URL_PARAMS = {
  // View and navigation
  VIEW: 'view',
  SOL: 'sol',

  // Search parameters
  SEARCH_MODE: 'searchMode',
  SIMILARITY_MODE: 'simMode',
  REFERENCE_SOL: 'ref',
  FILTERS: 'filters',
  PARAM_FILTERS: 'params',

  // Drive selection
  DRIVES: 'drives',

  // Map state
  LAT: 'lat',
  LNG: 'lng',
  ZOOM: 'zoom',

  // Timeline
  POSITION: 'pos',
  TIMELINE_EXPANDED: 'timeline',
  TIMELINE_SPEED: 'speed',

  // Panel configuration
  CHARTS: 'charts',
  SEARCH_PANEL_OPEN: 'searchPanel',
  VCE_MODE: 'vce',
  PDI_MODE: 'pdi',
  FAULT_OVERLAY: 'faults',
  SYNC_PANELS: 'sync',

  // Search results (for restoration)
  SEARCH_RESULTS: 'results',
  // Drive positions
  DRIVE_POSITIONS: 'drivePositions',
} as const;

export interface DeepLinkState {
  // Core view state
  viewMode?: 'map' | 'drives';
  focusedSol?: string;

  // Search state
  searchMode?: 'similarity' | 'parameter';
  similarityMode?: 'sol' | 'plan' | 'segment';
  solNumber?: string;
  filters?: UIFilter[];
  parameterFilters?: ParameterFilter[];
  searchResults?: Array<{ sol: number; similarity_score: number }>;

  // Drive selection
  selectedDrives?: string[];

  // Map state
  mapViewport?: {
    lat: number;
    lng: number;
    zoom: number;
  };

  // Timeline state
  timelinePosition?: number;
  timelineExpanded?: boolean;
  timelineSpeed?: number;
  drivePositions?: Record<string, number | null>;

  // Panel configuration
  activeCharts?: string[];
  isSearchPanelOpen?: boolean;
  vceImageSideMode?: 'left' | 'both' | 'right';
  pdiImageSideMode?: 'left' | 'both' | 'right';
  faultOverlayEnabled?: boolean;
  syncDrivePanels?: boolean;
}

/**
 * Serialize application state to URL parameters
 */
export function serializeStateToUrl(state: AppState): URLSearchParams {
  const params = new URLSearchParams();

  // View mode - always include as it determines the route
  if (state.viewMode) {
    params.set(URL_PARAMS.VIEW, state.viewMode);
  }

  // Focused sol
  if (state.focusedSol) {
    params.set(URL_PARAMS.SOL, state.focusedSol);
  }

  // Search state - only include if not default values
  if (state.searchMode !== 'similarity') {
    params.set(URL_PARAMS.SEARCH_MODE, state.searchMode);
  }
  if (state.similarityMode !== 'sol') {
    params.set(URL_PARAMS.SIMILARITY_MODE, state.similarityMode);
  }
  if (state.solNumber !== DEFAULT_SOL_NUMBER) {
    params.set(URL_PARAMS.REFERENCE_SOL, state.solNumber);
  }

  // Filters
  if (state.filters && state.filters.length > 0) {
    const activeFilters = state.filters.filter(f => f.active).map(f => f.type);
    if (activeFilters.length > 0) {
      params.set(URL_PARAMS.FILTERS, activeFilters.join(','));
    }
  }

  // Parameter filters
  if (state.parameterFilters && state.parameterFilters.length > 0) {
    const paramStrings = state.parameterFilters.map(pf => {
      if (pf.value !== undefined) {
        return `${pf.parameter}:${pf.value}`;
      } else if (pf.min !== undefined && pf.max !== undefined) {
        return `${pf.parameter}:${pf.min}-${pf.max}`;
      }
      return null;
    }).filter(Boolean);

    if (paramStrings.length > 0) {
      params.set(URL_PARAMS.PARAM_FILTERS, paramStrings.join(','));
    }
  }

  // Drive selection
  if (state.selectedDrives && state.selectedDrives.length > 0) {
    params.set(URL_PARAMS.DRIVES, state.selectedDrives.join(','));
  }

  // Timeline state - only include if not default
  if (state.position !== null) {
    params.set(URL_PARAMS.POSITION, state.position.toString());
  }
  if (state.timelineExpanded !== true) {
    params.set(URL_PARAMS.TIMELINE_EXPANDED, state.timelineExpanded.toString());
  }
  if (state.timelineSpeed !== 60) {
    params.set(URL_PARAMS.TIMELINE_SPEED, state.timelineSpeed.toString());
  }

  // Drive positions - only include positions for currently open drive panels
  if (state.drivePositions && state.selectedDrives && Object.keys(state.drivePositions).length > 0) {
    const positions = Object.entries(state.drivePositions)
      .filter(([driveId, pos]) =>
        pos !== null &&
        state.selectedDrives.includes(driveId)
      )
      .map(([driveId, pos]) => `${driveId}:${pos}`)
      .join(',');
    if (positions) {
      params.set(URL_PARAMS.DRIVE_POSITIONS, positions);
    }
  }

  // Panel configuration - only include if not default
  if (state.activeCharts && state.activeCharts.length > 0) {
    params.set(URL_PARAMS.CHARTS, state.activeCharts.join(','));
  }
  if (state.isSearchPanelOpen !== true) {
    params.set(URL_PARAMS.SEARCH_PANEL_OPEN, state.isSearchPanelOpen.toString());
  }
  if (state.vceImageSideMode !== 'both') {
    params.set(URL_PARAMS.VCE_MODE, state.vceImageSideMode);
  }
  if (state.pdiImageSideMode !== 'both') {
    params.set(URL_PARAMS.PDI_MODE, state.pdiImageSideMode);
  }
  if (state.faultOverlayEnabled !== false) {
    params.set(URL_PARAMS.FAULT_OVERLAY, state.faultOverlayEnabled.toString());
  }
  if (state.syncDrivePanels !== true) {
    params.set(URL_PARAMS.SYNC_PANELS, state.syncDrivePanels.toString());
  }

  // Search results for restoration (compressed format)
  if (state.searchResults && state.searchResults.length > 0) {
    const resultsString = state.searchResults
      .slice(0, 10) // Limit to prevent URL length issues
      .map(r => `${r.sol}:${r.similarity_score.toFixed(2)}`)
      .join(',');
    params.set(URL_PARAMS.SEARCH_RESULTS, resultsString);
  }

  return params;
}

/**
 * Deserialize URL parameters to application state
 */
export function deserializeStateFromUrl(params: URLSearchParams): Partial<DeepLinkState> {
  const state: Partial<DeepLinkState> = {};

  // View mode
  const viewMode = params.get(URL_PARAMS.VIEW) as 'map' | 'drives';
  if (viewMode && ['map', 'drives'].includes(viewMode)) {
    state.viewMode = viewMode;
  }

  // Focused sol
  const focusedSol = params.get(URL_PARAMS.SOL);
  if (focusedSol) {
    state.focusedSol = focusedSol;
  }

  // Search state
  const searchMode = params.get(URL_PARAMS.SEARCH_MODE) as 'similarity' | 'parameter';
  if (searchMode && ['similarity', 'parameter'].includes(searchMode)) {
    state.searchMode = searchMode;
  }

  const similarityMode = params.get(URL_PARAMS.SIMILARITY_MODE) as 'sol' | 'plan' | 'segment';
  if (similarityMode && ['sol', 'plan', 'segment'].includes(similarityMode)) {
    state.similarityMode = similarityMode;
  }

  const referenceSol = params.get(URL_PARAMS.REFERENCE_SOL);
  if (referenceSol) {
    state.solNumber = referenceSol;
  }

  // Filters
  const filtersParam = params.get(URL_PARAMS.FILTERS);
  if (filtersParam) {
    const filterTypes = filtersParam.split(',').filter(Boolean);
    state.filters = filterTypes.map(type => ({ type: type.toLowerCase(), active: true }));
  }

  // Parameter filters
  const paramFiltersParam = params.get(URL_PARAMS.PARAM_FILTERS);
  if (paramFiltersParam) {
    const paramFilters = paramFiltersParam.split(',').map(paramString => {
      const [parameter, valueRange] = paramString.split(':');
      if (valueRange.includes('-')) {
        const [min, max] = valueRange.split('-');
        return {
          parameter: parameter.toLowerCase(),
          min,
          max,
        };
      } else {
        return {
          parameter: parameter.toLowerCase(),
          value: valueRange,
        };
      }
    }).filter(Boolean);
    state.parameterFilters = paramFilters;
  }

  // Drive selection
  const drivesParam = params.get(URL_PARAMS.DRIVES);
  if (drivesParam) {
    state.selectedDrives = drivesParam.split(',').filter(Boolean);
  }

  // Map viewport
  const lat = params.get(URL_PARAMS.LAT);
  const lng = params.get(URL_PARAMS.LNG);
  const zoom = params.get(URL_PARAMS.ZOOM);
  if (lat && lng && zoom) {
    state.mapViewport = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zoom: parseInt(zoom, 10),
    };
  }

  // Timeline state
  const position = params.get(URL_PARAMS.POSITION);
  if (position) {
    state.timelinePosition = parseFloat(position);
  }

  const timelineExpanded = params.get(URL_PARAMS.TIMELINE_EXPANDED);
  if (timelineExpanded) {
    state.timelineExpanded = timelineExpanded === 'true';
  }

  const timelineSpeed = params.get(URL_PARAMS.TIMELINE_SPEED);
  if (timelineSpeed) {
    state.timelineSpeed = parseInt(timelineSpeed, 10);
  }

  // Drive positions
  const drivePositionsParam = params.get(URL_PARAMS.DRIVE_POSITIONS);
  if (drivePositionsParam) {
    const positions: Record<string, number | null> = {};
    drivePositionsParam.split(',').forEach(posString => {
      const [driveId, pos] = posString.split(':');
      if (driveId && pos) {
        const position = parseFloat(pos);
        if (!isNaN(position)) {
          positions[driveId] = position;
        }
      }
    });
    if (Object.keys(positions).length > 0) {
      state.drivePositions = positions;
    }
  }

  // Panel configuration
  const charts = params.get(URL_PARAMS.CHARTS);
  if (charts) {
    state.activeCharts = charts.split(',').filter(Boolean);
  }

  const searchPanelOpen = params.get(URL_PARAMS.SEARCH_PANEL_OPEN);
  if (searchPanelOpen) {
    state.isSearchPanelOpen = searchPanelOpen === 'true';
  }

  const vceMode = params.get(URL_PARAMS.VCE_MODE) as 'left' | 'both' | 'right';
  if (vceMode && ['left', 'both', 'right'].includes(vceMode)) {
    state.vceImageSideMode = vceMode;
  }

  const pdiMode = params.get(URL_PARAMS.PDI_MODE) as 'left' | 'both' | 'right';
  if (pdiMode && ['left', 'both', 'right'].includes(pdiMode)) {
    state.pdiImageSideMode = pdiMode;
  }

  const faultOverlay = params.get(URL_PARAMS.FAULT_OVERLAY);
  if (faultOverlay) {
    state.faultOverlayEnabled = faultOverlay === 'true';
  }

  const syncPanels = params.get(URL_PARAMS.SYNC_PANELS);
  if (syncPanels) {
    state.syncDrivePanels = syncPanels === 'true';
  }

  // Search results restoration
  const searchResults = params.get(URL_PARAMS.SEARCH_RESULTS);
  if (searchResults) {
    const results = searchResults.split(',').map(resultString => {
      const [sol, score] = resultString.split(':');
      return {
        sol: parseInt(sol, 10),
        similarity_score: parseFloat(score),
      };
    }).filter(r => !isNaN(r.sol) && !isNaN(r.similarity_score));

    if (results.length > 0) {
      state.searchResults = results;
    }
  }

  return state;
}

/**
 * Validate URL parameters and provide error messages
 */
export function validateUrlParams(params: URLSearchParams): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate view mode
  const viewMode = params.get(URL_PARAMS.VIEW);
  if (viewMode && !['map', 'drives'].includes(viewMode)) {
    errors.push(`Invalid view mode: ${viewMode}`);
  }

  // Validate sol numbers
  const focusedSol = params.get(URL_PARAMS.SOL);
  if (focusedSol && (isNaN(parseInt(focusedSol, 10)) || parseInt(focusedSol, 10) < 0)) {
    errors.push(`Invalid sol number: ${focusedSol}`);
  }

  const referenceSol = params.get(URL_PARAMS.REFERENCE_SOL);
  if (referenceSol && (isNaN(parseInt(referenceSol, 10)) || parseInt(referenceSol, 10) < 0)) {
    errors.push(`Invalid reference sol: ${referenceSol}`);
  }

  // Validate coordinates
  const lat = params.get(URL_PARAMS.LAT);
  const lng = params.get(URL_PARAMS.LNG);
  const zoom = params.get(URL_PARAMS.ZOOM);

  if (lat && (isNaN(parseFloat(lat)) || parseFloat(lat) < -90 || parseFloat(lat) > 90)) {
    errors.push(`Invalid latitude: ${lat}`);
  }
  if (lng && (isNaN(parseFloat(lng)) || parseFloat(lng) < -180 || parseFloat(lng) > 180)) {
    errors.push(`Invalid longitude: ${lng}`);
  }
  if (zoom && (isNaN(parseInt(zoom, 10)) || parseInt(zoom, 10) < 0 || parseInt(zoom, 10) > 20)) {
    errors.push(`Invalid zoom level: ${zoom}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a shareable URL from current state
 */
export function generateShareableUrl(state: AppState, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  const params = serializeStateToUrl(state);

  // Remove unnecessary parameters for sharing
  const shareParams = new URLSearchParams();

  // Always include view mode
  if (params.has(URL_PARAMS.VIEW)) {
    shareParams.set(URL_PARAMS.VIEW, params.get(URL_PARAMS.VIEW)!);
  }

  // Include key parameters based on view
  const viewMode = params.get(URL_PARAMS.VIEW);

  if (viewMode === 'drives') {
    // For drives view, include drive selection and charts
    if (params.has(URL_PARAMS.DRIVES)) {
      shareParams.set(URL_PARAMS.DRIVES, params.get(URL_PARAMS.DRIVES)!);
    }
    if (params.has(URL_PARAMS.CHARTS)) {
      shareParams.set(URL_PARAMS.CHARTS, params.get(URL_PARAMS.CHARTS)!);
    }
    if (params.has(URL_PARAMS.POSITION)) {
      shareParams.set(URL_PARAMS.POSITION, params.get(URL_PARAMS.POSITION)!);
    }
  } else {
    // For map view, include map state and focused sol
    if (params.has(URL_PARAMS.SOL)) {
      shareParams.set(URL_PARAMS.SOL, params.get(URL_PARAMS.SOL)!);
    }
    if (params.has(URL_PARAMS.LAT) && params.has(URL_PARAMS.LNG) && params.has(URL_PARAMS.ZOOM)) {
      shareParams.set(URL_PARAMS.LAT, params.get(URL_PARAMS.LAT)!);
      shareParams.set(URL_PARAMS.LNG, params.get(URL_PARAMS.LNG)!);
      shareParams.set(URL_PARAMS.ZOOM, params.get(URL_PARAMS.ZOOM)!);
    }
  }

  // Always include search state if present
  if (params.has(URL_PARAMS.SEARCH_MODE)) {
    shareParams.set(URL_PARAMS.SEARCH_MODE, params.get(URL_PARAMS.SEARCH_MODE)!);
  }
  if (params.has(URL_PARAMS.REFERENCE_SOL)) {
    shareParams.set(URL_PARAMS.REFERENCE_SOL, params.get(URL_PARAMS.REFERENCE_SOL)!);
  }
  if (params.has(URL_PARAMS.FILTERS)) {
    shareParams.set(URL_PARAMS.FILTERS, params.get(URL_PARAMS.FILTERS)!);
  }
  if (params.has(URL_PARAMS.PARAM_FILTERS)) {
    shareParams.set(URL_PARAMS.PARAM_FILTERS, params.get(URL_PARAMS.PARAM_FILTERS)!);
  }
  if (params.has(URL_PARAMS.SEARCH_RESULTS)) {
    shareParams.set(URL_PARAMS.SEARCH_RESULTS, params.get(URL_PARAMS.SEARCH_RESULTS)!);
  }
  if (params.has(URL_PARAMS.DRIVE_POSITIONS)) {
    shareParams.set(URL_PARAMS.DRIVE_POSITIONS, params.get(URL_PARAMS.DRIVE_POSITIONS)!);
  }

  const queryString = shareParams.toString();
  return `${base}/hindsight/${viewMode || 'map'}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Create a clean URL by removing temporary/session-specific parameters
 */
export function cleanUrl(url: string): string {
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);

  // Remove session-specific parameters
  const sessionParams = [
    URL_PARAMS.SEARCH_PANEL_OPEN,
    URL_PARAMS.TIMELINE_EXPANDED,
  ];

  sessionParams.forEach(param => params.delete(param));

  urlObj.search = params.toString();
  return urlObj.toString();
}
