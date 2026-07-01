import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { telemetryRepository } from '../api/repositories';

export interface TelemetryRange {
  min: number | null;
  max: number | null;
}

export interface UseTelemetryRangesResult {
  ranges: Record<string, TelemetryRange>;
  isLoading: boolean;
  error: unknown | null;
}

/**
 * Fetch min/max ranges for a set of telemetry parameters for a given sol.
 * Uses React Query for caching/deduplication per (sol, parameter).
 */
export function useTelemetryRanges(
  sol: number | null,
  parameters: string[]
): UseTelemetryRangesResult {
  const enabled = Boolean(sol) && parameters.length > 0;

  const queries = useQueries({
    queries: parameters.map((parameter) => ({
      queryKey: ['telemetry', 'range', sol, parameter],
      queryFn: async () => {
        // Use the optimized range-only endpoint
        const resp = await telemetryRepository.getTelemetryRange(sol as number, parameter);
        return { min: resp.min_value ?? null, max: resp.max_value ?? null } as TelemetryRange;
      },
      enabled,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error ?? null;

  const ranges = useMemo(() => {
    const map: Record<string, TelemetryRange> = {};
    parameters.forEach((parameter, index) => {
      const data = queries[index]?.data as TelemetryRange | undefined;
      map[parameter] = data ?? { min: null, max: null };
    });
    return map;
  }, [parameters, queries]);

  return { ranges, isLoading, error };
}


