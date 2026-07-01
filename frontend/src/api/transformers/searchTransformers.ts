import type {
  ParameterFilter,
  SimilarityResult,
  FilterCondition,
  ExplicitQueryRequest,
  SimilarityRequest,
  SolListItem
} from '../../types';

/**
 * Transforms parameter filters to backend filter conditions
 * Handles motor parameters by extracting motor name and parameter
 */
export const transformParameterFiltersToBackend = (paramFilters: ParameterFilter[]): FilterCondition[] => {
  return paramFilters.flatMap((pf) => {
    const filters: FilterCondition[] = [];

    // Handle motor parameters - extract motor name and parameter
    if (pf.parameter.includes('.')) {
      const [motorName, motorParam] = pf.parameter.split('.');
      const baseField = `${motorName.toLowerCase()}_${motorParam.toLowerCase()}`;

      if (pf.min && pf.max) {
        // Range filter for motor parameters
        filters.push(
          { field: baseField, operator: 'gte' as const, value: Number(pf.min) },
          { field: baseField, operator: 'lte' as const, value: Number(pf.max) }
        );
      } else if (pf.min) {
        filters.push({ field: baseField, operator: 'gte' as const, value: Number(pf.min) });
      } else if (pf.max) {
        filters.push({ field: baseField, operator: 'lte' as const, value: Number(pf.max) });
      } else if (pf.value) {
        const value = isNaN(Number(pf.value)) ? pf.value : Number(pf.value);
        filters.push({ field: baseField, operator: 'eq' as const, value });
      }
    } else {
      // Handle regular parameters
      const field = pf.parameter.toLowerCase();

      if (pf.parameter === 'TERRAIN') {
        // Special handling for terrain - use exact value match
        if (pf.value) {
          filters.push({ field, operator: 'eq' as const, value: pf.value });
        }
      } else if (pf.parameter === 'FAULT') {
        // Special handling for fault - use exact value match
        if (pf.value) {
          filters.push({ field, operator: 'eq' as const, value: pf.value });
        }
      } else if (pf.min && pf.max) {
        // Range filter
        filters.push(
          { field, operator: 'gte' as const, value: Number(pf.min) },
          { field, operator: 'lte' as const, value: Number(pf.max) }
        );
      } else if (pf.min) {
        filters.push({ field, operator: 'gte' as const, value: Number(pf.min) });
      } else if (pf.max) {
        filters.push({ field, operator: 'lte' as const, value: Number(pf.max) });
      } else if (pf.value) {
        const value = isNaN(Number(pf.value)) ? pf.value : Number(pf.value);
        filters.push({ field, operator: 'eq' as const, value });
      }
    }

    return filters;
  });
};

/**
 * Transforms variables for similarity search, handling motor parameters
 */
export const transformVariablesForSimilarity = (variables: string[]): string[] => {
  return variables.map(variable => {
    // Convert motor parameters from "motor.param" format to "motor_param" format
    if (variable.includes('.')) {
      const [motorName, motorParam] = variable.split('.');
      return `${motorName.toLowerCase()}_${motorParam.toLowerCase()}`;
    }
    return variable.toLowerCase();
  });
};

/**
 * Creates a similarity search request
 */
export const createSimilaritySearchRequest = (
  searchMode: 'sol' | 'segment',
  solNumber?: string,
  segmentStartSclk?: number,
  segmentEndSclk?: number,
  variables: string[] = [],
  maxResults: number = 3
): SimilarityRequest => {
  const processedVariables = transformVariablesForSimilarity(variables);

  if (searchMode === 'segment') {
    if (segmentStartSclk === undefined || segmentEndSclk === undefined) {
      throw new Error('Segment search requires both start and end SCLK values');
    }

    return {
      reference: {
        type: 'segment' as const,
        value: {
          start_sclk: Math.min(segmentStartSclk, segmentEndSclk),
          end_sclk: Math.max(segmentStartSclk, segmentEndSclk)
        }
      },
      config: {
        algorithm: 'dtw' as const,
        variables: processedVariables,
        max_results: maxResults,
        fault_weight: 0.3,
      },
    };
  } else {
    const sol = parseInt(solNumber || '');
    if (isNaN(sol)) {
      throw new Error('Sol search requires a valid Sol number');
    }

    return {
      reference: { type: 'sol' as const, value: sol },
      config: {
        algorithm: 'dtw' as const,
        variables: processedVariables,
        max_results: maxResults,
        fault_weight: 0.3,
      },
    };
  }
};

/**
 * Creates a parameter search request
 */
export const createParameterSearchRequest = (
  parameterFilters: ParameterFilter[],
  limit: number = 50
): ExplicitQueryRequest => {
  const filters = transformParameterFiltersToBackend(parameterFilters);

  return {
    filters,
    limit,
  };
};

/**
 * Creates reference sol results for similarity search
 */
export const createReferenceSolResults = (
  searchMode: 'sol' | 'segment',
  solNumber?: string,
  segmentStartSclk?: number,
  segmentEndSclk?: number
): SimilarityResult[] => {
  if (searchMode === 'segment') {
    if (segmentStartSclk === undefined || segmentEndSclk === undefined) {
      return [];
    }

    // For segment searches, we don't create reference sol results
    // The backend will handle excluding the sols that the segment covers
    return [];
  } else {
    const sol = parseInt(solNumber || '');
    if (isNaN(sol)) {
      return [];
    }

    return [{
      sol: sol,
      similarity_score: 1.0,
      distance: 0,
      duration: 0,
      point_count: 0,
      isReference: true
    }];
  }
};

/**
 * Merges search results with reference sols
 */
export const mergeResultsWithReference = (
  results: SimilarityResult[],
  referenceSols: SimilarityResult[]
): SimilarityResult[] => {
  if (referenceSols.length === 0) {
    return results;
  }

  // Get reference sol numbers for filtering
  const referenceSolNumbers = new Set(referenceSols.map(r => r.sol));

  // Filter out reference sols from results, then add reference sols at the beginning
  const filteredResults = results.filter(r => !referenceSolNumbers.has(r.sol));
  return [...referenceSols, ...filteredResults];
};

/**
 * Transforms SolListItem to SimilarityResult format
 */
export const transformSolListToSimilarityResults = (sols: SolListItem[]): SimilarityResult[] => {
  return sols.map((sol) => ({
    sol: sol.sol,
    similarity_score: 1.0,
    distance: sol.distance,
    duration: sol.duration,
    point_count: sol.point_count,
  }));
};
