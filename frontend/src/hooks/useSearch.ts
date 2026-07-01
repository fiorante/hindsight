import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { searchRepository } from '../api/repositories/searchRepository';
import {
  createSimilaritySearchRequest,
  createParameterSearchRequest,
  createReferenceSolResults,
  mergeResultsWithReference,
  transformSolListToSimilarityResults
} from '../api/transformers/searchTransformers';
import type { ParameterFilter, SimilarityResult } from '../types';

interface SearchOptions {
  onSuccess?: (results: SimilarityResult[], referenceSol?: number | null) => void;
  onError?: (error: string) => void;
}

interface SimilaritySearchOptions extends SearchOptions {
  solNumber?: string;
  segmentStartSclk?: number;
  segmentEndSclk?: number;
}

/**
 * Comprehensive search hook using repository pattern
 * Handles both similarity and parameter searches with proper error handling
 */
export const useSearch = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Similarity search mutation
  const similarityMutation = useMutation({
    mutationFn: searchRepository.findSimilarSols,
  });

  // Parameter search mutation
  const parameterMutation = useMutation({
    mutationFn: searchRepository.findSolsByParameters,
  });

  const executeSimilaritySearch = async (
    searchMode: 'sol' | 'segment',
    variables: string[],
    options: SimilaritySearchOptions
  ) => {
    setIsSearching(true);
    try {
      // Validate inputs
      if (variables.length === 0) {
        throw new Error('Please select at least one variable for similarity comparison');
      }

      if (searchMode === 'segment' && (!options.segmentStartSclk || !options.segmentEndSclk)) {
        throw new Error('Please select both start and end markers on the map');
      }

      if (searchMode === 'sol' && !options.solNumber) {
        throw new Error('Please enter a valid Sol number');
      }

      // Create search request
      const searchRequest = createSimilaritySearchRequest(
        searchMode,
        options.solNumber,
        options.segmentStartSclk,
        options.segmentEndSclk,
        variables,
        3
      );

      // Execute search
      const result = await similarityMutation.mutateAsync(searchRequest);

      // Create reference results
      const referenceSols = createReferenceSolResults(
        searchMode,
        options.solNumber,
        options.segmentStartSclk,
        options.segmentEndSclk
      );

      // Merge results
      const finalResults = mergeResultsWithReference(result.results, referenceSols);

      // Determine reference sol number for sol-based search
      const referenceSolNumber = searchMode === 'sol' && options.solNumber
        ? parseInt(options.solNumber)
        : null;

      options.onSuccess?.(finalResults, referenceSolNumber);
    } catch (error: any) {
      options.onError?.(error.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const executeParameterSearch = async (
    parameterFilters: ParameterFilter[],
    options: SearchOptions
  ) => {
    setIsSearching(true);
    try {
      if (parameterFilters.length === 0) {
        throw new Error('Please add at least one parameter filter');
      }

      // Create search request
      const searchRequest = createParameterSearchRequest(parameterFilters, 50);

      // Execute search
      const sols = await parameterMutation.mutateAsync(searchRequest);

      // Transform to SimilarityResult format
      const results = transformSolListToSimilarityResults(sols);

      options.onSuccess?.(results, null);
    } catch (error: any) {
      options.onError?.(error.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  return {
    isSearching,
    hasSearched,
    executeSimilaritySearch,
    executeParameterSearch,
    // Expose loading states for individual mutations if needed
    isSimilaritySearchLoading: similarityMutation.isPending,
    isParameterSearchLoading: parameterMutation.isPending,
  };
};
