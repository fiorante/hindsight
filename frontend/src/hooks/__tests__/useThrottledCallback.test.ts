import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useThrottledCallback } from '../useThrottledCallback'

describe('useThrottledCallback hook', () => {
  let mockCallback: ReturnType<typeof vi.fn>
  let mockRequestAnimationFrame: ReturnType<typeof vi.fn>
  let mockCancelAnimationFrame: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCallback = vi.fn()
    mockRequestAnimationFrame = vi.fn((fn) => {
      setTimeout(fn, 16) // Simulate ~60fps
      return 123 // Mock frame ID
    })
    mockCancelAnimationFrame = vi.fn()

    // Mock global functions
    global.requestAnimationFrame = mockRequestAnimationFrame
    global.cancelAnimationFrame = mockCancelAnimationFrame
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })

  it('should throttle multiple calls to single animation frame', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current(1)
      result.current(2)
      result.current(3)
    })

    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(mockCallback).not.toHaveBeenCalled()

    // Wait for animation frame
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledTimes(1)
    expect(mockCallback).toHaveBeenCalledWith(3) // Last call wins
  })

  it('should call callback with latest arguments', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current('first', 1)
      result.current('second', 2)
      result.current('third', 3)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledWith('third', 3)
  })

  it('should handle function with custom getValue option', async () => {
    const getValue = vi.fn((x: number) => x)
    const { result } = renderHook(() =>
      useThrottledCallback(mockCallback, { getValue })
    )

    act(() => {
      result.current(5)
      result.current(10)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(getValue).toHaveBeenCalledWith(10)
    expect(mockCallback).toHaveBeenCalledWith(10)
  })

  it('should handle multiple arguments correctly', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current(1, 'a', true, { test: 'value' })
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledWith(1, 'a', true, { test: 'value' })
  })

  it('should cancel animation frame on unmount', () => {
    const { result, unmount } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current(1)
    })

    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1)

    unmount()

    expect(mockCancelAnimationFrame).toHaveBeenCalledWith(123)
  })

  it('should not cancel if no frame is scheduled', () => {
    const { unmount } = renderHook(() => useThrottledCallback(mockCallback))

    unmount()

    expect(mockCancelAnimationFrame).not.toHaveBeenCalled()
  })

  it('should reset frame ID after execution', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current(1)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    // Second call should schedule new frame
    act(() => {
      result.current(2)
    })

    expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(2)
  })

  it('should handle rapid successive calls after frame execution', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    // First batch
    act(() => {
      result.current(1)
      result.current(2)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledTimes(1)
    expect(mockCallback).toHaveBeenLastCalledWith(2)

    // Second batch
    act(() => {
      result.current(3)
      result.current(4)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledTimes(2)
    expect(mockCallback).toHaveBeenLastCalledWith(4)
  })

  it('should work with default epsilon when no getValue provided', async () => {
    const { result } = renderHook(() => useThrottledCallback(mockCallback))

    act(() => {
      result.current(0.001) // Small value
      result.current(0.002) // Another small value
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledWith(0.002)
  })

  it('should preserve callback reference stability', () => {
    const { result, rerender } = renderHook(() => useThrottledCallback(mockCallback))

    const firstCallback = result.current
    rerender()
    const secondCallback = result.current

    expect(firstCallback).toBe(secondCallback)
  })

  it('should handle no arguments correctly', async () => {
    const noArgCallback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(noArgCallback))

    act(() => {
      result.current()
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(noArgCallback).toHaveBeenCalledWith()
  })

  it('should handle custom epsilon value', async () => {
    const getValue = vi.fn((x: number) => x)
    const { result } = renderHook(() =>
      useThrottledCallback(mockCallback, { epsilon: 0.1, getValue })
    )

    act(() => {
      result.current(1)
    })

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    expect(mockCallback).toHaveBeenCalledWith(1)
  })
})
