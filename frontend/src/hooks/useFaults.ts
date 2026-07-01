import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { FaultRecord } from '../types';

/**
 * Hook to fetch fault data for a specific sol
 */
export function useFaults(sol: number | null) {
  return useQuery({
    queryKey: ['faults', sol],
    queryFn: async (): Promise<FaultRecord[]> => {
      if (!sol) return [];

      try {
        const response = await apiClient.get<FaultRecord[]>(`/faults/${sol}`);
        return response.data;
      } catch (error: any) {
        // If we get a 404 error, the sol doesn't exist - throw the error
        if (error.response?.status === 404) {
          throw error;
        }
        // For other errors, treat it as no faults found
        console.warn(`Failed to fetch faults for sol ${sol}:`, error.response?.status, error.response?.data);
        return [];
      }
    },
    enabled: Boolean(sol),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
