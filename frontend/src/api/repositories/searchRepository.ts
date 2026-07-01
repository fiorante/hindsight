import { apiClient } from '../client';
import type {
  SimilarityRequest,
  SimilaritySearchResponse,
  ExplicitQueryRequest,
  SolListItem
} from '../../types';

/**
 * Repository for search-related API calls
 * Handles both similarity and parameter-based searches
 */
export class SearchRepository {
  /**
   * Execute similarity search
   */
  async findSimilarSols(request: SimilarityRequest): Promise<SimilaritySearchResponse> {
    const response = await apiClient.post('/query/similar', request);
    return response.data;
  }

  /**
   * Execute parameter-based search
   */
  async findSolsByParameters(request: ExplicitQueryRequest): Promise<SolListItem[]> {
    const response = await apiClient.post('/query/explicit', request);
    return response.data;
  }
}

// Export singleton instance
export const searchRepository = new SearchRepository();
