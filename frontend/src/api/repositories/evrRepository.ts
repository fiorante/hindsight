import type { EVRRecord } from '../../types';
import { API_BASE_URL } from '../client';
import { appCache } from '../cache';

/**
 * Repository for EVR (Event Record) data operations
 */
class EVRRepository {

  /**
   * Get EVR data for a specific sol
   */
  async getEVRSForSol(sol: number): Promise<EVRRecord[]> {
    // Check cache first
    const cacheKey = `${sol}`;
    const cached = appCache.get<EVRRecord[]>('evrs', cacheKey);
    if (cached) {
      return cached;
    }

    const response = await fetch(`${API_BASE_URL}/evrs/${sol}`);

    if (!response.ok) {
      if (response.status === 404) {
        appCache.set('evrs', cacheKey, []);
        return [];
      }
      throw new Error(`Failed to fetch EVRs for sol ${sol}: ${response.statusText}`);
    }

    const data = (await response.json()) as EVRRecord[];
    appCache.set('evrs', cacheKey, data);
    return data;
  }

  /**
   * Get EVR data for multiple sols
   */
  async getEVRSForSols(sols: number[]): Promise<{ sol: number; evrs: EVRRecord[] }[]> {
    const promises = sols.map(async (sol) => {
      try {
        const evrs = await this.getEVRSForSol(sol);
        return { sol, evrs };
      } catch (error) {
        console.warn(`Failed to fetch EVRs for sol ${sol}:`, error);
        return { sol, evrs: [] };
      }
    });

    return Promise.all(promises);
  }

  async streamEVRS(params: {
    sol: number;
    limit?: number;
    cursor_sclk?: number | null;
    cursor_log?: number | null;
    dir?: 'next' | 'prev';
    q?: string;
    level?: string[];
    module?: string[];
    name?: string[];
  }): Promise<{
    items: EVRRecord[];
    next_cursor_sclk?: number | null;
    next_cursor_log?: number | null;
    prev_cursor_sclk?: number | null;
    prev_cursor_log?: number | null;
    total_returned: number;
  }> {
    const {
      sol,
      limit = 1000,
      cursor_sclk,
      cursor_log,
      dir = 'next',
      q,
      level,
      module,
      name,
    } = params

    const url = new URL(`${API_BASE_URL}/evrs/${sol}/stream`)
    url.searchParams.set('limit', String(limit))
    if (cursor_sclk != null && cursor_log != null) {
      url.searchParams.set('cursor_sclk', String(cursor_sclk))
      url.searchParams.set('cursor_log', String(cursor_log))
    }
    url.searchParams.set('dir', dir)
    if (q) url.searchParams.set('q', q)
    level?.forEach((v) => url.searchParams.append('level', v))
    module?.forEach((v) => url.searchParams.append('module', v))
    name?.forEach((v) => url.searchParams.append('name', v))

    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Failed to stream EVRs: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  async searchNearest(params: {
    sol: number;
    from_sclk: number;
    dir?: 'next' | 'prev';
    q?: string;
    level?: string[];
    module?: string[];
    name?: string[];
  }): Promise<EVRRecord | null> {
    const { sol, from_sclk, dir = 'next', q, level, module, name } = params
    const url = new URL(`${API_BASE_URL}/evrs/${sol}/search/nearest`)
    url.searchParams.set('from_sclk', String(from_sclk))
    url.searchParams.set('dir', dir)
    if (q) url.searchParams.set('q', q)
    level?.forEach((v) => url.searchParams.append('level', v))
    module?.forEach((v) => url.searchParams.append('module', v))
    name?.forEach((v) => url.searchParams.append('name', v))

    const res = await fetch(url.toString())
    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`Failed to search nearest EVR: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }

  async getFacets(sol: number, q?: string): Promise<{ modules: { value: string; count: number }[]; names: { value: string; count: number }[]; levels: { value: string; count: number }[]; }> {
    const url = new URL(`${API_BASE_URL}/evrs/${sol}/facets`)
    if (q) url.searchParams.set('q', q)
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Failed to get EVR facets: ${res.status} ${res.statusText}`)
    }
    return res.json()
  }
}

// Export singleton instance
export const evrRepository = new EVRRepository();
export { EVRRepository };
