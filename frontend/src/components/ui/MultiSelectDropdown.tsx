import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  count?: number;
  disabled?: boolean;
}

export interface MultiSelectDropdownProps {
  baseLabel: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  minWidth?: number;
  maxHeight?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  baseLabel,
  options,
  selected,
  onChange,
  minWidth = 180,
  maxHeight = 256,
  placeholder,
  disabled = false,
  className = '',
  loading = false,
  emptyMessage = 'No options available'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState(selected);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // When the dropdown opens, sync draft state with the parent's state
  useEffect(() => {
    if (isOpen) {
      setDraftSelected(selected);
    }
  }, [isOpen, selected]);

  // Handle clicks outside the dropdown to close it and apply changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          // Apply changes only when closing
          if (JSON.stringify(draftSelected) !== JSON.stringify(selected)) {
            onChange(draftSelected);
          }
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, draftSelected, selected, onChange]);

  const handleToggleItem = (value: string) => {
    if (disabled) return;

    setDraftSelected(currentDraft =>
      currentDraft.includes(value)
        ? currentDraft.filter(item => item !== value)
        : [...currentDraft, value]
    );
  };

  const handleToggleDropdown = () => {
    if (disabled) return;

    const currentlyOpen = isOpen;
    setIsOpen(!currentlyOpen);

    // If closing, apply the changes
    if (currentlyOpen) {
      if (JSON.stringify(draftSelected) !== JSON.stringify(selected)) {
        onChange(draftSelected);
      }
    }
  };

  const getLabel = () => {
    const items = isOpen ? draftSelected : selected;
    if (items.length === 0) return placeholder || baseLabel;
    if (items.length === 1) return items[0];
    return `${items.length} selected`;
  };

  const filteredOptions = options.filter(opt => !opt.disabled);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleDropdown}
        disabled={disabled}
        className={`flex items-center gap-2 px-2 py-1 text-xs border rounded transition-colors ${disabled
            ? 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-stellar-dark-surface border-gray-200 dark:border-stellar-dark-border'
            : 'bg-white dark:bg-stellar-dark-surface hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated border-gray-300 dark:border-stellar-dark-border text-gray-700 dark:text-stellar-dark-text-primary'
          }`}
        style={{ minWidth }}
      >
        <span className="truncate">
          {loading ? 'Loading...' : getLabel()}
        </span>
        {!disabled && (isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute z-20 mt-1 w-full overflow-auto rounded border bg-white dark:bg-stellar-dark-surface shadow border-gray-300 dark:border-stellar-dark-border"
          style={{ maxHeight }}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-2 px-3 text-xs text-gray-500 dark:text-stellar-dark-text-secondary text-center">
              {loading ? 'Loading...' : emptyMessage}
            </div>
          ) : (
            <ul className="py-1 text-xs">
              {filteredOptions.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => handleToggleItem(opt.value)}
                    className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary transition-colors"
                  >
                    <span className="truncate">
                      {opt.value}
                      {typeof opt.count === 'number' ? ` (${opt.count})` : ''}
                    </span>
                    {draftSelected.includes(opt.value) && (
                      <Check className="h-3 w-3 text-gray-700 dark:text-stellar-dark-text-primary flex-shrink-0 ml-2" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
