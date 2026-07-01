import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ParameterSearch } from './ParameterSearch';
import { SpecialParameterSelector } from './SpecialParameterSelector';
import { getAvailableParameters, PARAMETER_CATEGORIES, TERRAIN_OPTIONS, FAULT_OPTIONS, MOTOR_PARAMETERS } from './constants';

export type FilterMode = 'parameter-only' | 'parameter-value';

export interface FilterValue {
  parameter: string;
  min: string;
  max: string;
}

interface ParameterSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectParameter: (parameter: string) => void;
  onSelectParameterValue?: (parameter: string, min: string, max: string) => void;
  onUpdateParameterValue?: (index: number, parameter: string, min: string, max: string) => void;
  mode: FilterMode;
  position?: { top: number; left: number };
  initialValue?: FilterValue;
  editIndex?: number;
  hideDriveCategory?: boolean;
  existingParameters?: string[];
}

export const ParameterSelector: React.FC<ParameterSelectorProps> = ({
  isOpen,
  onClose,
  onSelectParameter,
  onSelectParameterValue,
  onUpdateParameterValue,
  mode,
  position = { top: 0, left: 0 },
  initialValue,
  editIndex,
  hideDriveCategory = false,
  existingParameters = []
}) => {
  // All state from original component
  const [searchText, setSearchText] = useState('');
  const [motorSearchText, setMotorSearchText] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [terrainValue, setTerrainValue] = useState('');
  const [terrainSearchText, setTerrainSearchText] = useState('');
  const [faultValue, setFaultValue] = useState('');
  const [faultSearchText, setFaultSearchText] = useState('');
  const [minMaxError, setMinMaxError] = useState('');
  const [filteredTerrainOptions, setFilteredTerrainOptions] = useState<string[]>(TERRAIN_OPTIONS);
  const [filteredFaultOptions, setFilteredFaultOptions] = useState<string[]>(FAULT_OPTIONS);
  // -1 = no chip highlighted. Highlight only kicks in once the user starts typing
  // in the search field, so a freshly-opened panel shows no pre-selection.
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filteredParameters, setFilteredParameters] = useState<string[]>([]);
  const [filteredMotorParameters, setFilteredMotorParameters] = useState<string[]>(MOTOR_PARAMETERS);
  const [activeInputField, setActiveInputField] = useState<'parameter' | 'motor-parameter' | 'motor' | 'min' | 'max' | 'terrain' | 'fault'>('parameter');

  // UI stages for parameter-value mode
  type SelectionStage = 'parameter-name' | 'motor-parameter' | 'value-selection';
  const [selectionStage, setSelectionStage] = useState<SelectionStage>('parameter-name');
  const [selectedParameter, setSelectedParameter] = useState<string>('');
  const [selectedMotorParameter, setSelectedMotorParameter] = useState<string>('');

  // States for parameter-only mode (single-stage selection)
  const [selectedMotor, setSelectedMotor] = useState<string | null>(null);
  const [isMotorSelectionMode, setIsMotorSelectionMode] = useState(false);
  const [isTerrainMode, setIsTerrainMode] = useState(false);
  const [isFaultMode, setIsFaultMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const minValueInputRef = useRef<HTMLInputElement>(null);
  const maxValueInputRef = useRef<HTMLInputElement>(null);
  const motorInputRef = useRef<HTMLInputElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Initialize from initialValue if provided
  useEffect(() => {
    if (isOpen && initialValue) {
      setIsEditMode(true);

      if (mode === 'parameter-value') {
        // Stage-based initialization
        if (initialValue.parameter.includes('.')) {
          const [motor, motorParam] = initialValue.parameter.split('.');
          setSelectedParameter(motor);
          setSelectedMotorParameter(motorParam);
          setSelectionStage('value-selection');
          setActiveInputField('min');
          setTimeout(() => minValueInputRef.current?.focus(), 10);
        } else if (initialValue.parameter === 'TERRAIN') {
          setSelectedParameter('TERRAIN');
          setTerrainValue(initialValue.min || '');
          setSelectionStage('value-selection');
          setActiveInputField('terrain');
        } else if (initialValue.parameter === 'FAULT') {
          setSelectedParameter('FAULT');
          setFaultValue(initialValue.min || '');
          setSelectionStage('value-selection');
          setActiveInputField('fault');
        } else {
          setSelectedParameter(initialValue.parameter);
          setSelectionStage('value-selection');
          setActiveInputField('min');
        }
      } else {
        // Parameter-only mode initialization (single-stage selection)
        if (initialValue.parameter.includes('.')) {
          const [motor, motorParam] = initialValue.parameter.split('.');
          setSelectedMotor(motor);
          setSelectedMotorParameter(motorParam);
          setMotorSearchText(motorParam);
          setSearchText(initialValue.parameter);
          setIsMotorSelectionMode(true);
          setIsTerrainMode(false);
          setIsFaultMode(false);
        } else if (initialValue.parameter === 'TERRAIN') {
          setSearchText(initialValue.parameter);
          setTerrainValue(initialValue.min || '');
          setIsTerrainMode(true);
          setIsMotorSelectionMode(false);
          setIsFaultMode(false);
        } else if (initialValue.parameter === 'FAULT') {
          setSearchText(initialValue.parameter);
          setFaultValue(initialValue.min || '');
          setIsFaultMode(true);
          setIsMotorSelectionMode(false);
          setIsTerrainMode(false);
        } else {
          setSearchText(initialValue.parameter);
          setIsMotorSelectionMode(false);
          setIsTerrainMode(false);
          setIsFaultMode(false);
        }
      }

      setMinValue(initialValue.min || '');
      setMaxValue(initialValue.max || '');
    }
  }, [isOpen, initialValue, mode]);

  // Initialize state when dropdown opens
  useEffect(() => {
    if (isOpen && !initialValue) {
      // Reset all state
      setSearchText('');
      setMotorSearchText('');
      setMinValue('');
      setMaxValue('');
      setTerrainValue('');
      setTerrainSearchText('');
      setFaultValue('');
      setFaultSearchText('');
      setMinMaxError('');
      setHighlightedIndex(-1);
      setFilteredParameters(getAvailableParameters(mode));
      setFilteredMotorParameters(MOTOR_PARAMETERS);
      setFilteredTerrainOptions(TERRAIN_OPTIONS);
      setFilteredFaultOptions(FAULT_OPTIONS);
      setActiveInputField('parameter');

      // Parameter-value mode state reset (multi-stage)
      setSelectionStage('parameter-name');
      setSelectedParameter('');
      setSelectedMotorParameter('');

      // Parameter-only mode state reset (single-stage)
      setSelectedMotor(null);
      setIsMotorSelectionMode(false);
      setIsTerrainMode(false);
      setIsFaultMode(false);
      setIsEditMode(false);
    } else if (isOpen) {
      setFilteredParameters(getAvailableParameters(mode));
    }
  }, [isOpen, initialValue, mode]);

  // Filter parameters based on search text
  useEffect(() => {
    const availableParams = getAvailableParameters(mode);
    const filtered = searchText
      ? availableParams.filter(param =>
        param.toLowerCase().includes(searchText.toLowerCase())
      )
      : availableParams;

    if (hideDriveCategory) {
      const driveParams = PARAMETER_CATEGORIES.DRIVE;
      setFilteredParameters(filtered.filter(param => !driveParams.includes(param)));
    } else {
      setFilteredParameters(filtered);
    }
    setHighlightedIndex(searchText ? 0 : -1);
  }, [searchText, mode, hideDriveCategory]);

  // Filter motor parameters
  useEffect(() => {
    const filtered = motorSearchText
      ? MOTOR_PARAMETERS.filter(param =>
        param.toLowerCase().includes(motorSearchText.toLowerCase())
      )
      : MOTOR_PARAMETERS;
    setFilteredMotorParameters(filtered);
    setHighlightedIndex(motorSearchText ? 0 : -1);
  }, [motorSearchText]);

  // Auto-focus inputs when activeInputField changes
  useEffect(() => {
    if (activeInputField === 'motor-parameter' && motorInputRef.current) {
      motorInputRef.current.focus();
    } else if (activeInputField === 'min' && minValueInputRef.current) {
      minValueInputRef.current.focus();
    } else if (activeInputField === 'max' && maxValueInputRef.current) {
      maxValueInputRef.current.focus();
    }
  }, [activeInputField]);

  // Filter terrain options
  useEffect(() => {
    const filtered = terrainSearchText
      ? TERRAIN_OPTIONS.filter(option =>
        option.toLowerCase().includes(terrainSearchText.toLowerCase())
      )
      : TERRAIN_OPTIONS;
    setFilteredTerrainOptions(filtered);
    setHighlightedIndex(terrainSearchText ? 0 : -1);
  }, [terrainSearchText]);

  // Filter fault options
  useEffect(() => {
    const filtered = faultSearchText
      ? FAULT_OPTIONS.filter(option =>
        option.toLowerCase().includes(faultSearchText.toLowerCase())
      )
      : FAULT_OPTIONS;
    setFilteredFaultOptions(filtered);
    setHighlightedIndex(faultSearchText ? 0 : -1);
  }, [faultSearchText]);

  const handleParameterClick = (param: string) => {
    if (mode === 'parameter-only') {
      if (PARAMETER_CATEGORIES.MOTOR.includes(param)) {
        setSelectedMotor(param);
        setIsMotorSelectionMode(true);
        setActiveInputField('motor');
      } else {
        onSelectParameter(param);
        onClose();
      }
    } else {
      // Parameter-value mode: multi-stage approach
      if (PARAMETER_CATEGORIES.MOTOR.includes(param)) {
        setSelectedParameter(param);
        setSelectionStage('motor-parameter');
        setActiveInputField('motor-parameter');
        setTimeout(() => motorInputRef.current?.focus(), 10);
      } else {
        setSelectedParameter(param);
        setSelectionStage('value-selection');
        if (param === 'TERRAIN') {
          setActiveInputField('terrain');
        } else if (param === 'FAULT') {
          setActiveInputField('fault');
        } else {
          setActiveInputField('min');
          setTimeout(() => minValueInputRef.current?.focus(), 10);
        }
      }
    }
  };

  const handleMotorParameterClick = (motorParam: string) => {
    if (mode === 'parameter-only') {
      const fullParam = `${selectedMotor}.${motorParam}`;
      onSelectParameter(fullParam);
      onClose();
    } else {
      // parameter-value mode: advance to value selection
      setSelectedMotorParameter(motorParam);
      setSelectionStage('value-selection');
      setActiveInputField('min');
      setTimeout(() => minValueInputRef.current?.focus(), 10);
    }
  };

  const handleTerrainClick = (terrain: string) => {
    setTerrainValue(terrain);
    if (mode === 'parameter-value') {
      handleSubmit('TERRAIN', terrain, '');
    }
  };

  const handleFaultClick = (fault: string) => {
    setFaultValue(fault);
    if (mode === 'parameter-value') {
      handleSubmit('FAULT', fault, '');
    }
  };

  const handleBackToMainSelection = () => {
    if (mode === 'parameter-value') {
      // Parameter-value mode: return to parameter name selection stage
      setSelectionStage('parameter-name');
      setSelectedParameter('');
      setSelectedMotorParameter('');
      setSearchText('');
      setMotorSearchText('');
      setActiveInputField('parameter');
    } else {
      // Parameter-only mode: return to main parameter selection
      setSelectedMotor(null);
      setSelectedMotorParameter('');
      setIsMotorSelectionMode(false);
      setIsTerrainMode(false);
      setIsFaultMode(false);
      setSearchText('');
      setActiveInputField('parameter');
    }
  };

  const handleBackToMotorSelection = () => {
    setSelectionStage('motor-parameter');
    setSelectedMotorParameter('');
    setMotorSearchText('');
    setActiveInputField('motor-parameter');
    setTimeout(() => motorInputRef.current?.focus(), 10);
  };

  const handleSubmit = (param?: string, min?: string, max?: string) => {
    let finalParam = param || selectedParameter;
    let finalMin = min || minValue;
    let finalMax = max || maxValue;

    if (mode === 'parameter-value') {
      // Parameter-value mode: includes value selection stage
      if (selectedMotorParameter) {
        finalParam = `${selectedParameter}.${selectedMotorParameter}`;
      } else if (selectedParameter === 'TERRAIN') {
        finalParam = 'TERRAIN';
        finalMin = min || terrainValue;
        finalMax = '';
      } else if (selectedParameter === 'FAULT') {
        finalParam = 'FAULT';
        finalMin = min || faultValue;
        finalMax = '';
      }
    } else {
      // Parameter-only mode: ends after parameter name selection
      if (isMotorSelectionMode && selectedMotor && selectedMotorParameter) {
        finalParam = `${selectedMotor}.${selectedMotorParameter}`;
      } else if (isTerrainMode) {
        finalParam = 'TERRAIN';
        finalMin = min || terrainValue;
        finalMax = '';
      } else if (isFaultMode) {
        finalParam = 'FAULT';
        finalMin = min || faultValue;
        finalMax = '';
      }
    }

    // Validate min/max values for parameter-value mode (TERRAIN and FAULT don't need min/max validation)
    if (mode === 'parameter-value' && finalParam !== 'TERRAIN' && finalParam !== 'FAULT') {
      if (!validateMinMaxValues()) {
        return; // Don't submit if validation fails
      }
    }

    if (editIndex !== undefined && onUpdateParameterValue) {
      onUpdateParameterValue(editIndex, finalParam, finalMin, finalMax);
    } else if (onSelectParameterValue) {
      onSelectParameterValue(finalParam, finalMin, finalMax);
    }
    onClose();
  };

  const validateMinMaxValues = () => {
    // Check if at least one value is set
    if (!minValue && !maxValue) {
      setMinMaxError('At least one of min or max must be set');
      return false;
    }

    // Check if min is less than or equal to max when both are set
    if (minValue && maxValue) {
      const min = parseFloat(minValue);
      const max = parseFloat(maxValue);
      if (!isNaN(min) && !isNaN(max) && min > max) {
        setMinMaxError('Min value must be less than or equal to max value');
        return false;
      }
    }

    setMinMaxError('');
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (mode === 'parameter-value' && selectionStage !== 'parameter-name') {
        // Parameter-value mode: go back to parameter name selection
        handleBackToMainSelection();
      } else if (isMotorSelectionMode || isTerrainMode || isFaultMode) {
        // Parameter-only mode: go back to main parameter selection
        handleBackToMainSelection();
      } else {
        onClose();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let maxIndex = 0;
      if (mode === 'parameter-value') {
        // Parameter-value mode: handle different selection stages
        if (selectionStage === 'parameter-name') {
          maxIndex = filteredParameters.length - 1;
        } else if (selectionStage === 'motor-parameter') {
          maxIndex = filteredMotorParameters.length - 1;
        } else if (selectionStage === 'value-selection') {
          if (selectedParameter === 'TERRAIN') {
            maxIndex = filteredTerrainOptions.length - 1;
          } else if (selectedParameter === 'FAULT') {
            maxIndex = filteredFaultOptions.length - 1;
          }
        }
      } else {
        // Parameter-only mode: handle different selection modes
        if (isMotorSelectionMode) {
          maxIndex = filteredMotorParameters.length - 1;
        } else if (isTerrainMode) {
          maxIndex = filteredTerrainOptions.length - 1;
        } else if (isFaultMode) {
          maxIndex = filteredFaultOptions.length - 1;
        } else {
          maxIndex = filteredParameters.length - 1;
        }
      }
      setHighlightedIndex(prev => prev < maxIndex ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();

      if (mode === 'parameter-value') {
        // Parameter-value mode: handle value selection stage
        if (selectionStage === 'value-selection' && (activeInputField === 'min' || activeInputField === 'max')) {
          if (e.key === 'Tab' && activeInputField === 'min') {
            setActiveInputField('max');
            setTimeout(() => maxValueInputRef.current?.focus(), 10);
          } else {
            // Tab or Enter from max field, or Enter from min field - submit
            handleSubmit();
          }
          return;
        }

        if (selectionStage === 'parameter-name') {
          if (filteredParameters[highlightedIndex]) {
            handleParameterClick(filteredParameters[highlightedIndex]);
          }
        } else if (selectionStage === 'motor-parameter') {
          if (filteredMotorParameters[highlightedIndex]) {
            handleMotorParameterClick(filteredMotorParameters[highlightedIndex]);
          }
        } else if (selectionStage === 'value-selection') {
          if (selectedParameter === 'TERRAIN' && filteredTerrainOptions[highlightedIndex]) {
            handleTerrainClick(filteredTerrainOptions[highlightedIndex]);
          } else if (selectedParameter === 'FAULT' && filteredFaultOptions[highlightedIndex]) {
            handleFaultClick(filteredFaultOptions[highlightedIndex]);
          }
        }
      } else {
        // Parameter-only mode: handle different selection modes
        if (isMotorSelectionMode) {
          if (filteredMotorParameters[highlightedIndex]) {
            handleMotorParameterClick(filteredMotorParameters[highlightedIndex]);
          }
        } else if (isTerrainMode) {
          if (filteredTerrainOptions[highlightedIndex]) {
            handleTerrainClick(filteredTerrainOptions[highlightedIndex]);
          }
        } else if (isFaultMode) {
          if (filteredFaultOptions[highlightedIndex]) {
            handleFaultClick(filteredFaultOptions[highlightedIndex]);
          }
        } else {
          if (filteredParameters[highlightedIndex]) {
            handleParameterClick(filteredParameters[highlightedIndex]);
          }
        }
      }
    }
  };

  if (!isOpen) return null;

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-white dark:bg-stellar-dark-surface rounded-lg shadow-lg border dark:border-stellar-dark-border min-w-[300px] max-w-md max-h-[600px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="p-3">
        {/* Search Input Area */}
        <div className="mb-3">
          {mode === 'parameter-only' ? (
            // Parameter-only mode: single-stage parameter selection
            isMotorSelectionMode ? (
              <SpecialParameterSelector
                type="motor"
                selectedMotor={selectedMotor!}
                searchText={motorSearchText}
                onSearchChange={setMotorSearchText}
                onSelect={handleMotorParameterClick}
                onBack={handleBackToMainSelection}
                onKeyDown={handleKeyDown}
                highlightedIndex={highlightedIndex}
                onHighlightChange={setHighlightedIndex}
                activeInputField={activeInputField}
                onFocus={() => setActiveInputField('motor')}
                existingParameters={existingParameters}
              />
            ) : (
              <ParameterSearch
                searchText={searchText}
                onSearchChange={setSearchText}
                onParameterSelect={handleParameterClick}
                highlightedIndex={highlightedIndex}
                onHighlightChange={setHighlightedIndex}
                onKeyDown={handleKeyDown}
                hideDriveCategory={hideDriveCategory}
                mode={mode}
                activeInputField={activeInputField}
                onFocus={() => setActiveInputField('parameter')}
                minValue={minValue}
                maxValue={maxValue}
                onMinChange={setMinValue}
                onMaxChange={setMaxValue}
                minMaxError={minMaxError}
                onValidateMinMax={validateMinMaxValues}
                onMinMaxFocus={(field) => setActiveInputField(field as 'min' | 'max')}
                existingParameters={existingParameters}
              />
            )
          ) : selectionStage === 'parameter-name' ? (
            // Stage 1: Parameter Name Selection
            <ParameterSearch
              searchText={searchText}
              onSearchChange={setSearchText}
              onParameterSelect={handleParameterClick}
              highlightedIndex={highlightedIndex}
              onHighlightChange={setHighlightedIndex}
              onKeyDown={handleKeyDown}
              hideDriveCategory={hideDriveCategory}
              mode="parameter-only" // Don't show min/max inputs in this stage
              activeInputField={activeInputField}
              onFocus={() => setActiveInputField('parameter')}
              minValue=""
              maxValue=""
              onMinChange={() => { }}
              onMaxChange={() => { }}
              minMaxError=""
              onValidateMinMax={() => { }}
              onMinMaxFocus={() => { }}
              existingParameters={existingParameters}
            />
          ) : selectionStage === 'motor-parameter' ? (
            // Stage 2: Motor Parameter Selection
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <button
                  onClick={handleBackToMainSelection}
                  className="px-2 py-1 bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary rounded-l-md border border-gray-300 dark:border-stellar-dark-border text-sm hover:bg-gray-200 dark:hover:bg-stellar-dark-border h-[38px]"
                >
                  {selectedParameter}
                </button>
                <input
                  ref={motorInputRef}
                  type="text"
                  className={`flex-1 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border border-l-0 rounded-r-md ${activeInputField === 'motor-parameter' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
                    } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary h-[38px]`}
                  placeholder="Motor parameter..."
                  value={motorSearchText}
                  onChange={(e) => setMotorSearchText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setActiveInputField('motor-parameter')}
                />
              </div>

              {/* Motor parameter chips */}
              <div className="max-h-[450px] overflow-y-auto mt-2">
                {filteredMotorParameters.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-stellar-dark-text-secondary py-2 text-center">
                    No motor parameters found
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {filteredMotorParameters.map((option, index) => {
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <button
                          key={option}
                          className={`text-xs px-2 py-1 rounded-full border ${isHighlighted
                            ? 'bg-black dark:bg-stellar-cta text-white dark:text-black border-black dark:border-stellar-cta'
                            : 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-700 dark:text-stellar-dark-text-primary border-gray-100 dark:border-stellar-dark-border hover:bg-gray-200 dark:hover:bg-stellar-dark-border'
                            }`}
                          onClick={() => handleMotorParameterClick(option)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Stage 3: Value Selection
            <div className="flex flex-col gap-2">
              {/* Selected parameter chip - only show for non-compound parameters */}
              {selectedParameter !== 'TERRAIN' && selectedParameter !== 'FAULT' && (
                <div className="flex items-center">
                  <button
                    onClick={selectedMotorParameter ? handleBackToMotorSelection : handleBackToMainSelection}
                    className="w-full p-2 text-sm bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-900 dark:text-stellar-dark-text-primary rounded-md border border-gray-300 dark:border-stellar-dark-border hover:bg-gray-200 dark:hover:bg-stellar-dark-border flex items-center justify-between"
                  >
                    <span>
                      {selectedMotorParameter
                        ? `${selectedParameter}.${selectedMotorParameter}`
                        : selectedParameter
                      }
                    </span>
                    <span className="text-gray-400">×</span>
                  </button>
                </div>
              )}

              {/* Value inputs based on parameter type */}
              {selectedParameter === 'TERRAIN' ? (
                <SpecialParameterSelector
                  type="terrain"
                  searchText={terrainSearchText}
                  onSearchChange={setTerrainSearchText}
                  onSelect={handleTerrainClick}
                  onBack={handleBackToMainSelection}
                  onKeyDown={handleKeyDown}
                  highlightedIndex={highlightedIndex}
                  onHighlightChange={setHighlightedIndex}
                  activeInputField={activeInputField}
                  onFocus={() => setActiveInputField('terrain')}
                  existingParameters={existingParameters}
                />
              ) : selectedParameter === 'FAULT' ? (
                <SpecialParameterSelector
                  type="fault"
                  searchText={faultSearchText}
                  onSearchChange={setFaultSearchText}
                  onSelect={handleFaultClick}
                  onBack={handleBackToMainSelection}
                  onKeyDown={handleKeyDown}
                  highlightedIndex={highlightedIndex}
                  onHighlightChange={setHighlightedIndex}
                  activeInputField={activeInputField}
                  onFocus={() => setActiveInputField('fault')}
                  existingParameters={existingParameters}
                />
              ) : (
                // Numerical range inputs
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={minValueInputRef}
                      type="text"
                      className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'min' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
                        } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
                      placeholder="Min"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setActiveInputField('min')}
                      onBlur={validateMinMaxValues}
                    />
                    <input
                      ref={maxValueInputRef}
                      type="text"
                      className={`w-1/2 p-2 text-sm border border-gray-300 dark:border-stellar-dark-border rounded-md text-center ${activeInputField === 'max' ? 'bg-gray-100 dark:bg-stellar-dark-surface-elevated' : 'bg-white dark:bg-stellar-dark-surface'
                        } text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary`}
                      placeholder="Max"
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setActiveInputField('max')}
                      onBlur={validateMinMaxValues}
                    />
                  </div>
                  {minMaxError && (
                    <div className="text-xs text-red-500 px-1">
                      {minMaxError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instruction text */}
        <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary text-right">
          {isEditMode ? 'Use Tab or Enter to update filter' : 'Use Tab or Enter to make selection'}
        </div>
      </div>
    </div>
  );

  return createPortal(dropdownContent, document.body);
};