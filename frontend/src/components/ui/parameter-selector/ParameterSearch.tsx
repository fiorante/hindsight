import React, { useRef, useEffect } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { PARAMETER_CATEGORIES } from './constants';

interface ParameterSearchProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  onParameterSelect: (parameter: string) => void;
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  hideDriveCategory?: boolean;
  mode: 'parameter-only' | 'parameter-value';
  activeInputField?: string;
  onFocus?: () => void;
  // Min/max props for parameter-value mode
  minValue?: string;
  maxValue?: string;
  onMinChange?: (value: string) => void;
  onMaxChange?: (value: string) => void;
  minMaxError?: string;
  onValidateMinMax?: () => void;
  onMinMaxFocus?: (field: string) => void;
  existingParameters?: string[];
}

export const ParameterSearch: React.FC<ParameterSearchProps> = ({
  searchText,
  onSearchChange,
  onParameterSelect,
  highlightedIndex,
  onHighlightChange,
  onKeyDown,
  hideDriveCategory = false,
  mode,
  activeInputField = 'parameter',
  onFocus,
  minValue = '',
  maxValue = '',
  onMinChange,
  onMaxChange,
  minMaxError = '',
  onValidateMinMax,
  onMinMaxFocus,
  existingParameters = []
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  // Filter parameters based on search text and exclude existing parameters
  const getFilteredParameters = () => {
    const allParams = (Object.values(PARAMETER_CATEGORIES) as string[][]).flat();
    const filtered = allParams.filter((param: string) =>
      param.toLowerCase().includes(searchText.toLowerCase()) &&
      !existingParameters.includes(param)
    );

    if (mode === 'parameter-only') {
      return filtered.filter((param: string) => !['SOL', 'END_SCLK', 'START_SCLK'].includes(param));
    }
    return filtered;
  };

  // Group filtered parameters by category
  const getParametersByCategory = () => {
    const filteredParams = getFilteredParameters();
    const result: Record<string, string[]> = {};

    Object.entries(PARAMETER_CATEGORIES).forEach(([category, parameters]) => {
      if (hideDriveCategory && category === 'DRIVE') {
        return;
      }

      const filtered = (parameters as string[]).filter((param: string) => filteredParams.includes(param));
      if (filtered.length > 0) {
        result[category] = [...filtered].sort();
      }
    });

    return result;
  };

  // Get cumulative index for a parameter across all categories
  const getCumulativeIndex = (targetCategory: string, targetParam: string): number => {
    const categories = getParametersByCategory();
    let index = 0;

    for (const [category, params] of Object.entries(categories)) {
      if (category === targetCategory) {
        const paramIndex = params.indexOf(targetParam);
        if (paramIndex >= 0) {
          return index + paramIndex;
        }
        return -1;
      }
      index += params.length;
    }
    return -1;
  };

  // Auto-focus input when component mounts or active field changes
  useEffect(() => {
    if (activeInputField === 'parameter' && inputRef.current) {
      inputRef.current.focus();
    } else if (activeInputField === 'min' && minInputRef.current) {
      minInputRef.current.focus();
    } else if (activeInputField === 'max' && maxInputRef.current) {
      maxInputRef.current.focus();
    }
  }, [activeInputField]);

  const categorizedParameters = getParametersByCategory();

  // Handle input changes for min/max
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      onMinChange?.(value);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      onMaxChange?.(value);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className={`w-full p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md ${activeInputField === 'parameter' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
          } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
        placeholder={mode === 'parameter-only' ? "Search parameters..." : "Parameter"}
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => onFocus?.()}
      />

      {/* Min/Max inputs for parameter-value mode - only show after parameter is selected */}
      {mode === 'parameter-value' && searchText && searchText !== 'TERRAIN' && searchText !== 'FAULT' && searchText !== '' && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-2">
            <input
              ref={minInputRef}
              type="text"
              className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'min' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
                } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
              placeholder="Min"
              value={minValue}
              onChange={handleMinChange}
              onKeyDown={onKeyDown}
              onFocus={() => onMinMaxFocus?.('min')}
              onBlur={onValidateMinMax}
            />
            <input
              ref={maxInputRef}
              type="text"
              className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'max' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
                } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
              placeholder="Max"
              value={maxValue}
              onChange={handleMaxChange}
              onKeyDown={onKeyDown}
              onFocus={() => onMinMaxFocus?.('max')}
              onBlur={onValidateMinMax}
            />
          </div>
          {minMaxError && (
            <div className="text-xs text-red-500 px-1">
              {minMaxError}
            </div>
          )}
        </div>
      )}

      {/* Parameters Display */}
      <div className="max-h-[450px] overflow-y-auto mt-2">
        {Object.keys(categorizedParameters).length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary py-2 text-center">
            No parameters found
          </div>
        ) : (
          Object.entries(categorizedParameters).map(([category, params]) => (
            <div key={category} className="mb-5">
              <div className="text-xs font-semibold text-gray-900 dark:text-white mb-2 px-1 flex items-center">
                {category}
                {category === 'MOTOR' && (
                  <ChevronRightIcon className="h-3 w-3 ml-1 text-gray-400" />
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {params.map((param) => {
                  const index = getCumulativeIndex(category, param);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={param}
                      className={`text-xs px-2 py-1 rounded-full border ${isHighlighted
                        ? 'bg-black dark:bg-stellar-cta text-white dark:text-black border-black dark:border-stellar-cta'
                        : 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary border-gray-100 dark:border-stellar-dark-border hover:bg-gray-200 dark:hover:bg-stellar-dark-border'
                        }`}
                      onClick={() => onParameterSelect(param)}
                      onMouseEnter={() => {
                        if (index >= 0) onHighlightChange(index);
                      }}
                    >
                      {param}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};