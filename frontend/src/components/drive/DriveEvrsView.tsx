import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEVRS } from '../../hooks/useEvrs';
import type { EVRRecord, FaultRecord } from '../../types';
import { AlertTriangle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { usePlayhead } from '../providers/TimelinePlayheadProvider';
import { useSolData } from '../../hooks/useSol';
import { evrRepository } from '../../api/repositories';
import { useAppStore } from '../../state/store';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';

interface DriveEvrsViewProps {
  driveId: string;
  faults?: FaultRecord[];
  faultOverlayEnabled?: boolean;
}

export const DriveEvrsView: React.FC<DriveEvrsViewProps> = ({ driveId, faults: _faults = [], faultOverlayEnabled = false }) => {
  const sol = parseInt(driveId)
  const { drivePositions, setDrivePosition } = usePlayhead()
  const position = drivePositions[driveId] ?? null
  const setPosition = (pos: number | null) => setDrivePosition(driveId, pos)
  const [qInput, setQInput] = useState<string>('')
  const [q, setQ] = useState<string>('')
  const [levels, setLevels] = useState<string[]>(['ACTIVITY_LO', 'ACTIVITY_HI', 'COMMAND', 'WARNING_LO', 'WARNING_HI', 'FATAL'])
  const [modules, setModules] = useState<string[]>([])
  const [names, setNames] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const highlightedIndex = useAppStore((s) => s.highlightedEvrIndex[driveId] ?? null)
  const setHighlightedEvrIndex = useAppStore((s) => s.setHighlightedEvrIndex)

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const { data, isLoading, error, fetchNextPage, fetchPreviousPage, hasNextPage, hasPreviousPage, isFetching } = useEVRS(sol, {
    q: q || undefined,
    level: levels.length ? levels : undefined,
    module: modules.length ? modules : undefined,
    name: names.length ? names : undefined,
    pageSize: 500,
  })

  // Keep previous data while fetching to avoid visual flashing
  const [stableData, setStableData] = useState<typeof data | undefined>(undefined)
  useEffect(() => {
    if (!isFetching && data) {
      setStableData(data)
    }
  }, [isFetching, data])

  const items: EVRRecord[] = useMemo(() => {
    const pages = stableData?.pages ?? data?.pages ?? []
    const merged: EVRRecord[] = []
    for (const p of pages) {
      const page = p as { items?: EVRRecord[] }
      if (page?.items?.length) merged.push(...page.items)
    }
    return merged.sort((a, b) => (a.sclk === b.sclk ? a.log_num - b.log_num : a.sclk - b.sclk))
  }, [stableData, data])

  // Determine where to render the playhead (red line before the first row with sclk >= current position)
  const { data: solData } = useSolData(sol)
  const computedPlayheadIndex = useMemo(() => {
    if (!items.length) return -1
    if (position == null || solData?.start_sclk == null || solData?.end_sclk == null) return -1
    const clamped = Math.max(0, Math.min(1, position))
    const currentSclk = Math.round(solData.start_sclk + clamped * (solData.end_sclk - solData.start_sclk))
    const idx = items.findIndex((evr) => evr.sclk >= currentSclk)
    return idx === -1 ? items.length : idx
  }, [items, position, solData?.start_sclk, solData?.end_sclk])

  // Cosmetic override: when the user clicks between two rows that share the
  // same SCLK, the underlying playhead position can't distinguish them, so
  // `computedPlayheadIndex` always snaps to the first one. We remember the
  // clicked index and use it as long as it still resolves to the same SCLK as
  // the one derived from the live position; any external position change
  // (chart drag, timeline scrub, etc.) clears the override automatically.
  const [cosmeticPlayheadIndex, setCosmeticPlayheadIndex] = useState<number | null>(null)
  const playheadIndex = useMemo(() => {
    if (cosmeticPlayheadIndex == null) return computedPlayheadIndex
    const computedRow = items[computedPlayheadIndex]
    const cosmeticRow = items[cosmeticPlayheadIndex]
    if (computedRow && cosmeticRow && computedRow.sclk === cosmeticRow.sclk) {
      return cosmeticPlayheadIndex
    }
    return computedPlayheadIndex
  }, [computedPlayheadIndex, cosmeticPlayheadIndex, items])

  // If the live position drifts away from the cosmetic row, drop the override.
  useEffect(() => {
    if (cosmeticPlayheadIndex == null) return
    const computedRow = items[computedPlayheadIndex]
    const cosmeticRow = items[cosmeticPlayheadIndex]
    if (!computedRow || !cosmeticRow || computedRow.sclk !== cosmeticRow.sclk) {
      setCosmeticPlayheadIndex(null)
    }
  }, [computedPlayheadIndex, cosmeticPlayheadIndex, items])

  // When playhead changes, center the corresponding row in view
  useEffect(() => {
    if (!items.length) return
    if (playheadIndex < 0) return
    if (isFetching) return // wait for data to settle to avoid jumping/flashing
    const targetIndex = Math.min(Math.max(playheadIndex, 0), items.length - 1)
    const doScroll = () => {
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index: targetIndex, align: 'center' })
      }
    }
    // Ensure layout has settled before scrolling
    requestAnimationFrame(() => {
      doScroll()
      setTimeout(doScroll, 0)
    })
  }, [playheadIndex, items.length, position, isFetching])

  // Debounced search input
  useEffect(() => {
    const h = setTimeout(() => {
      setQ(qInput)
    }, 300)
    return () => clearTimeout(h)
  }, [qInput])

  // Facets for module and name filters
  const { data: facets } = useQuery({
    queryKey: ['evrFacets', sol, q],
    queryFn: () => evrRepository.getFacets(sol, q || undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // Hover preview and click-to-set playhead
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const onBoundaryClick = useCallback((index: number) => {
    if (!solData?.start_sclk || !solData?.end_sclk) return
    const evr = items[index]
    if (!evr) return
    const span = solData.end_sclk - solData.start_sclk
    if (span <= 0) return
    const normalized = (evr.sclk - solData.start_sclk) / span
    const clamped = Math.max(0, Math.min(1, normalized))
    setPosition(clamped)
    setCosmeticPlayheadIndex(index)
  }, [items, setPosition, solData?.start_sclk, solData?.end_sclk])

  if (isLoading && !stableData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">Loading EVRs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-500">Failed to load EVRs</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-stellar-dark-surface">
      <div className="p-3 border-b dark:border-stellar-dark-border bg-gray-50 dark:bg-stellar-dark-surface-elevated flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-600 dark:text-stellar-dark-text-secondary">Search</label>
            <input
              type="text"
              placeholder="Search EVRs (message, module, name)"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="w-full px-3 py-1 text-xs border border-gray-300 dark:border-stellar-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-stellar-dark-accent focus:border-transparent bg-white dark:bg-stellar-dark-surface text-gray-900 dark:text-stellar-dark-text-primary placeholder-gray-500 dark:placeholder-stellar-dark-text-secondary"
            />
          </div>
          <button className="flex items-center gap-1 px-2 py-1 text-xs border dark:border-stellar-dark-border rounded text-gray-700 dark:text-stellar-dark-text-primary hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated bg-white dark:bg-stellar-dark-surface" onClick={() => setShowFilters(s => !s)}>
            <Filter className="h-4 w-4" />
            Filters
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-stellar-dark-text-secondary mb-1">Level</label>
              <MultiSelectDropdown
                baseLabel="Levels"
                options={[{ value: 'DIAGNOSTIC' }, { value: 'ACTIVITY_LO' }, { value: 'ACTIVITY_HI' }, { value: 'COMMAND' }, { value: 'WARNING_LO' }, { value: 'WARNING_HI' }, { value: 'FATAL' }]}
                selected={levels}
                onChange={setLevels}
                minWidth={180}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Module</label>
              <MultiSelectDropdown
                baseLabel="Modules"
                options={(facets?.modules ?? []).map(m => ({ value: m.value, count: m.count }))}
                selected={modules}
                onChange={setModules}
                minWidth={220}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name</label>
              <MultiSelectDropdown
                baseLabel="Names"
                options={(facets?.names ?? []).map(n => ({ value: n.value, count: n.count }))}
                selected={names}
                onChange={setNames}
                minWidth={240}
              />
            </div>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="px-3 py-2 border-b dark:border-stellar-dark-border bg-gray-100 dark:bg-stellar-dark-surface-elevated sticky top-0 z-10">
        <div className="flex w-[1200px] gap-4 items-center text-xs font-mono text-gray-700 dark:text-stellar-dark-text-primary">
          <div className="w-20 flex-shrink-0">sclk</div>
          <div className="w-28 flex-shrink-0">level</div>
          <div className="w-28 flex-shrink-0">module</div>
          <div className="w-48 flex-shrink-0">name</div>
          <div className="flex-1">message</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-stellar-dark-text-secondary">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-stellar-dark-text-secondary" />
              <p>No EVRs available for this drive</p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            totalCount={items.length}
            itemContent={(index) => {
              const evr = items[index]
              const level = (evr.level || '').toUpperCase()
              const levelClass = level === 'FATAL' ? 'bg-gray-900 dark:bg-red-900 text-white' :
                level === 'WARNING_HI' ? 'bg-gray-700 dark:bg-red-800 text-white' :
                  level === 'WARNING_LO' ? 'bg-gray-600 dark:bg-orange-800 text-white' :
                    level === 'COMMAND' ? 'bg-gray-500 dark:bg-blue-800 text-white' :
                      level === 'ACTIVITY_HI' ? 'bg-gray-400 dark:bg-stellar-dark-surface-elevated' :
                        level === 'ACTIVITY_LO' ? 'bg-gray-300 dark:bg-stellar-dark-surface' :
                          level === 'DIAGNOSTIC' ? 'bg-gray-200 dark:bg-stellar-dark-background' : 'bg-gray-100 dark:bg-stellar-dark-background'
              return (
                <>
                  {/* Single divider, recolored based on state to avoid layout shift - spans full width */}
                  {index > 0 && (
                    <div className={`relative h-0.5 ${index === playheadIndex ? 'bg-white' : index === previewIndex ? 'bg-white/50' : 'bg-white/10 dark:bg-stellar-dark-background'}`}>
                      {/* Playhead handle dot — sits flush against the panel's
                          left edge with the whole circle visible inside the
                          panel, vertically centered on the divider line. */}
                      {index === playheadIndex && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white" />
                      )}
                    </div>
                  )}
                  {/* Small playhead placement target - only on the divider line */}
                  {index > 0 && (
                    <button
                      type="button"
                      aria-label="Set playhead here"
                      title="Click to move playhead here"
                      className="absolute left-0 right-0 -mt-1 h-1 cursor-pointer hover:bg-white/20"
                      onMouseEnter={() => setPreviewIndex(index)}
                      onMouseLeave={() => setPreviewIndex((curr) => (curr === index ? null : curr))}
                      onClick={() => onBoundaryClick(index)}
                    />
                  )}
                  {/* Row content without extra vertical padding */}
                  <div
                    className={`py-1 px-2 border-b ${levelClass} ${faultOverlayEnabled && evr.name === 'MOM_EVR_FAULT' ? '!bg-stellar-fault-red !text-white !border-stellar-fault-red' : ''
                      } cursor-pointer transition-opacity duration-200`}
                    onClick={() => setHighlightedEvrIndex(driveId, highlightedIndex === index ? null : index)}
                    style={{
                      // Dim non-highlighted rows
                      opacity: highlightedIndex === null || highlightedIndex === index ? 1 : 0.6
                    }}
                  >
                    <div className="flex w-[1200px] gap-4 items-center text-xs font-mono text-gray-900 dark:text-stellar-dark-text-primary whitespace-nowrap">
                      <div className="w-20 flex-shrink-0">{evr.sclk}</div>
                      <div className="w-28 flex-shrink-0 truncate">{level}</div>
                      <div className="w-28 flex-shrink-0 truncate">{evr.module}</div>
                      <div className="w-48 flex-shrink-0 truncate">{evr.name}</div>
                      <div className="flex-1" title={evr.message}>{evr.message}</div>
                    </div>
                  </div>
                </>
              )
            }}
            endReached={() => { if (hasNextPage) fetchNextPage() }}
            startReached={() => { if (hasPreviousPage) fetchPreviousPage() }}
            style={{ height: '100%' }}
          />
        )}
      </div>


    </div>
  );
};
