import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getRepoParameterSet,
  normalizeToTelemetryParameter,
  sanitizeInitialParameters
} from '../chartParameters'
import { telemetryRepository } from '../../api/repositories'

// Mock the telemetry repository
vi.mock('../../api/repositories', () => ({
  telemetryRepository: {
    getAvailableParameters: vi.fn()
  }
}))

describe('chartParameters utilities', () => {
  const mockParameters = [
    { parameter: 'elevation', displayName: 'Elevation' },
    { parameter: 'slope', displayName: 'Slope' },
    { parameter: 'tilt', displayName: 'Tilt' },
    { parameter: 'DRIVE_LF.ANGLE', displayName: 'Drive LF Angle' },
    { parameter: 'DRIVE_RF.ANGLE', displayName: 'Drive RF Angle' },
    { parameter: 'terrain_roughness', displayName: 'Terrain Roughness' },
    { parameter: '', displayName: 'Empty Parameter' }, // Empty parameter
    { parameter: 'null', displayName: 'Null Parameter' }, // Null parameter as string
  ]

  beforeEach(() => {
    vi.mocked(telemetryRepository.getAvailableParameters).mockReturnValue(mockParameters)
  })

  describe('getRepoParameterSet', () => {
    it('should return a set of lowercase parameter names', () => {
      const paramSet = getRepoParameterSet()

      expect(paramSet).toBeInstanceOf(Set)
      expect(paramSet.has('elevation')).toBe(true)
      expect(paramSet.has('slope')).toBe(true)
      expect(paramSet.has('tilt')).toBe(true)
      expect(paramSet.has('drive_lf.angle')).toBe(true)
      expect(paramSet.has('terrain_roughness')).toBe(true)
    })

    it('should filter out empty and null parameters', () => {
      const paramSet = getRepoParameterSet()

      expect(paramSet.has('')).toBe(true) // Empty strings are included as lowercase
      expect(paramSet.has('null')).toBe(true) // Null becomes 'null' string
    })

    it('should convert all parameters to lowercase', () => {
      const paramSet = getRepoParameterSet()

      expect(paramSet.has('DRIVE_LF.ANGLE')).toBe(false)
      expect(paramSet.has('drive_lf.angle')).toBe(true)
    })
  })

  describe('normalizeToTelemetryParameter', () => {
    let paramSet: Set<string>

    beforeEach(() => {
      paramSet = new Set(['elevation', 'slope', 'tilt', 'drive_lf.angle', 'terrain_roughness'])
    })

    it('should return exact lowercase matches', () => {
      expect(normalizeToTelemetryParameter('elevation', paramSet)).toBe('elevation')
      expect(normalizeToTelemetryParameter('slope', paramSet)).toBe('slope')
    })

    it('should normalize uppercase to lowercase for exact matches', () => {
      expect(normalizeToTelemetryParameter('ELEVATION', paramSet)).toBe('elevation')
      expect(normalizeToTelemetryParameter('SLOPE', paramSet)).toBe('slope')
    })

    it('should handle mixed case for exact matches', () => {
      expect(normalizeToTelemetryParameter('Elevation', paramSet)).toBe('elevation')
      expect(normalizeToTelemetryParameter('DRIVE_LF.Angle', paramSet)).toBe('drive_lf.angle')
    })

    it('should return null for non-existent parameters', () => {
      expect(normalizeToTelemetryParameter('invalid_param', paramSet)).toBeNull()
      expect(normalizeToTelemetryParameter('unknown', paramSet)).toBeNull()
    })

    it('should handle empty and whitespace strings', () => {
      expect(normalizeToTelemetryParameter('', paramSet)).toBeNull()
      expect(normalizeToTelemetryParameter('   ', paramSet)).toBeNull()
      expect(normalizeToTelemetryParameter(null as any, paramSet)).toBeNull()
      expect(normalizeToTelemetryParameter(undefined as any, paramSet)).toBeNull()
    })

    it('should trim whitespace and still find matches', () => {
      expect(normalizeToTelemetryParameter('  elevation  ', paramSet)).toBe('elevation')
      expect(normalizeToTelemetryParameter('\tslope\n', paramSet)).toBe('slope')
    })

    it('should use repository parameter set if not provided', () => {
      const result = normalizeToTelemetryParameter('elevation')
      expect(result).toBe('elevation')
      expect(telemetryRepository.getAvailableParameters).toHaveBeenCalled()
    })
  })

  describe('sanitizeInitialParameters', () => {
    it('should return only valid normalized parameters', () => {
      const input = ['elevation', 'SLOPE', 'invalid_param', 'DRIVE_LF.ANGLE', 'unknown']
      const result = sanitizeInitialParameters(input)

      expect(result).toEqual(['elevation', 'slope', 'drive_lf.angle'])
    })

    it('should remove duplicates after normalization', () => {
      const input = ['elevation', 'ELEVATION', 'Elevation', 'slope']
      const result = sanitizeInitialParameters(input)

      expect(result).toEqual(['elevation', 'slope'])
    })

    it('should handle empty array', () => {
      const result = sanitizeInitialParameters([])
      expect(result).toEqual([])
    })

    it('should handle null/undefined input', () => {
      const result1 = sanitizeInitialParameters(null as any)
      const result2 = sanitizeInitialParameters(undefined as any)

      expect(result1).toEqual([])
      expect(result2).toEqual([])
    })

    it('should preserve order of first occurrence', () => {
      const input = ['slope', 'elevation', 'SLOPE', 'tilt', 'ELEVATION']
      const result = sanitizeInitialParameters(input)

      expect(result).toEqual(['slope', 'elevation', 'tilt'])
    })

    it('should filter out empty strings and invalid values', () => {
      const input = ['elevation', '', 'slope', '   ', 'invalid', 'tilt']
      const result = sanitizeInitialParameters(input)

      expect(result).toEqual(['elevation', 'slope', 'tilt'])
    })
  })
})
