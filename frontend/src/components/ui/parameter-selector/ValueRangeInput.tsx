import React, { useState, useRef, useEffect } from 'react';
import { getParameterUnitLabel } from '../../../constants/parameters';

interface ValueRangeInputProps {
  parameter: string;
  initialMin?: string;
  initialMax?: string;
  onSubmit: (min: string, max: string) => void;
  onCancel?: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  activeInputField?: string;
  onFocus?: (field: string) => void;
  minMaxError?: string;
  onValidateMinMax?: () => void;
}

export const ValueRangeInput: React.FC<ValueRangeInputProps> = ({
  parameter,
  initialMin = '',
  initialMax = '',
  onSubmit,
  onCancel: _onCancel,
  onKeyDown,
  activeInputField = 'min',
  onFocus,
  minMaxError = '',
  onValidateMinMax
}) => {
  const [minValue, setMinValue] = useState(initialMin);
  const [maxValue, setMaxValue] = useState(initialMax);

  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  // Focus appropriate input on mount and when activeInputField changes
  useEffect(() => {
    if (activeInputField === 'min' && minInputRef.current) {
      minInputRef.current.focus();
    } else if (activeInputField === 'max' && maxInputRef.current) {
      maxInputRef.current.focus();
    }
  }, [activeInputField]);

  const validateValue = (value: string) => {
    // Allow empty values and valid numbers (including decimals)
    return value === '' || /^-?\d*\.?\d*$/.test(value);
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (validateValue(value)) {
      setMinValue(value);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (validateValue(value)) {
      setMaxValue(value);
    }
  };

  // Get unit labels for placeholders
  const unitLabel = getParameterUnitLabel(parameter);
  const minPlaceholder = unitLabel ? `Min (${unitLabel})` : 'Min';
  const maxPlaceholder = unitLabel ? `Max (${unitLabel})` : 'Max';

  // Sync internal state with external when they change
  useEffect(() => {
    setMinValue(initialMin);
    setMaxValue(initialMax);
  }, [initialMin, initialMax]);

  // Call onSubmit when values change (for real-time updates)
  useEffect(() => {
    onSubmit(minValue, maxValue);
  }, [minValue, maxValue, onSubmit]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={minInputRef}
        type="text"
        className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'min' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
          } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
        placeholder={minPlaceholder}
        value={minValue}
        onChange={handleMinChange}
        onKeyDown={onKeyDown}
        onFocus={() => onFocus?.('min')}
        onBlur={onValidateMinMax}
      />
      <input
        ref={maxInputRef}
        type="text"
        className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'max' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
          } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
        placeholder={maxPlaceholder}
        value={maxValue}
        onChange={handleMaxChange}
        onKeyDown={onKeyDown}
        onFocus={() => onFocus?.('max')}
        onBlur={onValidateMinMax}
      />
      {minMaxError && (
        <div className="absolute top-full left-0 right-0 text-xs text-red-500 px-1 mt-1">
          {minMaxError}
        </div>
      )}
    </div>
  );
};
