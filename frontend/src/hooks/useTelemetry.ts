import { useState, useEffect, useCallback } from 'react';
import { telemetryRepository, type ChartDataResponse } from '../api/repositories';

interface UseTelemetryDataResult {
  data: ChartDataResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTelemetryData(sol: number | null, parameter: string | null): UseTelemetryDataResult {
  const [data, setData] = useState<ChartDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sol || !parameter) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await telemetryRepository.getTelemetryData(sol, parameter);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [sol, parameter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch
  };
}

// Hook for managing multiple telemetry parameters for a sol
interface UseMultipleTelemetryResult {
  telemetryData: Record<string, ChartDataResponse>;
  loadingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  fetchTelemetry: (parameter: string) => void;
  removeTelemetry: (parameter: string) => void;
}

export function useMultipleTelemetry(sol: number | null): UseMultipleTelemetryResult {
  const [telemetryData, setTelemetryData] = useState<Record<string, ChartDataResponse>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const fetchTelemetry = useCallback(async (parameter: string) => {
    if (!sol) {
      return;
    }

    // Avoid duplicate requests: skip if already loading or already fetched
    if (loadingStates[parameter] || telemetryData[parameter]) {
      return;
    }

    setLoadingStates(prev => ({ ...prev, [parameter]: true }));
    setErrors(prev => ({ ...prev, [parameter]: null }));

    try {
      const result = await telemetryRepository.getTelemetryData(sol, parameter);
      setTelemetryData(prev => ({ ...prev, [parameter]: result }));
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        [parameter]: err instanceof Error ? err.message : 'Failed to fetch telemetry data'
      }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [parameter]: false }));
    }
  }, [sol, loadingStates, telemetryData]);

  const removeTelemetry = useCallback((parameter: string) => {
    setTelemetryData(prev => {
      const newData = { ...prev };
      delete newData[parameter];
      return newData;
    });
    setLoadingStates(prev => {
      const newStates = { ...prev };
      delete newStates[parameter];
      return newStates;
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[parameter];
      return newErrors;
    });
  }, []);

  // Clear all data when sol changes
  useEffect(() => {
    setTelemetryData({});
    setLoadingStates({});
    setErrors({});
  }, [sol]);

  return {
    telemetryData,
    loadingStates,
    errors,
    fetchTelemetry,
    removeTelemetry
  };
}
