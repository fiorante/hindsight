import type { UIFilter, ParameterFilter, SimilarityResult } from '../types';

export type SearchMode = 'similarity' | 'parameter';
export type SimilarityMode = 'sol' | 'plan' | 'segment';

export type DriveSearchResult =
  | SimilarityResult
  | {
    sol: number;
    similarity_score: number;
    distance?: number;
    duration?: number;
    point_count?: number;
  };

export interface SearchState {
  // Search configuration
  searchMode: SearchMode;
  similarityMode: SimilarityMode;
  solNumber: string;

  // Filters
  filters: UIFilter[];
  parameterFilters: ParameterFilter[];

  // Search execution state
  isSearching: boolean;
  lastSearchParameters: string[];

  // Search results (moved from DriveSlice)
  searchResults: DriveSearchResult[];
}

export interface SearchActions {
  // Mode management
  setSearchMode: (mode: SearchMode) => void;
  setSimilarityMode: (mode: SimilarityMode) => void;
  setSolNumber: (sol: string) => void;

  // Filter management
  setFilters: (filters: UIFilter[]) => void;
  addFilter: (type: string) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;

  setParameterFilters: (filters: ParameterFilter[]) => void;
  addParameterFilter: (filter: ParameterFilter) => void;
  removeParameterFilter: (index: number) => void;
  updateParameterFilter: (index: number, filter: ParameterFilter) => void;
  clearParameterFilters: () => void;

  // Search execution
  setIsSearching: (isSearching: boolean) => void;
  setLastSearchParameters: (params: string[]) => void;
  setSearchResults: (results: DriveSearchResult[]) => void;

  // Helper methods
  getActiveFilters: () => UIFilter[];
  hasActiveFilters: () => boolean;
  canExecuteSearch: () => boolean;
  resetSearchState: () => void;
}

export type SearchSlice = SearchState & SearchActions;

// Default search state
export const defaultSearchState: SearchState = {
  searchMode: 'similarity',
  similarityMode: 'sol',
  solNumber: '1041',
  filters: [],
  parameterFilters: [],
  isSearching: false,
  lastSearchParameters: [],
  searchResults: [],
};

// Search slice factory function
export const createSearchSlice = (set: any, get: any): SearchSlice => ({
  ...defaultSearchState,

  // Mode management
  setSearchMode: (mode) => set({ searchMode: mode }),
  setSimilarityMode: (mode) => set({ similarityMode: mode }),
  setSolNumber: (sol) => set({ solNumber: sol }),

  // Filter management
  setFilters: (filters) => set({ filters }),
  addFilter: (type: string) => set((s: SearchSlice) => ({
    filters: [...s.filters, { type, active: true }]
  })),
  removeFilter: (index: number) => set((s: SearchSlice) => {
    const newFilters = [...s.filters];
    newFilters.splice(index, 1);
    return { filters: newFilters };
  }),
  clearFilters: () => set({ filters: [] }),

  setParameterFilters: (filters) => set({ parameterFilters: filters }),
  addParameterFilter: (filter: ParameterFilter) => set((s: SearchSlice) => ({
    parameterFilters: [...s.parameterFilters, filter]
  })),
  removeParameterFilter: (index: number) => set((s: SearchSlice) => {
    const newFilters = [...s.parameterFilters];
    newFilters.splice(index, 1);
    return { parameterFilters: newFilters };
  }),
  updateParameterFilter: (index: number, filter: ParameterFilter) => set((s: SearchSlice) => {
    const updatedFilters = [...s.parameterFilters];
    updatedFilters[index] = filter;
    return { parameterFilters: updatedFilters };
  }),
  clearParameterFilters: () => set({ parameterFilters: [] }),

  // Search execution
  setIsSearching: (isSearching) => set({ isSearching }),
  setLastSearchParameters: (params) => set({ lastSearchParameters: params }),
  setSearchResults: (results) => set({ searchResults: results }),

  // Helper methods
  getActiveFilters: () => get().filters.filter((f: UIFilter) => f.active),
  hasActiveFilters: () => get().getActiveFilters().length > 0,
  canExecuteSearch: () => {
    const state = get() as SearchSlice;
    if (state.searchMode === 'parameter') {
      return state.parameterFilters.length > 0;
    } else if (state.searchMode === 'similarity') {
      return state.hasActiveFilters();
    }
    return false;
  },
  resetSearchState: () => set({
    ...defaultSearchState,
    // Keep search mode and sol number as they are user preferences
    searchMode: get().searchMode,
    solNumber: get().solNumber,
  }),
});
