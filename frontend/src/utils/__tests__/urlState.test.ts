import { describe, it, expect, beforeEach } from 'vitest'
import {
  serializeStateToUrl,
  deserializeStateFromUrl,
  validateUrlParams,
  generateShareableUrl,
  cleanUrl,
  URL_PARAMS,
  type DeepLinkState
} from '../urlState'
import type { AppState } from '../../state/store'

describe('urlState utilities', () => {
  // Mock AppState for testing
  const createMockAppState = (overrides: Partial<AppState> = {}): AppState => ({
    // Default minimal state
    viewMode: 'map',
    focusedSol: null,
    searchMode: 'similarity',
    similarityMode: 'sol',
    solNumber: '1041',
    filters: [],
    parameterFilters: [],
    selectedDrives: [],
    position: null,
    timelineExpanded: true,
    timelineSpeed: 60,
    drivePositions: {},
    activeCharts: [],
    isSearchPanelOpen: true,
    vceImageSideMode: 'both',
    pdiImageSideMode: 'both',
    faultOverlayEnabled: false,
    syncDrivePanels: true,
    searchResults: [],
    // Add minimal required properties
    hoveredDrive: null,
    maxSelectedDrives: 3,
    segmentStartMarker: null,
    segmentEndMarker: null,
    segmentSelectionMode: 'none',
    drivePlayStates: {},
    driveLayoutStructure: null,
    driveLayoutResetNonce: 0,
    pinnedParameters: [],
    highlightedEvrIndex: {},
    hoveredElement: null,
    // Override with any provided values
    ...overrides,
    // Mock required functions
    setViewMode: () => { },
    toggleSearchPanel: () => { },
    setFocusedSol: () => { },
    setSelectedDrives: () => { },
    toggleDriveSelection: () => { },
    clearSelectedDrives: () => { },
    setHoveredDrive: () => { },
    setMaxSelectedDrives: () => { },
    isSelected: () => false,
    isHovered: () => false,
    canSelectMore: () => true,
    isInSearchResults: () => false,
    isReferenceDrive: () => false,
    searchResultDriveIds: () => [],
    setSegmentStartMarker: () => { },
    setSegmentEndMarker: () => { },
    setSegmentSelectionMode: () => { },
    clearSegmentSelection: () => { },
    setTimelineExpanded: () => { },
    setTimelineSpeed: () => { },
    setDrivePlayState: () => { },
    setSyncDrivePanels: () => { },
    setDriveLayoutStructure: () => { },
    resetAllDriveLayouts: () => { },
    setActiveCharts: () => { },
    addChart: () => { },
    removeChart: () => { },
    clearCharts: () => { },
    setVceImageSideMode: () => { },
    setPdiImageSideMode: () => { },
    setFaultOverlayEnabled: () => { },
    addPinnedParameter: () => { },
    removePinnedParameter: () => { },
    setHighlightedEvrIndex: () => { },
    setPosition: () => { },
    setHoveredElement: () => { },
    setDrivePosition: () => { },
    setSearchMode: () => { },
    setSimilarityMode: () => { },
    setSolNumber: () => { },
    setFilters: () => { },
    addFilter: () => { },
    removeFilter: () => { },
    clearFilters: () => { },
    setParameterFilters: () => { },
    addParameterFilter: () => { },
    updateParameterFilter: () => { },
    removeParameterFilter: () => { },
    clearParameterFilters: () => { },
    setSearchResults: () => { },
    clearSearch: () => { },
    getActiveFilterTypes: () => [],
    getSearchProgress: () => ({ isLoading: false, error: null }),
    syncFromUrl: () => { },
    updateUrl: () => { },
    setFromDeepLink: () => { },
  } as AppState)

  describe('serializeStateToUrl', () => {
    it('should serialize basic view mode', () => {
      const state = createMockAppState({ viewMode: 'drives' })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.VIEW)).toBe('drives')
    })

    it('should serialize focused sol', () => {
      const state = createMockAppState({ focusedSol: '1234' })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.SOL)).toBe('1234')
    })

    it('should serialize search state', () => {
      const state = createMockAppState({
        searchMode: 'parameter',
        similarityMode: 'plan',
        solNumber: '1500'
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.SEARCH_MODE)).toBe('parameter')
      expect(params.get(URL_PARAMS.SIMILARITY_MODE)).toBe('plan')
      expect(params.get(URL_PARAMS.REFERENCE_SOL)).toBe('1500')
    })

    it('should not serialize default values', () => {
      const state = createMockAppState({
        searchMode: 'similarity',
        similarityMode: 'sol',
        solNumber: '1041'
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.SEARCH_MODE)).toBeNull()
      expect(params.get(URL_PARAMS.SIMILARITY_MODE)).toBeNull()
      expect(params.get(URL_PARAMS.REFERENCE_SOL)).toBeNull()
    })

    it('should serialize active filters', () => {
      const state = createMockAppState({
        filters: [
          { type: 'elevation', active: true },
          { type: 'slope', active: true },
          { type: 'distance', active: false }
        ]
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.FILTERS)).toBe('elevation,slope')
    })

    it('should serialize parameter filters', () => {
      const state = createMockAppState({
        parameterFilters: [
          { parameter: 'elevation', min: '100', max: '200' },
          { parameter: 'slope', value: '15' }
        ]
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.PARAM_FILTERS)).toBe('elevation:100-200,slope:15')
    })

    it('should serialize selected drives', () => {
      const state = createMockAppState({
        selectedDrives: ['1041', '1042', '1043']
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.DRIVES)).toBe('1041,1042,1043')
    })

    it('should serialize timeline state', () => {
      const state = createMockAppState({
        position: 0.5,
        timelineExpanded: false,
        timelineSpeed: 120
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.POSITION)).toBe('0.5')
      expect(params.get(URL_PARAMS.TIMELINE_EXPANDED)).toBe('false')
      expect(params.get(URL_PARAMS.TIMELINE_SPEED)).toBe('120')
    })

    it('should serialize search results', () => {
      const state = createMockAppState({
        searchResults: [
          { sol: 1041, similarity_score: 0.95 },
          { sol: 1042, similarity_score: 0.87 },
          { sol: 1043, similarity_score: 0.75 }
        ]
      })
      const params = serializeStateToUrl(state)

      expect(params.get(URL_PARAMS.SEARCH_RESULTS)).toBe('1041:0.95,1042:0.87,1043:0.75')
    })
  })

  describe('deserializeStateFromUrl', () => {
    it('should deserialize view mode', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.VIEW, 'drives')

      const state = deserializeStateFromUrl(params)
      expect(state.viewMode).toBe('drives')
    })

    it('should ignore invalid view mode', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.VIEW, 'invalid')

      const state = deserializeStateFromUrl(params)
      expect(state.viewMode).toBeUndefined()
    })

    it('should deserialize focused sol', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.SOL, '1234')

      const state = deserializeStateFromUrl(params)
      expect(state.focusedSol).toBe('1234')
    })

    it('should deserialize search state', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.SEARCH_MODE, 'parameter')
      params.set(URL_PARAMS.SIMILARITY_MODE, 'plan')
      params.set(URL_PARAMS.REFERENCE_SOL, '1500')

      const state = deserializeStateFromUrl(params)
      expect(state.searchMode).toBe('parameter')
      expect(state.similarityMode).toBe('plan')
      expect(state.solNumber).toBe('1500')
    })

    it('should deserialize filters', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.FILTERS, 'elevation,slope,distance')

      const state = deserializeStateFromUrl(params)
      expect(state.filters).toEqual([
        { type: 'elevation', active: true },
        { type: 'slope', active: true },
        { type: 'distance', active: true }
      ])
    })

    it('should deserialize parameter filters', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.PARAM_FILTERS, 'elevation:100-200,slope:15')

      const state = deserializeStateFromUrl(params)
      expect(state.parameterFilters).toEqual([
        { parameter: 'elevation', min: '100', max: '200' },
        { parameter: 'slope', value: '15' }
      ])
    })

    it('should deserialize map viewport', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.LAT, '45.5')
      params.set(URL_PARAMS.LNG, '-123.5')
      params.set(URL_PARAMS.ZOOM, '12')

      const state = deserializeStateFromUrl(params)
      expect(state.mapViewport).toEqual({
        lat: 45.5,
        lng: -123.5,
        zoom: 12
      })
    })

    it('should deserialize drive positions', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.DRIVE_POSITIONS, '1041:0.5,1042:0.7')

      const state = deserializeStateFromUrl(params)
      expect(state.drivePositions).toEqual({
        '1041': 0.5,
        '1042': 0.7
      })
    })
  })

  describe('validateUrlParams', () => {
    it('should validate valid parameters', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.VIEW, 'map')
      params.set(URL_PARAMS.SOL, '1041')
      params.set(URL_PARAMS.LAT, '45.5')
      params.set(URL_PARAMS.LNG, '-123.5')
      params.set(URL_PARAMS.ZOOM, '12')

      const result = validateUrlParams(params)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid view mode', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.VIEW, 'invalid')

      const result = validateUrlParams(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid view mode: invalid')
    })

    it('should detect invalid sol numbers', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.SOL, 'not-a-number')
      params.set(URL_PARAMS.REFERENCE_SOL, '-5')

      const result = validateUrlParams(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid sol number: not-a-number')
      expect(result.errors).toContain('Invalid reference sol: -5')
    })

    it('should detect invalid coordinates', () => {
      const params = new URLSearchParams()
      params.set(URL_PARAMS.LAT, '95') // Invalid latitude > 90
      params.set(URL_PARAMS.LNG, '185') // Invalid longitude > 180
      params.set(URL_PARAMS.ZOOM, '25') // Invalid zoom > 20

      const result = validateUrlParams(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid latitude: 95')
      expect(result.errors).toContain('Invalid longitude: 185')
      expect(result.errors).toContain('Invalid zoom level: 25')
    })
  })

  describe('generateShareableUrl', () => {
    beforeEach(() => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5173' },
        writable: true
      })
    })

    it('should generate URL for map view with sol', () => {
      const state = createMockAppState({
        viewMode: 'map',
        focusedSol: '1041'
      })

      const url = generateShareableUrl(state)
      expect(url).toBe('http://localhost:5173/hindsight/map?view=map&sol=1041')
    })

    it('should generate URL for drives view with selected drives', () => {
      const state = createMockAppState({
        viewMode: 'drives',
        selectedDrives: ['1041', '1042'],
        activeCharts: ['elevation', 'slope']
      })

      const url = generateShareableUrl(state)
      expect(url).toContain('/hindsight/drives')
      expect(url).toContain('drives=1041%2C1042') // URL encoded comma
      expect(url).toContain('charts=elevation%2Cslope') // URL encoded comma
    })

    it('should use custom base URL', () => {
      const state = createMockAppState({ viewMode: 'map' })

      const url = generateShareableUrl(state, 'https://example.com')
      expect(url).toMatch(/^https:\/\/example\.com\/hindsight\/map/)
    })
  })

  describe('cleanUrl', () => {
    it('should remove session-specific parameters', () => {
      const url = 'http://localhost:5173/hindsight/map?view=map&searchPanel=false&timeline=false&sol=1041'

      const cleanedUrl = cleanUrl(url)
      expect(cleanedUrl).toBe('http://localhost:5173/hindsight/map?view=map&sol=1041')
    })

    it('should preserve non-session parameters', () => {
      const url = 'http://localhost:5173/hindsight/drives?drives=1041,1042&charts=elevation'

      const cleanedUrl = cleanUrl(url)
      expect(cleanedUrl).toContain('drives=1041%2C1042') // Should be URL encoded
      expect(cleanedUrl).toContain('charts=elevation')
    })
  })
})
