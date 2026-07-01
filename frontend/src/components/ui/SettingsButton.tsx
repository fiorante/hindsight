import React, { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const SettingsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    setIsOpen(false);
  };

  return (
    <div className="w-12 h-12 pointer-events-auto flex justify-center items-center" ref={dropdownRef}>
      <div className="relative">
        <div
          className="bg-white dark:bg-stellar-dark-surface rounded-full shadow-md flex items-center justify-center h-12 w-12 hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated cursor-pointer transition-colors"
          onClick={toggleDropdown}
        >
          <Settings className="h-6 w-6 text-gray-600 dark:text-stellar-dark-text-secondary" />
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-14 right-0 bg-white dark:bg-stellar-dark-surface rounded-lg shadow-lg border border-gray-200 dark:border-stellar-dark-border py-2 min-w-[200px] z-50">
            {/* Light/Dark Mode Toggle */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-stellar-dark-text-primary">Theme</span>
                <button
                  onClick={handleThemeToggle}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated transition-colors"
                >
                  {isDarkMode ? (
                    <>
                      <Moon className="h-4 w-4 text-gray-600 dark:text-stellar-dark-text-secondary" />
                      <span className="text-sm text-gray-600 dark:text-stellar-dark-text-secondary">Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="h-4 w-4 text-gray-600 dark:text-stellar-dark-text-secondary" />
                      <span className="text-sm text-gray-600 dark:text-stellar-dark-text-secondary">Light</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
