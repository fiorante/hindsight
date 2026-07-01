import React, { useEffect, useState } from 'react'
import {
  PlusCircleIcon,
  MapIcon,
  ImportIcon,
  TrashIcon,
  EditIcon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext';
import { SearchResults } from './SearchResults';
import { ParameterSelector } from '../ui/ParameterSelector';
import type { FilterMode, FilterValue } from '../ui/ParameterSelector';
import { ParameterChip } from '../ui/ParameterChip';
import { useDriveState } from '../providers/DriveStateProvider';
import { AlertDialog } from '../ui/AlertDialog';
import { useAlert } from '../../hooks/useAlert';
import type { SimilarityResult, ParameterFilter, UIFilter } from '../../types';
import { useAppStore, type AppState } from '../../state/store';
import { useSearch } from '../../hooks/useSearch';

// Non-range parameters that use value instead of min/max
const NON_RANGE_PARAMETERS = [
  'TERRAIN', 'FAULT'
];

// Helper function to determine if a parameter is non-range
const isNonRangeParameter = (parameter: string): boolean => {
  return NON_RANGE_PARAMETERS.includes(parameter);
};

export const SearchPanel: React.FC = () => {
  const driveState = useDriveState();
  const setSegmentSelectionMode = driveState.setSegmentSelectionMode;
  const { alert, showAlert, hideAlert } = useAlert();
  const { isDarkMode } = useTheme();
  const searchMode = useAppStore((s: AppState) => s.searchMode)
  const setSearchMode = useAppStore((s: AppState) => s.setSearchMode)
  const similarityMode = useAppStore((s: AppState) => s.similarityMode)
  const setSimilarityMode = useAppStore((s: AppState) => s.setSimilarityMode)
  const filters = useAppStore((s: AppState) => s.filters as UIFilter[])
  const setFilters = useAppStore((s: AppState) => s.setFilters)
  const addFilter = useAppStore((s: AppState) => s.addFilter)
  const removeFilter = useAppStore((s: AppState) => s.removeFilter)
  const clearFilters = useAppStore((s: AppState) => s.clearFilters)
  const solNumber = useAppStore((s: AppState) => s.solNumber)
  const setSolNumber = useAppStore((s: AppState) => s.setSolNumber)
  const parameterFilters = useAppStore((s: AppState) => s.parameterFilters as ParameterFilter[])
  const setParameterFilters = useAppStore((s: AppState) => s.setParameterFilters)
  const setLastSearchParameters = useAppStore((s: AppState) => s.setLastSearchParameters)
  const setViewMode = useAppStore((s: AppState) => s.setViewMode)
  // selectedDrives and toggleDriveSelection are provided via SearchResults internally
  const searchResults = driveState.searchResults as SimilarityResult[]
  const { executeSimilaritySearch, executeParameterSearch, hasSearched } = useSearch();

  // ParameterSelector state
  const [parameterSelectorOpen, setParameterSelectorOpen] = useState(false);
  const [parameterSelectorMode, setParameterSelectorMode] = useState<FilterMode>('parameter-only');
  const [parameterSelectorPosition, setParameterSelectorPosition] = useState({
    top: 0,
    left: 0,
  });
  const [parameterSelectorInitialValue, setParameterSelectorInitialValue] = useState<FilterValue | undefined>(undefined);
  const [editingParameterSelectorIndex, setEditingParameterSelectorIndex] = useState<number | undefined>(undefined);


  // Handle clicks outside dropdowns
  useEffect(() => {
    if (similarityMode !== 'segment') {
      setSegmentSelectionMode('none');
    }
    // Only re-run when the mode changes or setter identity changes
  }, [similarityMode, setSegmentSelectionMode]);

  // Reset dropdowns when search mode changes
  useEffect(() => {
    setParameterSelectorOpen(false);
  }, [searchMode, similarityMode]);



  const removeParameterFilter = (index: number) => {
    const newFilters = [...parameterFilters];
    newFilters.splice(index, 1);
    setParameterFilters(newFilters);
  };

  const clearParameterFilters = () => {
    setParameterFilters([]);
  };
  // Determine if search button should be disabled based on current mode and state
  const isSearchDisabled = () => {
    if (searchMode === 'parameter') {
      // Parameter search: disabled when no parameter filters are present
      return parameterFilters.length === 0;
    } else if (searchMode === 'similarity') {
      if (similarityMode === 'sol') {
        // Sol mode: disabled when no filters are selected
        const activeFilters = filters.filter(f => f.active);
        return activeFilters.length === 0;
      } else if (similarityMode === 'segment') {
        // Segment mode: disabled when one or more markers is not yet selected OR no filters are selected
        const activeFilters = filters.filter(f => f.active);
        return !driveState.segmentStartMarker || !driveState.segmentEndMarker || activeFilters.length === 0;
      } else if (similarityMode === 'plan') {
        // Plan mode: always disabled for now
        return true;
      }
    }
    return false;
  };

  const handleSearch = async () => {
    if (searchMode === 'similarity') {
      const activeVariables = (filters as UIFilter[])
        .filter((f: UIFilter) => f.active)
        .map((f: UIFilter) => f.type);

      // Normalize to lowercase for storage/transit
      setLastSearchParameters(activeVariables.map(v => v.toLowerCase()))

      if (similarityMode === 'segment') {
        await executeSimilaritySearch('segment', activeVariables, {
          onSuccess: (results) => {
            driveState.setSearchResults(results);
          },
          onError: (error) => showAlert('Search Error', error, 'error'),
          segmentStartSclk: driveState.segmentStartMarker?.sclk,
          segmentEndSclk: driveState.segmentEndMarker?.sclk,
        });
      } else {
        await executeSimilaritySearch('sol', activeVariables, {
          onSuccess: (results) => {
            driveState.setSearchResults(results);
          },
          onError: (error) => showAlert('Search Error', error, 'error'),
          solNumber,
        });
      }
    } else if (searchMode === 'parameter') {
      // Normalize to lowercase for storage/transit
      setLastSearchParameters(parameterFilters.map((f) => f.parameter.toLowerCase()))
      await executeParameterSearch(parameterFilters, {
        onSuccess: (results) => {
          driveState.setSearchResults(results);
        },
        onError: (error) => showAlert('Search Error', error, 'error'),
      });
    }
  };
  const handleSelectStartMarker = () => {
    // Enable start marker selection mode
    driveState.setSegmentSelectionMode('start');
    // Switch to map view if not already visible
    if (setViewMode) {
      setViewMode('map');
    }
  }
  const handleSelectEndMarker = () => {
    // Enable end marker selection mode
    driveState.setSegmentSelectionMode('end');
    // Switch to map view if not already visible
    if (setViewMode) {
      setViewMode('map');
    }
  }

  const handlePlanDrawOnMap = () => {
    showAlert('Coming Soon', 'Plan-based similarity search with map drawing is coming soon!', 'info');
  }
  const handleFilterClick = (index: number, event?: React.MouseEvent) => {
    // Get position of the clicked filter or use default position.
    // Open the panel to the RIGHT of the trigger so it doesn't cover the search form.
    const rect = event
      ? (event.currentTarget as HTMLElement).getBoundingClientRect()
      : { top: 100, right: 100 } as DOMRect
    setParameterSelectorPosition({
      top: rect.top,
      left: rect.right + 8,
    })
    setParameterSelectorMode('parameter-only')
    setParameterSelectorInitialValue({
      parameter: filters[index].type.toUpperCase(),
      min: '',
      max: '',
    })
    setEditingParameterSelectorIndex(index)
    setParameterSelectorOpen(true)
  }
  const handleParamFilterClick = (index: number, event?: React.MouseEvent) => {
    const rect = event
      ? (event.currentTarget as HTMLElement).getBoundingClientRect()
      : { top: 100, right: 100 } as DOMRect
    setParameterSelectorPosition({
      top: rect.top,
      left: rect.right + 8,
    })
    setParameterSelectorMode('parameter-value')
    setParameterSelectorInitialValue({
      parameter: parameterFilters[index].parameter,
      min: parameterFilters[index].min || '',
      max: parameterFilters[index].max || '',
    })
    setEditingParameterSelectorIndex(index)
    setParameterSelectorOpen(true)
  }

  const handleAddFilterClick = (event: React.MouseEvent, mode: FilterMode) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setParameterSelectorPosition({
      top: rect.top,
      left: rect.right + 8,
    })
    setParameterSelectorMode(mode)
    setParameterSelectorInitialValue(undefined)
    setEditingParameterSelectorIndex(undefined)
    setParameterSelectorOpen(true)
  }

  const handleSelectParameter = (parameter: string) => {
    if (searchMode === 'similarity') {
      if (editingParameterSelectorIndex !== undefined) {
        // Update existing filter
        const newFilters = [...filters]
        newFilters[editingParameterSelectorIndex] = {
          type: parameter.toLowerCase(),
          active: true,
        }
        setFilters(newFilters)
      } else {
        // Add new filter
        addFilter(parameter.toLowerCase())
      }
    }
  }

  const handleSelectParameterValue = (parameter: string, min: string, max: string) => {
    // Add to parameter filters
    setParameterFilters([...parameterFilters, {
      parameter,
      value: min || max || '',
      min: min || undefined,
      max: max || undefined,
    }])
  }

  const handleUpdateParameterValue = (index: number, parameter: string, min: string, max: string) => {
    // Update existing parameter filter
    const updatedFilters = [...parameterFilters]
    updatedFilters[index] = {
      parameter,
      value: min || max || '',
      min: min || undefined,
      max: max || undefined,
    }
    setParameterFilters(updatedFilters)
  }

  return (
    <>
      <div className="h-full flex flex-col p-4">
        {/* Non-scrolling top part */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/hindsight_logo.png"
              alt="Hindsight Logo"
              className={`h-8 w-8 ${isDarkMode ? 'invert' : ''}`}
            />
            <h2 className="text-lg font-medium text-gray-900 dark:text-stellar-dark-text-primary">
              M2020 Hindsight
            </h2>
          </div>

          {/* Search Mode Selector */}
          <div className="mb-6">
            <div className="bg-white dark:bg-stellar-dark-surface rounded-full shadow-md flex items-center p-1 w-full dark:border-2 dark:border-stellar-dark-border">
              <div className="flex-1 flex">
                <button
                  className={`py-2 px-4 rounded-full flex-1 text-center font-medium text-sm ${searchMode === 'similarity' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-900 dark:text-stellar-dark-text-primary' : 'text-gray-500 dark:text-stellar-dark-text-secondary hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated'}`}
                  onClick={() => setSearchMode('similarity')}
                >
                  Similarity Search
                </button>
                <button
                  className={`py-2 px-4 rounded-full flex-1 text-center font-medium text-sm ${searchMode === 'parameter' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-900 dark:text-stellar-dark-text-primary' : 'text-gray-500 dark:text-stellar-dark-text-secondary hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated'}`}
                  onClick={() => setSearchMode('parameter')}
                >
                  Parameter Search
                </button>
              </div>
            </div>
          </div>

          {/* Parameter Search UI */}
          {searchMode === 'parameter' && (
            <div className="bg-gray-100 dark:bg-stellar-dark-surface-elevated rounded-2xl p-4 shadow-sm mb-4 border dark:border-stellar-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium">
                    Search by parameters
                  </span>
                </div>
                <button
                  onClick={clearParameterFilters}
                  className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary hover:text-gray-700 dark:hover:text-stellar-dark-text-primary border border-gray-300 dark:border-stellar-dark-border rounded px-2 py-0.5"
                >
                  Clear all
                </button>
              </div>

              <div className="flex flex-wrap gap-2 items-center mb-4">
                {parameterFilters.map((filter, index) => {
                  const isNonRange = isNonRangeParameter(filter.parameter);
                  // For non-range parameters, use value if available, otherwise fall back to min
                  const chipValue = isNonRange
                    ? (filter.value || filter.min || '')
                    : { min: filter.min, max: filter.max };



                  return (
                    <ParameterChip
                      key={index}
                      mode="parameter-value"
                      label={filter.parameter}
                      value={chipValue}
                      onEdit={(event) => handleParamFilterClick(index, event)}
                      onRemove={() => removeParameterFilter(index)}
                      className="edit-param-filter"
                    />
                  );
                })}

                <div className="relative">
                  <button
                    onClick={(e) => handleAddFilterClick(e, 'parameter-value')}
                    className="bg-white dark:bg-stellar-dark-surface rounded-full w-8 h-8 flex items-center justify-center shadow-sm parameter-button"
                  >
                    <PlusCircleIcon className="h-5 w-5 text-gray-500 dark:text-stellar-dark-text-secondary" />
                  </button>
                </div>
              </div>

              <button
                className={`w-full rounded-lg py-2 font-medium ${isSearchDisabled()
                  ? 'bg-gray-300 dark:bg-stellar-dark-surface text-gray-500 dark:text-stellar-dark-text-secondary cursor-not-allowed'
                  : 'bg-gray-900 dark:bg-stellar-cta hover:bg-gray-800 dark:hover:bg-stellar-dark-text-secondary text-white dark:text-black'
                  }`}
                onClick={handleSearch}
                disabled={isSearchDisabled()}
              >
                Search
              </button>
            </div>
          )}

          {/* Similarity Search UI */}
          {searchMode === 'similarity' && (
            <div className="bg-gray-100 dark:bg-stellar-dark-surface-elevated rounded-2xl p-4 shadow-sm mb-4 border dark:border-stellar-dark-border">
              <div className="flex flex-col gap-2 mb-4">
                <div className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium mb-1">
                  Search by:
                </div>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium ${similarityMode === 'sol' ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black' : 'bg-white dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary'}`}
                    onClick={() => setSimilarityMode('sol')}
                  >
                    Sol #
                  </button>
                  <button
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium ${similarityMode === 'segment' ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black' : 'bg-white dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary'}`}
                    onClick={() => setSimilarityMode('segment')}
                  >
                    Segment
                  </button>
                  <button
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium ${similarityMode === 'plan' ? 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black' : 'bg-white dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary'}`}
                    onClick={() => setSimilarityMode('plan')}
                  >
                    Plan
                  </button>
                </div>
              </div>

              {/* Sol # Search */}
              {similarityMode === 'sol' && (
                <div>
                  <div className="flex items-center mb-4">
                    <span className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium mr-3">
                      Sol #
                    </span>
                    <div className="bg-white dark:bg-stellar-dark-surface rounded-md shadow-sm flex items-center px-3 py-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={solNumber}
                        onChange={(e) => setSolNumber(e.target.value)}
                        className="border-none focus:ring-0 focus:outline-none text-sm bg-transparent text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary p-0"
                        // Width sized to fit exactly 4 monospace-ish digits.
                        style={{ width: '4ch' }}
                        placeholder="1234"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium">
                      Evaluate similarity by:
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary hover:text-gray-700 dark:hover:text-stellar-dark-text-primary border border-gray-300 dark:border-stellar-dark-border rounded px-2 py-0.5"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    {filters.map((filter, index) => (
                      <ParameterChip
                        key={index}
                        mode="parameter-only"
                        label={filter.type}
                        onEdit={(event) => handleFilterClick(index, event)}
                        onRemove={() => removeFilter(index)}
                        className="edit-filter"
                      />
                    ))}
                    <div className="relative">
                      <button
                        onClick={(e) => handleAddFilterClick(e, 'parameter-only')}
                        className="bg-white dark:bg-stellar-dark-surface rounded-full w-8 h-8 flex items-center justify-center shadow-sm filter-button"
                      >
                        <PlusCircleIcon className="h-5 w-5 text-gray-500 dark:text-stellar-dark-text-secondary" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Segment Search */}
              {similarityMode === 'segment' && (
                <div>
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium mb-2">
                      Select segment on map
                    </div>
                    <div className="bg-white dark:bg-stellar-dark-surface rounded-md p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black dark:text-stellar-dark-text-primary">
                            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">Start:</div>
                        </div>
                        {driveState.segmentStartMarker ? (
                          <div className="flex items-center gap-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-stellar-dark-text-primary">
                              SCLK: {driveState.segmentStartMarker.sclk}
                            </div>
                            <div className="flex gap-1">
                              <button
                                className="text-gray-700 dark:text-stellar-dark-text-secondary hover:text-black dark:hover:text-stellar-dark-text-primary"
                                onClick={handleSelectStartMarker}
                                title="Edit start marker"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                className="text-red-500 hover:text-red-700"
                                onClick={() => driveState.setSegmentStartMarker(null)}
                                title="Clear start marker"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className={`flex items-center gap-1 text-sm ${driveState.segmentSelectionMode === 'start'
                              ? 'text-black dark:text-stellar-dark-text-primary font-medium'
                              : 'text-gray-700 dark:text-stellar-dark-text-secondary'
                              }`}
                            onClick={handleSelectStartMarker}
                            title="Select on map"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black dark:text-stellar-dark-text-primary">
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>
                              {driveState.segmentSelectionMode === 'start'
                                ? 'Click on map to select'
                                : 'Select on map'
                              }
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black dark:text-stellar-dark-text-primary">
                            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary">End:</div>
                        </div>
                        {driveState.segmentEndMarker ? (
                          <div className="flex items-center gap-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-stellar-dark-text-primary">
                              SCLK: {driveState.segmentEndMarker.sclk}
                            </div>
                            <div className="flex gap-1">
                              <button
                                className="text-gray-700 hover:text-black dark:text-stellar-dark-text-secondary hover:text-black dark:hover:text-stellar-dark-text-primary"
                                onClick={handleSelectEndMarker}
                                title="Edit end marker"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                className="text-red-500 hover:text-red-700"
                                onClick={() => driveState.setSegmentEndMarker(null)}
                                title="Clear end marker"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className={`flex items-center gap-1 text-sm ${driveState.segmentSelectionMode === 'end'
                              ? 'text-black dark:text-stellar-dark-text-primary font-medium'
                              : 'text-gray-700 dark:text-stellar-dark-text-secondary'
                              }`}
                            onClick={handleSelectEndMarker}
                            title="Select on map"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black dark:text-stellar-dark-text-primary">
                              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>
                              {driveState.segmentSelectionMode === 'end'
                                ? 'Click on map to select'
                                : 'Select on map'
                              }
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium">
                      Evaluate similarity by:
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary hover:text-gray-700 dark:hover:text-stellar-dark-text-primary border border-gray-300 dark:border-stellar-dark-border rounded px-2 py-0.5"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    {filters.map((filter, index) => (
                      <ParameterChip
                        key={index}
                        mode="parameter-only"
                        label={filter.type}
                        onEdit={(event) => handleFilterClick(index, event)}
                        onRemove={() => removeFilter(index)}
                        className="edit-filter"
                      />
                    ))}
                    <div className="relative">
                      <button
                        onClick={(e) => handleAddFilterClick(e, 'parameter-only')}
                        className="bg-white dark:bg-stellar-dark-surface rounded-full w-8 h-8 flex items-center justify-center shadow-sm filter-button"
                      >
                        <PlusCircleIcon className="h-5 w-5 text-gray-500 dark:text-stellar-dark-text-secondary" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan Search */}
              {similarityMode === 'plan' && (
                <div>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      className="flex items-center gap-2 bg-white dark:bg-stellar-dark-surface rounded-lg px-4 py-2 shadow-sm text-gray-700 dark:text-stellar-dark-text-primary hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated transition-colors"
                      onClick={handlePlanDrawOnMap}
                    >
                      <MapIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Draw on Map</span>
                    </button>
                    <button className="flex items-center gap-2 bg-white dark:bg-stellar-dark-surface rounded-lg px-4 py-2 shadow-sm text-gray-400 dark:text-stellar-dark-text-secondary cursor-not-allowed opacity-70">
                      <ImportIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Import drive plan
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary font-medium">
                      Evaluate similarity by:
                    </span>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary hover:text-gray-700 dark:hover:text-stellar-dark-text-primary border border-gray-300 dark:border-stellar-dark-border rounded px-2 py-0.5"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center mb-4">
                    {filters.map((filter, index) => (
                      <ParameterChip
                        key={index}
                        mode="parameter-only"
                        label={filter.type}
                        onEdit={(event) => handleFilterClick(index, event)}
                        onRemove={() => removeFilter(index)}
                        className="edit-filter"
                      />
                    ))}
                    <div className="relative">
                      <button
                        onClick={(e) => handleAddFilterClick(e, 'parameter-only')}
                        className="bg-white dark:bg-stellar-dark-surface rounded-full w-8 h-8 flex items-center justify-center shadow-sm filter-button"
                      >
                        <PlusCircleIcon className="h-5 w-5 text-gray-500 dark:text-stellar-dark-text-secondary" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                className={`w-full rounded-lg py-2 font-medium ${isSearchDisabled()
                  ? 'bg-gray-300 dark:bg-stellar-dark-surface text-gray-500 dark:text-stellar-dark-text-secondary cursor-not-allowed'
                  : 'bg-gray-900 dark:bg-stellar-cta hover:bg-gray-800 dark:hover:bg-stellar-dark-text-secondary text-white dark:text-black'
                  }`}
                onClick={handleSearch}
                disabled={isSearchDisabled()}
              >
                Search
              </button>
            </div>
          )}

        </div>

        {/* Drive Grid - this part will grow and scroll internally */}
        <div className="bg-white dark:bg-stellar-dark-surface rounded-lg shadow-sm flex-1 flex flex-col min-h-0">
          <div className="p-4 pb-2 border-b border-gray-200 dark:border-stellar-dark-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-800 dark:text-stellar-dark-text-primary">Results ({searchResults.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => driveState.setSearchResults([])}
                  className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary hover:text-gray-700 dark:hover:text-stellar-dark-text-primary border border-gray-300 dark:border-stellar-dark-border rounded px-2 py-0.5"
                  title="Clear results"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto">
            <SearchResults
              drives={searchResults.map((result) => ({
                id: result.sol.toString(),
                title: `Sol ${result.sol}`,
                description: `Distance: ${result.distance?.toFixed(2) || 'N/A'}km, Duration: ${result.duration?.toFixed(1) || 'N/A'}s`,
                thumbnail: 'M5,20 C15,10 25,30 35,20',
                isReference: result.isReference,
              }))}
              hasSearched={hasSearched}
              pageSize={10}
            />
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

        {/* ParameterSelector */}
        <ParameterSelector
          isOpen={parameterSelectorOpen}
          onClose={() => setParameterSelectorOpen(false)}
          onSelectParameter={handleSelectParameter}
          onSelectParameterValue={handleSelectParameterValue}
          onUpdateParameterValue={handleUpdateParameterValue}
          mode={parameterSelectorMode}
          position={parameterSelectorPosition}
          initialValue={parameterSelectorInitialValue}
          editIndex={editingParameterSelectorIndex}
          existingParameters={searchMode === 'parameter'
            ? parameterFilters.map(f => {
              // For motor parameters, we want to hide the base motor name (e.g., "DRIVE_LF" not "DRIVE_LF.ODOM")
              if (f.parameter.includes('.')) {
                return f.parameter.split('.')[0];
              }
              return f.parameter;
            })
            : filters.map(f => f.type.toUpperCase())
          }
        />
      </div>
    </>
  )
}
