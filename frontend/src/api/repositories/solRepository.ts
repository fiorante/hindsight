import { apiClient } from '../client';
import { appCache } from '../cache';
import type { SolListItem, SolData } from '../../types';

/**
 * Repository for sol-related data API calls
 */
export class SolRepository {
  /**
   * Get list of all available sols
   */
  async getSolsList(): Promise<SolListItem[]> {
    const cacheKey = 'list';
    const cached = appCache.get<SolListItem[]>('sols', cacheKey);
    if (cached) return cached;
    const response = await apiClient.get('/sols');
    const data = response.data as SolListItem[];
    appCache.set('sols', cacheKey, data);
    return data;
  }

  /**
   * Get detailed data for a specific sol
   */
  async getSolData(sol: number): Promise<SolData> {
    const cacheKey = `${sol}`;
    const cached = appCache.get<SolData>('sols', cacheKey);
    if (cached) return cached;
    const response = await apiClient.get(`/sols/${sol}`);
    const data = response.data as SolData;
    appCache.set('sols', cacheKey, data);
    return data;
  }

  /**
   * Get data for multiple sols
   */
  async getSolsData(sols: number[]): Promise<SolData[]> {
    // If no sols provided, return empty array
    if (sols.length === 0) {
      return [];
    }

    // For small numbers of sols, make parallel requests
    if (sols.length <= 5) {
      const promises = sols.map(sol => this.getSolData(sol));
      return Promise.all(promises);
    }

    // For larger numbers, use batch endpoint if available
    // Otherwise fall back to parallel requests with chunking
    const responses = await Promise.all(
      sols.map(sol => this.getSolData(sol))
    );
    return responses;
  }
}

// Export singleton instance
export const solRepository = new SolRepository();
