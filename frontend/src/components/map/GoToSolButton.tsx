import React, { useState, useEffect, useRef } from 'react';
import { SearchIcon, XCircleIcon, PlusIcon } from 'lucide-react';
import { useDriveState } from '../providers/DriveStateProvider';

interface GoToSolButtonProps {
  onSolFocus: (sol: string | null) => void;
  onAddDrive?: (sol: string) => void;
  mode?: 'map' | 'drives';
}

export const GoToSolButton: React.FC<GoToSolButtonProps> = ({ onSolFocus, onAddDrive, mode = 'map' }) => {
  const { selectedDrives, maxSelectedDrives } = useDriveState();
  const [solSearchText, setSolSearchText] = useState('');
  const [focusedSol, setFocusedSol] = useState<string | null>(null);
  const [savedSolForMap, setSavedSolForMap] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const prevModeRef = useRef<'map' | 'drives'>(mode);

  // Collapse and manage focusedSol when mode changes
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      // Always collapse on mode change
      setIsSearching(false);

      if (prevModeRef.current === 'map' && mode === 'drives') {
        // Save current focusedSol to restore later and hide while in drives mode
        if (focusedSol) setSavedSolForMap(focusedSol);
        setFocusedSol(null);
      } else if (prevModeRef.current === 'drives' && mode === 'map') {
        // Restore saved focused sol when returning to map
        if (savedSolForMap) setFocusedSol(savedSolForMap);
      }

      prevModeRef.current = mode;
    }
  }, [mode, focusedSol, savedSolForMap]);

  const handleSolSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (solSearchText.trim()) {
      const sol = solSearchText.trim();
      if (mode === 'drives' && onAddDrive) {
        onAddDrive(sol);
        setIsSearching(false);
        setSolSearchText('');
        setFocusedSol(null);
        return;
      }
      onSolFocus(sol);
      setFocusedSol(sol);
    }
    setIsSearching(false);
  };

  const clearFocusedSol = () => {
    setFocusedSol(null);
    setSolSearchText('');
    onSolFocus(null);
  };

  // Handle input fade-in timing
  useEffect(() => {
    if (isSearching) {
      // Show input after width transition completes (200ms)
      const timer = setTimeout(() => {
        setShowInput(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      // Hide input immediately when not searching
      setShowInput(false);
    }
  }, [isSearching]);

  const isExpanded = focusedSol || isSearching;
  const isAtMaxPanels = mode === 'drives' && selectedDrives.length >= maxSelectedDrives;
  const disabledTooltip = isAtMaxPanels ? 'Maximum number of drive panels reached' : undefined;

  return (
    <div className="w-48 h-12 pointer-events-auto flex justify-end items-center">
      <div
        className={`bg-white dark:bg-stellar-dark-surface rounded-full shadow-md flex items-center h-12 overflow-hidden transition-[width] duration-200 ease-in-out ${isExpanded ? 'w-full px-4 gap-2' : 'w-12 justify-center px-0 gap-0'} shrink-0 ${isAtMaxPanels ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated cursor-pointer'}`}
        onClick={!isExpanded && !isAtMaxPanels ? () => setIsSearching(true) : undefined}
        aria-disabled={isAtMaxPanels}
        title={disabledTooltip}
      >
        {/* Icon - search in map mode, plus in drives mode */}
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          {mode === 'drives' ? (
            <PlusIcon className="h-6 w-6 text-gray-600 dark:text-stellar-dark-text-secondary" />
          ) : (
            <SearchIcon className="h-6 w-6 text-gray-600 dark:text-stellar-dark-text-secondary" />
          )}
        </div>

        {/* Expanded content: either input or focused sol; hidden when collapsed */}
        <div className={`${isExpanded ? 'flex flex-1 items-center min-w-0' : 'hidden'}`}>
          {isSearching ? (
            <form onSubmit={handleSolSearch} className="flex items-center w-24 min-w-[6rem]">
              <input
                type="text"
                value={solSearchText}
                onChange={(e) => setSolSearchText(e.target.value)}
                onBlur={() => {
                  if (!solSearchText.trim()) {
                    setIsSearching(false);
                  }
                }}
                placeholder="Enter Sol #"
                className={`border-none focus:ring-0 focus:outline-none text-sm w-full bg-transparent transition-opacity ease-in-out duration-200 ${showInput ? 'opacity-100' : 'opacity-0'} placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary text-gray-900 dark:text-stellar-dark-text-primary leading-none h-6 pl-1`}
                autoFocus
              />
            </form>
          ) : (
            focusedSol && (
              <>
                <span className="text-sm font-medium text-gray-700 dark:text-stellar-dark-text-primary flex-1">Sol {focusedSol}</span>
                <button onClick={clearFocusedSol} className="text-gray-400 dark:text-stellar-dark-text-secondary hover:text-gray-600 dark:hover:text-stellar-dark-text-primary flex-shrink-0" aria-label="Clear focused sol">
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};


