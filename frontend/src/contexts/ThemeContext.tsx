import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Always use dark mode
  useEffect(() => {
    setIsDarkMode(true);
    updateDocumentTheme(true);
  }, []);

  // Apply theme to document
  const updateDocumentTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    updateDocumentTheme(newIsDarkMode);
    localStorage.setItem('mars-paths-theme', newIsDarkMode ? 'dark' : 'light');
  };

  const setTheme = (theme: 'light' | 'dark') => {
    const isDark = theme === 'dark';
    setIsDarkMode(isDark);
    updateDocumentTheme(isDark);
    localStorage.setItem('mars-paths-theme', theme);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
