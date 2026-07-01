import { describe, it, expect } from 'vitest'
import {
  transformParameterFiltersToBackend,
  transformVariablesForSimilarity,
  createSimilaritySearchRequest,
  createParameterSearchRequest,
  createReferenceSolResults,
  mergeResultsWithReference,
  transformSolListToSimilarityResults
} from '../searchTransformers'
import type { ParameterFilter, SimilarityResult, SolListItem } from '../../../types'

describe('searchTransformers', () => {
  describe('transformParameterFiltersToBackend', () => {
    it('should transform regular parameter range filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'elevation', min: '100', max: '200' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'elevation', operator: 'gte', value: 100 },
        { field: 'elevation', operator: 'lte', value: 200 }
      ])
    })

    it('should transform motor parameter range filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'DRIVE_LF.ANGLE', min: '10', max: '90' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'drive_lf_angle', operator: 'gte', value: 10 },
        { field: 'drive_lf_angle', operator: 'lte', value: 90 }
      ])
    })

    it('should transform single value filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'slope', value: '15' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'slope', operator: 'eq', value: 15 }
      ])
    })

    it('should handle terrain special case', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'TERRAIN', value: 'rocky' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'terrain', operator: 'eq', value: 'rocky' }
      ])
    })

    it('should handle fault special case', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'FAULT', value: 'motor_error' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'fault', operator: 'eq', value: 'motor_error' }
      ])
    })

    it('should handle min-only filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'distance', min: '500' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'distance', operator: 'gte', value: 500 }
      ])
    })

    it('should handle max-only filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'duration', max: '3600' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'duration', operator: 'lte', value: 3600 }
      ])
    })

    it('should handle string values that cannot be converted to numbers', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'status', value: 'active' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'status', operator: 'eq', value: 'active' }
      ])
    })

    it('should handle multiple filters', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'elevation', min: '100', max: '200' },
        { parameter: 'slope', value: '15' },
        { parameter: 'DRIVE_RF.SPEED', min: '0', max: '50' }
      ]

      const result = transformParameterFiltersToBackend(filters)

      expect(result).toEqual([
        { field: 'elevation', operator: 'gte', value: 100 },
        { field: 'elevation', operator: 'lte', value: 200 },
        { field: 'slope', operator: 'eq', value: 15 },
        { field: 'drive_rf_speed', operator: 'gte', value: 0 },
        { field: 'drive_rf_speed', operator: 'lte', value: 50 }
      ])
    })

    it('should handle empty filters array', () => {
      const result = transformParameterFiltersToBackend([])
      expect(result).toEqual([])
    })
  })

  describe('transformVariablesForSimilarity', () => {
    it('should transform motor variables', () => {
      const variables = ['DRIVE_LF.ANGLE', 'DRIVE_RF.SPEED']
      const result = transformVariablesForSimilarity(variables)

      expect(result).toEqual(['drive_lf_angle', 'drive_rf_speed'])
    })

    it('should transform regular variables to lowercase', () => {
      const variables = ['ELEVATION', 'Slope', 'distance']
      const result = transformVariablesForSimilarity(variables)

      expect(result).toEqual(['elevation', 'slope', 'distance'])
    })

    it('should handle mixed variable types', () => {
      const variables = ['elevation', 'DRIVE_LF.ANGLE', 'Slope']
      const result = transformVariablesForSimilarity(variables)

      expect(result).toEqual(['elevation', 'drive_lf_angle', 'slope'])
    })

    it('should handle empty array', () => {
      const result = transformVariablesForSimilarity([])
      expect(result).toEqual([])
    })
  })

  describe('createSimilaritySearchRequest', () => {
    it('should create sol-based similarity request', () => {
      const result = createSimilaritySearchRequest(
        'sol',
        '1041',
        undefined,
        undefined,
        ['elevation', 'slope'],
        5
      )

      expect(result).toEqual({
        reference: { type: 'sol', value: 1041 },
        config: {
          algorithm: 'dtw',
          variables: ['elevation', 'slope'],
          max_results: 5,
          fault_weight: 0.3
        }
      })
    })

    it('should create segment-based similarity request', () => {
      const result = createSimilaritySearchRequest(
        'segment',
        undefined,
        123456789,
        123456800,
        ['elevation', 'DRIVE_LF.ANGLE'],
        3
      )

      expect(result).toEqual({
        reference: {
          type: 'segment',
          value: {
            start_sclk: 123456789,
            end_sclk: 123456800
          }
        },
        config: {
          algorithm: 'dtw',
          variables: ['elevation', 'drive_lf_angle'],
          max_results: 3,
          fault_weight: 0.3
        }
      })
    })

    it('should handle reversed SCLK values in segment mode', () => {
      const result = createSimilaritySearchRequest(
        'segment',
        undefined,
        123456800, // End before start
        123456789,
        ['elevation']
      )

      expect(result.reference.value).toEqual({
        start_sclk: 123456789, // Should be swapped to correct order
        end_sclk: 123456800
      })
    })

    it('should throw error for segment mode without SCLK values', () => {
      expect(() => {
        createSimilaritySearchRequest('segment', undefined, undefined, undefined, ['elevation'])
      }).toThrow('Segment search requires both start and end SCLK values')
    })

    it('should throw error for sol mode with invalid sol number', () => {
      expect(() => {
        createSimilaritySearchRequest('sol', 'invalid', undefined, undefined, ['elevation'])
      }).toThrow('Sol search requires a valid Sol number')
    })

    it('should use default values', () => {
      const result = createSimilaritySearchRequest('sol', '1041')

      expect(result.config.variables).toEqual([])
      expect(result.config.max_results).toBe(3)
    })
  })

  describe('createParameterSearchRequest', () => {
    it('should create parameter search request', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'elevation', min: '100', max: '200' },
        { parameter: 'slope', value: '15' }
      ]

      const result = createParameterSearchRequest(filters, 25)

      expect(result).toEqual({
        filters: [
          { field: 'elevation', operator: 'gte', value: 100 },
          { field: 'elevation', operator: 'lte', value: 200 },
          { field: 'slope', operator: 'eq', value: 15 }
        ],
        limit: 25
      })
    })

    it('should use default limit', () => {
      const filters: ParameterFilter[] = [
        { parameter: 'elevation', min: '100', max: '200' }
      ]

      const result = createParameterSearchRequest(filters)

      expect(result.limit).toBe(50)
    })
  })

  describe('createReferenceSolResults', () => {
    it('should create reference sol for sol mode', () => {
      const result = createReferenceSolResults('sol', '1041')

      expect(result).toEqual([{
        sol: 1041,
        similarity_score: 1.0,
        distance: 0,
        duration: 0,
        point_count: 0,
        isReference: true
      }])
    })

    it('should return empty array for segment mode', () => {
      const result = createReferenceSolResults('segment', undefined, 123456789, 123456800)

      expect(result).toEqual([])
    })

    it('should return empty array for invalid sol number', () => {
      const result = createReferenceSolResults('sol', 'invalid')

      expect(result).toEqual([])
    })

    it('should return empty array for segment mode without SCLK', () => {
      const result = createReferenceSolResults('segment')

      expect(result).toEqual([])
    })
  })

  describe('mergeResultsWithReference', () => {
    it('should merge results with reference sols', () => {
      const results: SimilarityResult[] = [
        { sol: 1042, similarity_score: 0.95, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1043, similarity_score: 0.87, distance: 200, duration: 7200, point_count: 75 }
      ]

      const reference: SimilarityResult[] = [
        { sol: 1041, similarity_score: 1.0, distance: 0, duration: 0, point_count: 0, isReference: true }
      ]

      const result = mergeResultsWithReference(results, reference)

      expect(result).toEqual([
        { sol: 1041, similarity_score: 1.0, distance: 0, duration: 0, point_count: 0, isReference: true },
        { sol: 1042, similarity_score: 0.95, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1043, similarity_score: 0.87, distance: 200, duration: 7200, point_count: 75 }
      ])
    })

    it('should filter out duplicate reference sols from results', () => {
      const results: SimilarityResult[] = [
        { sol: 1041, similarity_score: 0.98, distance: 10, duration: 100, point_count: 20 },
        { sol: 1042, similarity_score: 0.95, distance: 100, duration: 3600, point_count: 50 }
      ]

      const reference: SimilarityResult[] = [
        { sol: 1041, similarity_score: 1.0, distance: 0, duration: 0, point_count: 0, isReference: true }
      ]

      const result = mergeResultsWithReference(results, reference)

      expect(result).toEqual([
        { sol: 1041, similarity_score: 1.0, distance: 0, duration: 0, point_count: 0, isReference: true },
        { sol: 1042, similarity_score: 0.95, distance: 100, duration: 3600, point_count: 50 }
      ])
    })

    it('should return original results when no reference sols', () => {
      const results: SimilarityResult[] = [
        { sol: 1042, similarity_score: 0.95, distance: 100, duration: 3600, point_count: 50 }
      ]

      const result = mergeResultsWithReference(results, [])

      expect(result).toEqual(results)
    })

    it('should handle empty results', () => {
      const reference: SimilarityResult[] = [
        { sol: 1041, similarity_score: 1.0, distance: 0, duration: 0, point_count: 0, isReference: true }
      ]

      const result = mergeResultsWithReference([], reference)

      expect(result).toEqual(reference)
    })
  })

  describe('transformSolListToSimilarityResults', () => {
    it('should transform sol list to similarity results', () => {
      const sols: SolListItem[] = [
        { sol: 1041, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1042, distance: 200, duration: 7200, point_count: 75 }
      ]

      const result = transformSolListToSimilarityResults(sols)

      expect(result).toEqual([
        { sol: 1041, similarity_score: 1.0, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1042, similarity_score: 1.0, distance: 200, duration: 7200, point_count: 75 }
      ])
    })

    it('should handle empty sol list', () => {
      const result = transformSolListToSimilarityResults([])

      expect(result).toEqual([])
    })

    it('should handle sols with missing optional properties', () => {
      const sols: SolListItem[] = [
        { sol: 1041, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1042, distance: undefined as any, duration: undefined as any, point_count: undefined as any }
      ]

      const result = transformSolListToSimilarityResults(sols)

      expect(result).toEqual([
        { sol: 1041, similarity_score: 1.0, distance: 100, duration: 3600, point_count: 50 },
        { sol: 1042, similarity_score: 1.0, distance: undefined, duration: undefined, point_count: undefined }
      ])
    })
  })
})
