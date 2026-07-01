import { useQuery, useQueries } from '@tanstack/react-query';
import { solRepository } from '../api/repositories/solRepository';
import type { SolData } from '../types';

/**
 * Hook for fetching list of all available sols
 */
export const useSolsList = () => {
  return useQuery({
    queryKey: ['solsList'],
    queryFn: () => solRepository.getSolsList(),
    staleTime: 30 * 60 * 1000, // 30 minutes - sol list doesn't change often
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

/**
 * Hook for fetching detailed data for a single sol
 */
export const useSolData = (sol: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['solData', sol],
    queryFn: () => solRepository.getSolData(sol),
    enabled: enabled && !!sol,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

/**
 * Hook for fetching data for multiple sols efficiently
 */
export const useSolsData = (sols: number[], enabled: boolean = true) => {
  return useQueries({
    queries: sols.map(sol => ({
      queryKey: ['solData', sol],
      queryFn: () => solRepository.getSolData(sol),
      enabled: enabled && !!sol,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    })),
  });
};

/**
 * Hook for batch fetching sols data (alternative approach)
 * Use this when you need all data at once vs individual queries
 */
export const useBatchSolsData = (sols: number[], enabled: boolean = true) => {
  return useQuery({
    queryKey: ['batchSolsData', sols.sort().join(',')],
    queryFn: () => solRepository.getSolsData(sols),
    enabled: enabled && sols.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export interface UseSolResult {
  data: SolData | null;
  isLoading: boolean;
  error: unknown | null;
}

/**
 * Fetch sol data for a specific sol number.
 * Uses React Query for caching/deduplication.
 */
export function useSol(sol: number | null): UseSolResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sol', sol],
    queryFn: async () => {
      if (!sol) return null;
      return await solRepository.getSolData(sol);
    },
    enabled: Boolean(sol),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return { data, isLoading, error };
}
