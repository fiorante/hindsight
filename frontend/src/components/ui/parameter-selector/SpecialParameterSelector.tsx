import React, { useRef, useEffect } from 'react';
import { TERRAIN_OPTIONS, FAULT_OPTIONS, MOTOR_PARAMETERS } from './constants';

interface SpecialParameterSelectorProps {
  type: 'terrain' | 'fault' | 'motor';
  selectedMotor?: string;
  searchText: string;
  onSearchChange: (text: string) => void;
  onSelect: (value: string) => void;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  activeInputField?: string;
  onFocus?: () => void;
  existingParameters?: string[];
}

export const SpecialParameterSelector: React.FC<SpecialParameterSelectorProps> = ({
  type,
  selectedMotor,
  searchText,
  onSearchChange,
  onSelect,
  onBack,
  onKeyDown,
  highlightedIndex,
  onHighlightChange,
  activeInputField,
  onFocus,
  existingParameters = []
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const getOptions = () => {
    switch (type) {
      case 'terrain':
        return TERRAIN_OPTIONS;
      case 'fault':
        return FAULT_OPTIONS;
      case 'motor':
        return MOTOR_PARAMETERS;
      default:
        return [];
    }
  };

  const getFilteredOptions = () => {
    const options = getOptions();
    return options.filter(option =>
      option.toLowerCase().includes(searchText.toLowerCase()) &&
      !existingParameters.includes(option)
    );
  };

  const getLabel = () => {
    switch (type) {
      case 'terrain':
        return 'TERRAIN';
      case 'fault':
        return 'FAULT';
      case 'motor':
        return selectedMotor || 'MOTOR';
      default:
        return 'OPTION';
    }
  };

  const getPlaceholder = () => {
    switch (type) {
      case 'terrain':
        return 'Terrain type...';
      case 'fault':
        return 'Fault type...';
      case 'motor':
        return 'Motor parameter...';
      default:
        return 'Search...';
    }
  };

  // Auto-focus input when component mounts or active field changes
  useEffect(() => {
    if (activeInputField === type && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeInputField, type]);

  const filteredOptions = getFilteredOptions();

  return (
    <>
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="px-2 py-1 bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary rounded-l-md border border-gray-300 dark:border-stellar-dark-border text-sm hover:bg-gray-200 dark:hover:bg-stellar-dark-border h-[38px]"
        >
          {getLabel()}
        </button>
        <input
          ref={inputRef}
          type="text"
          className={`flex-1 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border border-l-0 rounded-r-md ${activeInputField === type ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
            } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary h-[38px]`}
          placeholder={getPlaceholder()}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => onFocus?.()}
        />
      </div>

      {/* Options Display */}
      <div className="max-h-[450px] overflow-y-auto mt-2">
        {filteredOptions.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary py-2 text-center">
            No options found
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filteredOptions.map((option, index) => {
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={option}
                  className={`text-xs px-2 py-1 rounded-full border ${isHighlighted
                    ? 'bg-black dark:bg-stellar-cta text-white dark:text-black border-black dark:border-stellar-cta'
                    : 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary border-gray-100 dark:border-stellar-dark-border hover:bg-gray-200 dark:hover:bg-stellar-dark-border'
                    }`}
                  onClick={() => onSelect(option)}
                  onMouseEnter={() => onHighlightChange(index)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
