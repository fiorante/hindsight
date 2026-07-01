import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'
import { useAppStore } from '../../state/store'

// Mock API repositories
vi.mock('../../api/repositories/searchRepository', () => ({
  searchRepository: {
    findSimilarSols: vi.fn(),
    findSolsByParameters: vi.fn(),
  }
}))

vi.mock('../../api/repositories/telemetryRepository', () => ({
  telemetryRepository: {
    getAvailableParameters: vi.fn(() => [
      { parameter: 'elevation' },
      { parameter: 'slope' },
      { parameter: 'distance' }
    ])
  }
}))

// Simple test component that combines search functionality
const SearchTestApp: React.FC = () => {
  const {
    searchMode,
    setSearchMode,
    solNumber,
    setSolNumber,
    filters,
    addFilter,
    clearFilters,
    parameterFilters,
    addParameterFilter,
    clearParameterFilters,
    searchResults,
    setSearchResults
  } = useAppStore()

  const handleSimilaritySearch = () => {
    // Mock similarity search
    const mockResults = [
      { sol: 1042, similarity_score: 0.95 },
      { sol: 1043, similarity_score: 0.87 }
    ]
    setSearchResults(mockResults)
  }

  const handleParameterSearch = () => {
    // Mock parameter search
    const mockResults = [
      { sol: 1044, similarity_score: 1.0 },
      { sol: 1045, similarity_score: 1.0 }
    ]
    setSearchResults(mockResults)
  }

  return (
    <div>
      <div data-testid="search-mode-controls">
        <button
          onClick={() => setSearchMode('similarity')}
          data-testid="similarity-mode-btn"
          className={searchMode === 'similarity' ? 'active' : ''}
        >
          Similarity Search
        </button>
        <button
          onClick={() => setSearchMode('parameter')}
          data-testid="parameter-mode-btn"
          className={searchMode === 'parameter' ? 'active' : ''}
        >
          Parameter Search
        </button>
      </div>

      {searchMode === 'similarity' && (
        <div data-testid="similarity-search-panel">
          <div>
            <label htmlFor="sol-input">Reference Sol:</label>
            <input
              id="sol-input"
              type="text"
              value={solNumber}
              onChange={(e) => setSolNumber(e.target.value)}
              data-testid="sol-input"
            />
          </div>

          <div data-testid="filter-controls">
            <button
              onClick={() => addFilter('elevation')}
              data-testid="add-elevation-filter"
            >
              Add Elevation
            </button>
            <button
              onClick={() => addFilter('slope')}
              data-testid="add-slope-filter"
            >
              Add Slope
            </button>
            <button
              onClick={clearFilters}
              data-testid="clear-filters"
            >
              Clear Filters
            </button>
          </div>

          <div data-testid="active-filters">
            Active Filters: {filters.filter(f => f.active).map(f => f.type).join(', ')}
          </div>

          <button
            onClick={handleSimilaritySearch}
            data-testid="execute-similarity-search"
            disabled={filters.filter(f => f.active).length === 0}
          >
            Find Similar Drives
          </button>
        </div>
      )}

      {searchMode === 'parameter' && (
        <div data-testid="parameter-search-panel">
          <div data-testid="parameter-filter-controls">
            <button
              onClick={() => addParameterFilter({
                parameter: 'elevation',
                min: '100',
                max: '200'
              })}
              data-testid="add-elevation-param-filter"
            >
              Add Elevation Range
            </button>
            <button
              onClick={() => addParameterFilter({
                parameter: 'slope',
                value: '15'
              })}
              data-testid="add-slope-param-filter"
            >
              Add Slope Value
            </button>
            <button
              onClick={clearParameterFilters}
              data-testid="clear-param-filters"
            >
              Clear Parameter Filters
            </button>
          </div>

          <div data-testid="parameter-filters-count">
            Parameter Filters: {parameterFilters.length}
          </div>

          <button
            onClick={handleParameterSearch}
            data-testid="execute-parameter-search"
            disabled={parameterFilters.length === 0}
          >
            Search by Parameters
          </button>
        </div>
      )}

      <div data-testid="search-results">
        <h3>Search Results ({searchResults.length})</h3>
        {searchResults.map((result, index) => (
          <div key={index} data-testid={`result-${result.sol}`}>
            Sol {result.sol} - Score: {result.similarity_score}
          </div>
        ))}
      </div>
    </div>
  )
}

