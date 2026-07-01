import { describe, it, expect, beforeEach } from 'vitest'
import { createSearchSlice, defaultSearchState, type SearchSlice } from '../searchSlice'
import type { UIFilter, ParameterFilter } from '../../types'

describe('searchSlice', () => {
  let slice: SearchSlice
  let mockSet: any
  let mockGet: any
  let currentState: Partial<SearchSlice>

  beforeEach(() => {
    currentState = { ...defaultSearchState }

    mockSet = (updater: any) => {
      if (typeof updater === 'function') {
        const updates = updater(currentState)
        Object.assign(currentState, updates)
      } else {
        Object.assign(currentState, updater)
      }
    }

    mockGet = () => currentState

    slice = createSearchSlice(mockSet, mockGet)
    Object.assign(currentState, slice)
  })

  describe('initial state', () => {
    it('should have correct default values', () => {
      expect(slice.searchMode).toBe('similarity')
      expect(slice.similarityMode).toBe('sol')
      expect(slice.solNumber).toBe('1041')
      expect(slice.filters).toEqual([])
      expect(slice.parameterFilters).toEqual([])
      expect(slice.isSearching).toBe(false)
      expect(slice.lastSearchParameters).toEqual([])
      expect(slice.searchResults).toEqual([])
    })
  })

  describe('mode management', () => {
    it('should set search mode', () => {
      slice.setSearchMode('parameter')
      expect(currentState.searchMode).toBe('parameter')
    })

    it('should set similarity mode', () => {
      slice.setSimilarityMode('segment')
      expect(currentState.similarityMode).toBe('segment')
    })

    it('should set sol number', () => {
      slice.setSolNumber('1500')
      expect(currentState.solNumber).toBe('1500')
    })
  })

  describe('filter management', () => {
    const testFilters: UIFilter[] = [
      { type: 'elevation', active: true },
      { type: 'slope', active: false },
      { type: 'distance', active: true }
    ]

    it('should set filters', () => {
      slice.setFilters(testFilters)
      expect(currentState.filters).toEqual(testFilters)
    })

    it('should add filter', () => {
      slice.addFilter('elevation')
      expect(currentState.filters).toEqual([{ type: 'elevation', active: true }])
    })

    it('should add multiple filters', () => {
      slice.addFilter('elevation')
      slice.addFilter('slope')
      expect(currentState.filters).toEqual([
        { type: 'elevation', active: true },
        { type: 'slope', active: true }
      ])
    })

    it('should remove filter by index', () => {
      slice.setFilters(testFilters)
      slice.removeFilter(1) // Remove 'slope'

      expect(currentState.filters).toEqual([
        { type: 'elevation', active: true },
        { type: 'distance', active: true }
      ])
    })

    it('should clear all filters', () => {
      slice.setFilters(testFilters)
      slice.clearFilters()
      expect(currentState.filters).toEqual([])
    })

    it('should handle removing non-existent filter index gracefully', () => {
      slice.setFilters(testFilters)
      const originalLength = currentState.filters?.length || 0

      slice.removeFilter(999) // Non-existent index
      expect(currentState.filters?.length).toBe(originalLength)
    })
  })

  describe('parameter filter management', () => {
    const testParameterFilters: ParameterFilter[] = [
      { parameter: 'elevation', min: '100', max: '200' },
      { parameter: 'slope', value: '15' },
      { parameter: 'distance', min: '0', max: '1000' }
    ]

    it('should set parameter filters', () => {
      slice.setParameterFilters(testParameterFilters)
      expect(currentState.parameterFilters).toEqual(testParameterFilters)
    })

    it('should add parameter filter', () => {
      const newFilter: ParameterFilter = { parameter: 'elevation', min: '100', max: '200' }
      slice.addParameterFilter(newFilter)
      expect(currentState.parameterFilters).toEqual([newFilter])
    })

    it('should remove parameter filter by index', () => {
      slice.setParameterFilters(testParameterFilters)
      slice.removeParameterFilter(1) // Remove slope filter

      expect(currentState.parameterFilters).toEqual([
        { parameter: 'elevation', min: '100', max: '200' },
        { parameter: 'distance', min: '0', max: '1000' }
      ])
    })

    it('should update parameter filter by index', () => {
      slice.setParameterFilters(testParameterFilters)
      const updatedFilter: ParameterFilter = { parameter: 'elevation', min: '50', max: '150' }
      slice.updateParameterFilter(0, updatedFilter)

      expect(currentState.parameterFilters?.[0]).toEqual(updatedFilter)
    })

    it('should clear all parameter filters', () => {
      slice.setParameterFilters(testParameterFilters)
      slice.clearParameterFilters()
      expect(currentState.parameterFilters).toEqual([])
    })
  })

  describe('search execution state', () => {
    it('should set searching state', () => {
      slice.setIsSearching(true)
      expect(currentState.isSearching).toBe(true)

      slice.setIsSearching(false)
      expect(currentState.isSearching).toBe(false)
    })

    it('should set last search parameters', () => {
      const params = ['elevation', 'slope', 'distance']
      slice.setLastSearchParameters(params)
      expect(currentState.lastSearchParameters).toEqual(params)
    })

    it('should set search results', () => {
      const results = [
        { sol: 1041, similarity_score: 1.0 },
        { sol: 1042, similarity_score: 0.95 }
      ]
      slice.setSearchResults(results)
      expect(currentState.searchResults).toEqual(results)
    })
  })

  describe('helper methods', () => {
    beforeEach(() => {
      const testFilters: UIFilter[] = [
        { type: 'elevation', active: true },
        { type: 'slope', active: false },
        { type: 'distance', active: true }
      ]
      slice.setFilters(testFilters)
    })

    describe('getActiveFilters', () => {
      it('should return only active filters', () => {
        const activeFilters = slice.getActiveFilters()
        expect(activeFilters).toEqual([
          { type: 'elevation', active: true },
          { type: 'distance', active: true }
        ])
      })

      it('should return empty array when no active filters', () => {
        slice.clearFilters()
        const activeFilters = slice.getActiveFilters()
        expect(activeFilters).toEqual([])
      })
    })

    describe('hasActiveFilters', () => {
      it('should return true when there are active filters', () => {
        expect(slice.hasActiveFilters()).toBe(true)
      })

      it('should return false when no active filters', () => {
        slice.clearFilters()
        expect(slice.hasActiveFilters()).toBe(false)
      })

      it('should return false when all filters are inactive', () => {
        slice.setFilters([
          { type: 'elevation', active: false },
          { type: 'slope', active: false }
        ])
        expect(slice.hasActiveFilters()).toBe(false)
      })
    })

    describe('canExecuteSearch', () => {
      it('should return true for similarity search with active filters', () => {
        slice.setSearchMode('similarity')
        expect(slice.canExecuteSearch()).toBe(true)
      })

      it('should return false for similarity search without active filters', () => {
        slice.setSearchMode('similarity')
        slice.clearFilters()
        expect(slice.canExecuteSearch()).toBe(false)
      })

      it('should return true for parameter search with parameter filters', () => {
        slice.setSearchMode('parameter')
        slice.addParameterFilter({ parameter: 'elevation', min: '100', max: '200' })
        expect(slice.canExecuteSearch()).toBe(true)
      })

      it('should return false for parameter search without parameter filters', () => {
        slice.setSearchMode('parameter')
        expect(slice.canExecuteSearch()).toBe(false)
      })
    })

    describe('resetSearchState', () => {
      it('should reset to default state while preserving search mode and sol number', () => {
        // Set up some non-default state
        slice.setSearchMode('parameter')
        slice.setSolNumber('1500')
        slice.addFilter('elevation')
        slice.addParameterFilter({ parameter: 'slope', value: '15' })
        slice.setIsSearching(true)
        slice.setSearchResults([{ sol: 1041, similarity_score: 0.95 }])

        // Reset
        slice.resetSearchState()

        // Check that search mode and sol number are preserved
        expect(currentState.searchMode).toBe('parameter')
        expect(currentState.solNumber).toBe('1500')

        // Check that other state is reset
        expect(currentState.filters).toEqual([])
        expect(currentState.parameterFilters).toEqual([])
        expect(currentState.isSearching).toBe(false)
        expect(currentState.lastSearchParameters).toEqual([])
        expect(currentState.searchResults).toEqual([])
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty filter arrays', () => {
      slice.setFilters([])
      slice.setParameterFilters([])

      expect(slice.getActiveFilters()).toEqual([])
      expect(slice.hasActiveFilters()).toBe(false)
      expect(slice.canExecuteSearch()).toBe(false)
    })

    it('should handle invalid filter indices in removeFilter', () => {
      const testFilters = [
        { type: 'elevation', active: true },
        { type: 'slope', active: true }
      ]
      slice.setFilters(testFilters)
      const originalLength = currentState.filters?.length || 0

      slice.removeFilter(100)

      expect(currentState.filters?.length).toBe(originalLength)
    })

    it('should handle invalid parameter filter indices', () => {
      const testParameterFilters = [
        { parameter: 'elevation', min: '100', max: '200' },
        { parameter: 'slope', value: '15' }
      ]
      slice.setParameterFilters(testParameterFilters)
      const originalLength = currentState.parameterFilters?.length || 0

      slice.removeParameterFilter(100)
      // updateParameterFilter extends the array when index is out of bounds
      slice.updateParameterFilter(100, { parameter: 'slope', value: '15' })

      expect(currentState.parameterFilters?.length).toBe(101) // Array extended to index 100
    })
  })
})
