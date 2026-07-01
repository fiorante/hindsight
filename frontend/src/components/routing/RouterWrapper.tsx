import React, { useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../state/store';

interface RouterWrapperProps {
  children: React.ReactNode;
}

/**
 * Router wrapper that handles URL state synchronization
 */
export const RouterWrapper: React.FC<RouterWrapperProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const setNavigate = useAppStore((state) => state.setNavigate);
  const hydrateFromUrl = useAppStore((state) => state.hydrateFromUrl);
  const finishHydration = useAppStore((state) => state.finishHydration);
  const isHydrating = useAppStore((state) => state.isHydrating);
  const setUpdatingFromUrl = useAppStore((state) => state.setUpdatingFromUrl);
  const setViewMode = useAppStore((state) => state.setViewMode);

  // Set up the navigate function in the store
  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  // Handle initial URL hydration and route changes
  useEffect(() => {
    const viewMode = params.view as 'map' | 'drives' | undefined;

    // Set updating from URL flag to prevent sync loops
    setUpdatingFromUrl(true);

    // Update view mode based on route
    if (viewMode && ['map', 'drives'].includes(viewMode)) {
      setViewMode(viewMode);
    } else if (!viewMode) {
      // Default to map view if no view specified
      setViewMode('map');
    }

    // Hydrate state from URL parameters
    hydrateFromUrl(searchParams);

    // Small delay to allow state updates to complete
    setTimeout(() => {
      finishHydration();
    }, 0);
  }, [location.pathname, location.search, params.view, searchParams, hydrateFromUrl, finishHydration, setViewMode, setUpdatingFromUrl]);

  // Handle URL changes without re-rendering components
  useEffect(() => {
    const handlePopState = () => {
      // Only handle popstate events, not programmatic URL changes
      if (!isHydrating) {
        setUpdatingFromUrl(true);
        const currentSearchParams = new URLSearchParams(window.location.search);
        hydrateFromUrl(currentSearchParams);
        setTimeout(() => {
          finishHydration();
        }, 0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isHydrating, hydrateFromUrl, finishHydration, setUpdatingFromUrl]);

  // Show loading state during hydration
  if (isHydrating) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-stellar-dark-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-stellar-dark-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