describe('Search Workflow Integration', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    user = userEvent.setup()

    // Reset store state
    useAppStore.getState().clearFilters()
    useAppStore.getState().clearParameterFilters()
    useAppStore.getState().setSearchResults([])
    useAppStore.getState().setSearchMode('similarity')
    useAppStore.getState().setSolNumber('1041')
  })

  describe('Similarity Search Workflow', () => {
    it('should complete full similarity search workflow', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Verify initial state
      expect(screen.getByTestId('similarity-mode-btn')).toHaveClass('active')
      expect(screen.getByTestId('sol-input')).toHaveValue('1041')
      expect(screen.getByText('Active Filters:')).toBeInTheDocument()

      // Add filters
      await user.click(screen.getByTestId('add-elevation-filter'))
      await user.click(screen.getByTestId('add-slope-filter'))

      // Verify filters were added
      expect(screen.getByText('Active Filters: elevation, slope')).toBeInTheDocument()

      // Execute search
      const searchButton = screen.getByTestId('execute-similarity-search')
      expect(searchButton).not.toBeDisabled()

      await user.click(searchButton)

      // Verify results
      await waitFor(() => {
        expect(screen.getByText('Search Results (2)')).toBeInTheDocument()
        expect(screen.getByTestId('result-1042')).toBeInTheDocument()
        expect(screen.getByTestId('result-1043')).toBeInTheDocument()
      })
    })

    it('should prevent search without filters', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      const searchButton = screen.getByTestId('execute-similarity-search')
      expect(searchButton).toBeDisabled()
    })

    it('should allow changing reference sol', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      const solInput = screen.getByTestId('sol-input')
      await user.clear(solInput)
      await user.type(solInput, '1500')

      expect(solInput).toHaveValue('1500')
    })

    it('should clear filters correctly', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Add filters
      await user.click(screen.getByTestId('add-elevation-filter'))
      await user.click(screen.getByTestId('add-slope-filter'))

      expect(screen.getByText('Active Filters: elevation, slope')).toBeInTheDocument()

      // Clear filters
      await user.click(screen.getByTestId('clear-filters'))

      expect(screen.getByText('Active Filters:')).toBeInTheDocument()
    })
  })

  describe('Parameter Search Workflow', () => {
    it('should complete full parameter search workflow', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Switch to parameter search mode
      await user.click(screen.getByTestId('parameter-mode-btn'))

      expect(screen.getByTestId('parameter-mode-btn')).toHaveClass('active')
      expect(screen.getByTestId('parameter-search-panel')).toBeInTheDocument()

      // Add parameter filters
      await user.click(screen.getByTestId('add-elevation-param-filter'))
      await user.click(screen.getByTestId('add-slope-param-filter'))

      // Verify filters were added
      expect(screen.getByText('Parameter Filters: 2')).toBeInTheDocument()

      // Execute search
      const searchButton = screen.getByTestId('execute-parameter-search')
      expect(searchButton).not.toBeDisabled()

      await user.click(searchButton)

      // Verify results
      await waitFor(() => {
        expect(screen.getByText('Search Results (2)')).toBeInTheDocument()
        expect(screen.getByTestId('result-1044')).toBeInTheDocument()
        expect(screen.getByTestId('result-1045')).toBeInTheDocument()
      })
    })

    it('should prevent search without parameter filters', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Switch to parameter search mode
      await user.click(screen.getByTestId('parameter-mode-btn'))

      const searchButton = screen.getByTestId('execute-parameter-search')
      expect(searchButton).toBeDisabled()
    })

    it('should clear parameter filters correctly', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Switch to parameter search mode
      await user.click(screen.getByTestId('parameter-mode-btn'))

      // Add parameter filters
      await user.click(screen.getByTestId('add-elevation-param-filter'))
      expect(screen.getByText('Parameter Filters: 1')).toBeInTheDocument()

      // Clear parameter filters
      await user.click(screen.getByTestId('clear-param-filters'))
      expect(screen.getByText('Parameter Filters: 0')).toBeInTheDocument()
    })
  })

  describe('Search Mode Switching', () => {
    it('should maintain separate state for each search mode', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Add similarity filters
      await user.click(screen.getByTestId('add-elevation-filter'))
      expect(screen.getByText('Active Filters: elevation')).toBeInTheDocument()

      // Switch to parameter mode
      await user.click(screen.getByTestId('parameter-mode-btn'))

      // Add parameter filters
      await user.click(screen.getByTestId('add-elevation-param-filter'))
      expect(screen.getByText('Parameter Filters: 1')).toBeInTheDocument()

      // Switch back to similarity mode
      await user.click(screen.getByTestId('similarity-mode-btn'))

      // Verify similarity filters are still there
      expect(screen.getByText('Active Filters: elevation')).toBeInTheDocument()
    })

    it('should show appropriate panels for each mode', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Start with similarity mode
      expect(screen.getByTestId('similarity-search-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('parameter-search-panel')).not.toBeInTheDocument()

      // Switch to parameter mode
      await user.click(screen.getByTestId('parameter-mode-btn'))

      expect(screen.queryByTestId('similarity-search-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('parameter-search-panel')).toBeInTheDocument()
    })
  })

  describe('Search Results Display', () => {
    it('should display search results correctly', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Initially no results
      expect(screen.getByText('Search Results (0)')).toBeInTheDocument()

      // Add filter and search
      await user.click(screen.getByTestId('add-elevation-filter'))
      await user.click(screen.getByTestId('execute-similarity-search'))

      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText('Search Results (2)')).toBeInTheDocument()
        expect(screen.getByText('Sol 1042 - Score: 0.95')).toBeInTheDocument()
        expect(screen.getByText('Sol 1043 - Score: 0.87')).toBeInTheDocument()
      })
    })

    it('should update results when switching between search modes', async () => {
      render(
        <TestWrapper>
          <SearchTestApp />
        </TestWrapper>
      )

      // Execute similarity search
      await user.click(screen.getByTestId('add-elevation-filter'))
      await user.click(screen.getByTestId('execute-similarity-search'))

      await waitFor(() => {
        expect(screen.getByTestId('result-1042')).toBeInTheDocument()
      })

      // Switch to parameter mode and search
      await user.click(screen.getByTestId('parameter-mode-btn'))
      await user.click(screen.getByTestId('add-elevation-param-filter'))
      await user.click(screen.getByTestId('execute-parameter-search'))

      // Results should be updated
      await waitFor(() => {
        expect(screen.getByTestId('result-1044')).toBeInTheDocument()
        expect(screen.queryByTestId('result-1042')).not.toBeInTheDocument()
      })
    })
  })
})
