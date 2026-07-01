import { apiClient } from '../client';
import { appCache } from '../cache';
import {
  getAvailableParameters as getAvailableParameterMetadata,
} from '../../constants/parameters';

export interface ChartDataPoint {
  sclk: number;
  value: number | null;
}

export interface ChartDataResponse {
  sol: number;
  parameter: string;
  data: ChartDataPoint[];
  min_value: number | null;
  max_value: number | null;
}

export interface ChartParameter {
  parameter: string;
  displayName: string;
  unit?: string;
}

export class TelemetryRepository {
  /**
   * Fetch telemetry data for a specific parameter from a sol
   */
  async getTelemetryData(sol: number, parameter: string): Promise<ChartDataResponse> {
    try {
      // Cache key: sol|param(lowercased)
      const wireParam = parameter.toLowerCase();
      const cacheKey = `${sol}|${wireParam}`;

      const cached = appCache.get<ChartDataResponse>('telemetry', cacheKey);
      if (cached) {
        return cached;
      }

      // Special handling for fault data - use the dedicated faults endpoint
      if (wireParam === 'fault') {
        const faultsResponse = await apiClient.get<any[]>(`/faults/${sol}`);
        const faults = faultsResponse.data;

        // Convert fault data to ChartDataResponse format
        const chartData = faults.map(fault => ({
          sclk: fault.sclk,
          value: fault.fault_type
        }));

        const data: ChartDataResponse = {
          sol,
          parameter: 'fault',
          data: chartData,
          min_value: null,
          max_value: null
        };

        appCache.set('telemetry', cacheKey, data);
        return data;
      }

      const response = await apiClient.get<ChartDataResponse>(
        `/telemetry/${sol}/${encodeURIComponent(wireParam)}`
      );
      const data = response.data;
      appCache.set('telemetry', cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch telemetry data for sol ${sol}, parameter ${parameter}:`, error);
      throw new Error(`Failed to fetch telemetry data: ${error}`);
    }
  }

  /**
   * Fetch just the min/max range for a specific parameter from a sol
   * This is an optimized method that only returns aggregate statistics.
   */
  async getTelemetryRange(sol: number, parameter: string): Promise<{ min_value: number | null, max_value: number | null }> {
    try {
      // Cache key: sol|param(lowercased)|range
      const wireParam = parameter.toLowerCase();
      const cacheKey = `${sol}|${wireParam}|range`;

      const cached = appCache.get<{ min_value: number | null, max_value: number | null }>('telemetry', cacheKey);
      if (cached) {
        return cached;
      }

      const response = await apiClient.get<{ min_value: number | null, max_value: number | null }>(
        `/telemetry/${sol}/${encodeURIComponent(wireParam)}/range`
      );
      const data = response.data;
      appCache.set('telemetry', cacheKey, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch telemetry range for sol ${sol}, parameter ${parameter}:`, error);
      throw new Error(`Failed to fetch telemetry range: ${error}`);
    }
  }

  /**
   * Get available chart parameters with their display names and units
   */
  getAvailableParameters(): ChartParameter[] {
    return getAvailableParameterMetadata();
  }

  /**
   * Get parameter display name from parameter string
   */
  getParameterDisplayName(parameter: string): string {
    // Always use the raw parameter string for display
    return parameter;
  }


}

export const telemetryRepository = new TelemetryRepository();
