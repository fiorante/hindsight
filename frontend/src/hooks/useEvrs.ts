import { useInfiniteQuery } from '@tanstack/react-query';
import { evrRepository } from '../api/repositories';
import type { EVRRecord } from '../types';

/**
 * Hook for fetching EVR data for a specific sol
 */
export const useEVRS = (
  sol: number,
  options?: {
    enabled?: boolean
    q?: string
    level?: string[]
    module?: string[]
    name?: string[]
    pageSize?: number
    anchor?: { cursor_sclk: number; cursor_log: number } | null
  }
) => {
  const enabled = (options?.enabled ?? true) && !!sol
  const pageSize = options?.pageSize ?? 1000
  const q = options?.q
  const level = options?.level
  const module = options?.module
  const name = options?.name
  const anchor = options?.anchor ?? null

  return useInfiniteQuery<{
    items: EVRRecord[];
    next_cursor_sclk?: number | null;
    next_cursor_log?: number | null;
    prev_cursor_sclk?: number | null;
    prev_cursor_log?: number | null;
    total_returned: number;
  }>({
    queryKey: ['evrs', sol, q, level, module, name, pageSize, anchor?.cursor_sclk ?? null, anchor?.cursor_log ?? null],
    enabled,
    initialPageParam: { cursor_sclk: null as number | null, cursor_log: null as number | null, dir: 'next' as 'next' | 'prev' },
    getNextPageParam: (last) => (last?.next_cursor_sclk != null && last?.next_cursor_log != null)
      ? { cursor_sclk: last.next_cursor_sclk, cursor_log: last.next_cursor_log, dir: 'next' as const }
      : undefined,
    getPreviousPageParam: (first) => (first?.prev_cursor_sclk != null && first?.prev_cursor_log != null)
      ? { cursor_sclk: first.prev_cursor_sclk, cursor_log: first.prev_cursor_log, dir: 'prev' as const }
      : undefined,
    queryFn: ({ pageParam }) => {
      const p = pageParam as { cursor_sclk: number | null; cursor_log: number | null; dir: 'next' | 'prev' }
      const effCursorSclk = p?.cursor_sclk ?? anchor?.cursor_sclk ?? null
      const effCursorLog = p?.cursor_log ?? anchor?.cursor_log ?? null
      return evrRepository.streamEVRS({
        sol,
        limit: pageSize,
        cursor_sclk: effCursorSclk,
        cursor_log: effCursorLog,
        dir: p?.dir ?? 'next',
        q,
        level,
        module,
        name,
      })
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  })
}
