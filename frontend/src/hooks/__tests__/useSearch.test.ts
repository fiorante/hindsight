import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { useSearch } from '../useSearch'
import { searchRepository } from '../../api/repositories/searchRepository'
import * as transformers from '../../api/transformers/searchTransformers'

// Mock TanStack Query's useMutation
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: vi.fn(),
  }
})

// Mock the transformers
vi.mock('../../api/transformers/searchTransformers', () => ({
  createSimilaritySearchRequest: vi.fn(),
  createParameterSearchRequest: vi.fn(),
  createReferenceSolResults: vi.fn(),
  mergeResultsWithReference: vi.fn(),
  transformSolListToSimilarityResults: vi.fn(),
}))

describe('useSearch hook', () => {
  let queryClient: QueryClient
  let mockMutateAsync: any

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Mock the mutateAsync function
    mockMutateAsync = vi.fn()

    // Mock useMutation to return a mock mutation object
    vi.mocked(useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isLoading: false,
      isError: false,
      error: null,
      data: undefined,
      mutate: vi.fn(),
      reset: vi.fn(),
      isSuccess: false,
      isIdle: true,
      isPending: false,
      variables: undefined,
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: 'idle' as const,
      submittedAt: 0,
    } as any)

    vi.clearAllMocks()
    vi.mocked(transformers.createSimilaritySearchRequest).mockReturnValue({
      reference: { type: 'sol', value: 1041 },
      config: { algorithm: 'dtw', variables: ['elevation'], max_results: 3 }
    })
    vi.mocked(transformers.createParameterSearchRequest).mockReturnValue({
      filters: [{ field: 'elevation', operator: 'gte', value: 100 }],
      limit: 50
    })
    vi.mocked(transformers.createReferenceSolResults).mockReturnValue([])
    vi.mocked(transformers.mergeResultsWithReference).mockReturnValue([])
    vi.mocked(transformers.transformSolListToSimilarityResults).mockReturnValue([])
  })

  describe('initial state', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useSearch(), { wrapper })

      expect(result.current.isSearching).toBe(false)
      expect(result.current.hasSearched).toBe(false)
      expect(result.current.isSimilaritySearchLoading).toBe(false)
      expect(result.current.isParameterSearchLoading).toBe(false)
    })
  })

  describe('executeSimilaritySearch', () => {
    it('should execute similarity search successfully', async () => {
      const mockResults = {
        results: [{ sol: 1042, similarity_score: 0.95 }],
        reference_metadata: {},
        algorithm: 'test',
        variables: ['elevation'],
        total_results: 1
      }
      mockMutateAsync.mockResolvedValueOnce(mockResults)

      const onSuccess = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeSimilaritySearch(
        'sol',
        ['elevation'],
        { solNumber: '1041', onSuccess }
      )

      expect(mockMutateAsync).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('should handle empty variables error', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeSimilaritySearch(
        'sol',
        [],
        { solNumber: '1041', onError }
      )

      expect(onError).toHaveBeenCalledWith('Please select at least one variable for similarity comparison')
    })

    it('should handle invalid sol number error', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeSimilaritySearch(
        'sol',
        ['elevation'],
        { onError }
      )

      expect(onError).toHaveBeenCalledWith('Please enter a valid Sol number')
    })

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Network error')
      mockMutateAsync.mockRejectedValueOnce(apiError)

      const onError = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeSimilaritySearch(
        'sol',
        ['elevation'],
        { solNumber: '1041', onError }
      )

      expect(onError).toHaveBeenCalledWith('Network error')
    })
  })

  describe('executeParameterSearch', () => {
    it('should execute parameter search successfully', async () => {
      const mockSols = [1041, 1042, 1043]
      mockMutateAsync.mockResolvedValueOnce(mockSols)

      const onSuccess = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeParameterSearch(
        [{ parameter: 'elevation', min: '100', max: '200' }],
        { onSuccess }
      )

      expect(mockMutateAsync).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })

    it('should handle empty filters error', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeParameterSearch([], { onError })

      expect(onError).toHaveBeenCalledWith('Please add at least one parameter filter')
    })

    it('should handle parameter search API errors', async () => {
      const apiError = new Error('Parameter search failed')
      mockMutateAsync.mockRejectedValueOnce(apiError)

      const onError = vi.fn()
      const { result } = renderHook(() => useSearch(), { wrapper })

      await result.current.executeParameterSearch(
        [{ parameter: 'elevation', min: '100', max: '200' }],
        { onError }
      )

      expect(onError).toHaveBeenCalledWith('Parameter search failed')
    })
  })

  describe('loading states', () => {
    it('should provide loading state properties', () => {
      const { result } = renderHook(() => useSearch(), { wrapper })

      // Check that all expected properties are available
      expect(typeof result.current.isSearching).toBe('boolean')
      expect(typeof result.current.hasSearched).toBe('boolean')
      expect(typeof result.current.isSimilaritySearchLoading).toBe('boolean')
      expect(typeof result.current.isParameterSearchLoading).toBe('boolean')
    })
  })
})
