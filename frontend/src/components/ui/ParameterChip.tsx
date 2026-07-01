import React from 'react';
import { XIcon } from 'lucide-react';

export interface ParameterChipProps {
  mode: 'parameter-only' | 'parameter-value';
  label: string;
  value?: string | { min?: string; max?: string };
  onEdit: (event?: React.MouseEvent) => void;
  onRemove: () => void;
  className?: string;
}

export const ParameterChip: React.FC<ParameterChipProps> = ({
  mode,
  label,
  value,
  onEdit,
  onRemove,
  className = '',
}) => {
  const renderValue = () => {
    // Handle non-range parameters (TERRAIN, FAULT, motor parameters)
    if (typeof value === 'string') {
      return (
        <span className="text-xs uppercase bg-gray-100 dark:bg-stellar-dark-surface px-1.5 py-0.5 rounded text-gray-700 dark:text-stellar-dark-text-secondary">
          {value}
        </span>
      );
    }

    // Handle min/max object for range parameters
    if (!value) return null;

    const { min, max } = value;
    if (!min && !max) return null;

    const displayValue = min && max ? `${min}-${max}` :
      min ? `≥${min}` :
        max ? `≤${max}` : '';

    return (
      <span className="text-xs uppercase bg-gray-100 dark:bg-stellar-dark-surface px-1.5 py-0.5 rounded text-gray-700 dark:text-stellar-dark-text-secondary">
        {displayValue}
      </span>
    );
  };

  const handleChipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(e);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      className={`bg-white dark:bg-stellar-dark-surface rounded-full px-3 py-1 flex items-center gap-1 shadow-sm cursor-pointer ${className}`}
      onClick={handleChipClick}
    >
      <span className="text-sm font-medium uppercase text-gray-900 dark:text-stellar-dark-text-primary">
        {label}
      </span>
      {renderValue()}
      <button onClick={handleRemoveClick}>
        <XIcon className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:text-stellar-dark-text-secondary dark:hover:text-stellar-dark-text-primary ml-1" />
      </button>
    </div>
  );
};
