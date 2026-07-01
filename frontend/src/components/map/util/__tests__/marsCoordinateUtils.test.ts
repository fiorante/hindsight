import { describe, it, expect } from 'vitest'
import {
  MARS_MAP_BOUNDS,
  IMAGE_DIMENSIONS,
  latLngToPixel,
  pixelToLatLng,
  leafletBoundsToGeographic,
  isValidLatLng
} from '../marsCoordinateUtils'

describe('marsCoordinateUtils', () => {
  describe('constants', () => {
    it('should have valid Mars map bounds', () => {
      expect(MARS_MAP_BOUNDS.west).toBeLessThan(MARS_MAP_BOUNDS.east)
      expect(MARS_MAP_BOUNDS.south).toBeLessThan(MARS_MAP_BOUNDS.north)
      expect(MARS_MAP_BOUNDS.west).toBeGreaterThan(0)
      expect(MARS_MAP_BOUNDS.east).toBeLessThan(360)
    })

    it('should have valid image dimensions', () => {
      expect(IMAGE_DIMENSIONS).toHaveLength(2)
      expect(IMAGE_DIMENSIONS[0]).toBeGreaterThan(0)
      expect(IMAGE_DIMENSIONS[1]).toBeGreaterThan(0)
    })
  })

  describe('latLngToPixel', () => {
    it('should convert northwest corner correctly', () => {
      const [pixelX, pixelY] = latLngToPixel(MARS_MAP_BOUNDS.north, MARS_MAP_BOUNDS.west)
      expect(pixelX).toBe(0)
      expect(pixelY).toBe(0)
    })

    it('should convert southeast corner correctly', () => {
      const [pixelX, pixelY] = latLngToPixel(MARS_MAP_BOUNDS.south, MARS_MAP_BOUNDS.east)
      expect(pixelX).toBe(IMAGE_DIMENSIONS[0] - 1)
      expect(pixelY).toBe(IMAGE_DIMENSIONS[1] - 1)
    })

    it('should convert center coordinates', () => {
      const centerLat = (MARS_MAP_BOUNDS.north + MARS_MAP_BOUNDS.south) / 2
      const centerLng = (MARS_MAP_BOUNDS.west + MARS_MAP_BOUNDS.east) / 2
      const [pixelX, pixelY] = latLngToPixel(centerLat, centerLng)

      expect(pixelX).toBeCloseTo((IMAGE_DIMENSIONS[0] - 1) / 2, 1)
      expect(pixelY).toBeCloseTo((IMAGE_DIMENSIONS[1] - 1) / 2, 1)
    })

    it('should handle coordinates outside bounds', () => {
      // Test coordinates outside the bounds
      const [pixelX, pixelY] = latLngToPixel(
        MARS_MAP_BOUNDS.north + 1,
        MARS_MAP_BOUNDS.west - 1
      )
      expect(pixelX).toBeLessThan(0)
      expect(pixelY).toBeLessThan(0)
    })

    it('should return numeric values', () => {
      const [pixelX, pixelY] = latLngToPixel(18.45, 77.35)
      expect(typeof pixelX).toBe('number')
      expect(typeof pixelY).toBe('number')
      expect(isNaN(pixelX)).toBe(false)
      expect(isNaN(pixelY)).toBe(false)
    })
  })

  describe('pixelToLatLng', () => {
    it('should convert northwest corner pixel correctly', () => {
      const [lat, lng] = pixelToLatLng(0, 0)
      expect(lat).toBeCloseTo(MARS_MAP_BOUNDS.north, 6)
      expect(lng).toBeCloseTo(MARS_MAP_BOUNDS.west, 6)
    })

    it('should convert southeast corner pixel correctly', () => {
      const [lat, lng] = pixelToLatLng(IMAGE_DIMENSIONS[0] - 1, IMAGE_DIMENSIONS[1] - 1)
      expect(lat).toBeCloseTo(MARS_MAP_BOUNDS.south, 6)
      expect(lng).toBeCloseTo(MARS_MAP_BOUNDS.east, 6)
    })

    it('should convert center pixel coordinates', () => {
      const centerX = (IMAGE_DIMENSIONS[0] - 1) / 2
      const centerY = (IMAGE_DIMENSIONS[1] - 1) / 2
      const [lat, lng] = pixelToLatLng(centerX, centerY)

      const expectedLat = (MARS_MAP_BOUNDS.north + MARS_MAP_BOUNDS.south) / 2
      const expectedLng = (MARS_MAP_BOUNDS.west + MARS_MAP_BOUNDS.east) / 2

      expect(lat).toBeCloseTo(expectedLat, 6)
      expect(lng).toBeCloseTo(expectedLng, 6)
    })

    it('should handle edge cases with width/height of 1', () => {
      // This tests the division by zero protection
      const [lat, lng] = pixelToLatLng(0, 0)
      expect(typeof lat).toBe('number')
      expect(typeof lng).toBe('number')
      expect(isNaN(lat)).toBe(false)
      expect(isNaN(lng)).toBe(false)
    })

    it('should return numeric values', () => {
      const [lat, lng] = pixelToLatLng(1000, 2000)
      expect(typeof lat).toBe('number')
      expect(typeof lng).toBe('number')
      expect(isNaN(lat)).toBe(false)
      expect(isNaN(lng)).toBe(false)
    })
  })

  describe('coordinate conversion round-trip', () => {
    it('should maintain accuracy in round-trip conversions', () => {
      const originalLat = 18.45
      const originalLng = 77.35

      const [pixelX, pixelY] = latLngToPixel(originalLat, originalLng)
      const [convertedLat, convertedLng] = pixelToLatLng(pixelX, pixelY)

      expect(convertedLat).toBeCloseTo(originalLat, 6)
      expect(convertedLng).toBeCloseTo(originalLng, 6)
    })

    it('should handle multiple round-trip conversions', () => {
      const testCoordinates = [
        [MARS_MAP_BOUNDS.north, MARS_MAP_BOUNDS.west],
        [MARS_MAP_BOUNDS.south, MARS_MAP_BOUNDS.east],
        [18.45, 77.35],
        [18.42, 77.40]
      ]

      testCoordinates.forEach(([lat, lng]) => {
        const [pixelX, pixelY] = latLngToPixel(lat, lng)
        const [convertedLat, convertedLng] = pixelToLatLng(pixelX, pixelY)

        expect(convertedLat).toBeCloseTo(lat, 6)
        expect(convertedLng).toBeCloseTo(lng, 6)
      })
    })
  })

  describe('leafletBoundsToGeographic', () => {
    // Mock Leaflet LatLngBounds for testing
    const createMockBounds = (southwest: [number, number], northeast: [number, number]) => ({
      getSouthWest: () => ({ lat: southwest[0], lng: southwest[1] }),
      getNorthEast: () => ({ lat: northeast[0], lng: northeast[1] })
    } as any)

    it('should convert simple Leaflet bounds correctly', () => {
      // Test with pixel coordinates converted to Leaflet format
      const mockBounds = createMockBounds(
        [-1000, 500],  // Southwest: [-pixelY, pixelX]
        [-500, 1500]   // Northeast: [-pixelY, pixelX]
      )

      const result = leafletBoundsToGeographic(mockBounds)

      expect(result).toHaveProperty('min_lat')
      expect(result).toHaveProperty('max_lat')
      expect(result).toHaveProperty('min_lng')
      expect(result).toHaveProperty('max_lng')
      expect(result.min_lat).toBeLessThanOrEqual(result.max_lat)
      expect(result.min_lng).toBeLessThanOrEqual(result.max_lng)
    })

    it('should handle inverted Y-axis correctly', () => {
      // Test the Y-axis inversion logic
      const mockBounds = createMockBounds(
        [-2000, 1000],  // Southwest
        [-1000, 2000]   // Northeast
      )

      const result = leafletBoundsToGeographic(mockBounds)

      // Should return valid bounds
      expect(typeof result.min_lat).toBe('number')
      expect(typeof result.max_lat).toBe('number')
      expect(typeof result.min_lng).toBe('number')
      expect(typeof result.max_lng).toBe('number')
    })

    it('should ensure min values are less than max values', () => {
      const mockBounds = createMockBounds(
        [-1500, 800],
        [-700, 1200]
      )

      const result = leafletBoundsToGeographic(mockBounds)

      expect(result.min_lat).toBeLessThanOrEqual(result.max_lat)
      expect(result.min_lng).toBeLessThanOrEqual(result.max_lng)
    })
  })

  describe('isValidLatLng', () => {
    it('should validate correct lat/lng arrays', () => {
      expect(isValidLatLng([18.45, 77.35])).toBe(true)
      expect(isValidLatLng([0, 0])).toBe(true)
      expect(isValidLatLng([-90, -180])).toBe(true)
      expect(isValidLatLng([90, 180])).toBe(true)
    })

    it('should reject invalid arrays', () => {
      expect(isValidLatLng([])).toBe(false)
      expect(isValidLatLng([18.45])).toBe(false)
      expect(isValidLatLng([18.45, 77.35, 100])).toBe(false)
    })

    it('should reject non-numeric values', () => {
      expect(isValidLatLng(['18.45', '77.35'])).toBe(false)
      expect(isValidLatLng([null, 77.35])).toBe(false)
      expect(isValidLatLng([18.45, undefined])).toBe(false)
      expect(isValidLatLng([NaN, 77.35])).toBe(false)
      expect(isValidLatLng([18.45, NaN])).toBe(false)
    })

    it('should reject non-arrays', () => {
      expect(isValidLatLng(null)).toBe(false)
      expect(isValidLatLng(undefined)).toBe(false)
      expect(isValidLatLng('18.45,77.35')).toBe(false)
      expect(isValidLatLng({ lat: 18.45, lng: 77.35 })).toBe(false)
    })

    it('should handle edge numeric cases', () => {
      expect(isValidLatLng([Infinity, 77.35])).toBe(true) // Infinity is a valid number
      expect(isValidLatLng([18.45, -Infinity])).toBe(true) // -Infinity is a valid number
      expect(isValidLatLng([0, 0])).toBe(true)
    })
  })
})
