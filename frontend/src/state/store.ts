import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { SimilarityResult } from '../types'
import { createSearchSlice, type SearchSlice } from './searchSlice'
import { createUrlSlice, type UrlSlice } from './urlSlice'
import { urlSyncMiddleware } from '../middleware/urlSyncMiddleware'

// Types mirrored from DriveStateProvider to avoid broad refactors
export interface SegmentMarker {
  position: [number, number]
  sclk: number
  distanceKm: number
}

export type SegmentSelectionMode = 'none' | 'start' | 'end'

// Layout structure types - only store the component tree structure, not GoldenLayout internals
// `size` / `minSize` are GL2 sizing strings (e.g. '40%', '1fr', '120px') and
// need to ride along so that proportion changes in one panel can be replayed
// to the others when sync is enabled.
export interface LayoutComponent {
  type: 'component'
  componentType: string
  title: string
  isClosable?: boolean
  size?: string
  minSize?: string
}

export interface LayoutContainer {
  type: 'row' | 'column' | 'stack'
  content: LayoutItem[]
  activeItemIndex?: number // for stacks
  size?: string
  minSize?: string
}

export type LayoutItem = LayoutComponent | LayoutContainer

export interface DriveLayoutStructure {
  root: LayoutContainer
}

export type DriveSearchResult =
  | SimilarityResult
  | {
    sol: number
    similarity_score: number
    distance?: number
    duration?: number
    point_count?: number
  }

// Drive/selection state
interface DriveSlice {
  selectedDrives: string[]
  setSelectedDrives: (drives: string[]) => void
  toggleDriveSelection: (driveId: string) => void
  clearSelectedDrives: () => void

  hoveredDrive: string | null
  setHoveredDrive: (driveId: string | null) => void

  maxSelectedDrives: number
  setMaxSelectedDrives: (max: number) => void

  // Helpers
  isSelected: (driveId: string) => boolean
  isHovered: (driveId: string) => boolean
  canSelectMore: () => boolean
  isInSearchResults: (driveId: string) => boolean
  isReferenceDrive: (driveId: string) => boolean
  searchResultDriveIds: () => string[]
}

// Segment selection state
interface SegmentSlice {
  segmentStartMarker: SegmentMarker | null
  segmentEndMarker: SegmentMarker | null
  segmentSelectionMode: SegmentSelectionMode
  setSegmentStartMarker: (marker: SegmentMarker | null) => void
  setSegmentEndMarker: (marker: SegmentMarker | null) => void
  setSegmentSelectionMode: (mode: SegmentSelectionMode) => void
  clearSegmentSelection: () => void
}

// UI state that previously lived in App.tsx
type ViewMode = 'map' | 'drives'
interface UiSlice {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isSearchPanelOpen: boolean
  toggleSearchPanel: () => void
  focusedSol: string | null
  setFocusedSol: (sol: string | null) => void

  // Timeline UI state
  timelineExpanded: boolean
  setTimelineExpanded: (expanded: boolean) => void
  timelineSpeed: number
  setTimelineSpeed: (speed: number) => void
  drivePlayStates: Record<string, boolean>
  setDrivePlayState: (driveId: string, playing: boolean) => void

  // Sync drive panel layouts across open panels
  syncDrivePanels: boolean
  setSyncDrivePanels: (enabled: boolean) => void

  // Drive panel layout structure - stores only the component arrangement
  driveLayoutStructure: DriveLayoutStructure | null
  setDriveLayoutStructure: (structure: DriveLayoutStructure | null) => void

  // Global reset trigger for all drive panels
  driveLayoutResetNonce: number
  resetAllDriveLayouts: () => void

  // Chart state for syncing between drive panels
  activeCharts: string[]
  setActiveCharts: (charts: string[]) => void
  addChart: (parameter: string) => void
  removeChart: (parameter: string) => void
  clearCharts: () => void

  // Imagery view preferences
  vceImageSideMode: 'left' | 'both' | 'right'
  setVceImageSideMode: (mode: 'left' | 'both' | 'right') => void
  pdiImageSideMode: 'left' | 'both' | 'right'
  setPdiImageSideMode: (mode: 'left' | 'both' | 'right') => void

  // Fault overlay state
  faultOverlayEnabled: boolean
  setFaultOverlayEnabled: (enabled: boolean) => void

  // Pinned parameters for sol tooltips
  pinnedParameters: string[]
  addPinnedParameter: (parameter: string) => void
  removePinnedParameter: (parameter: string) => void

  // Track highlighted EVR row
  highlightedEvrIndex: Record<string, number | null>
  setHighlightedEvrIndex: (driveId: string, index: number | null) => void

  // Shared vertical scroll position (0-1 fraction of max scrollTop) for each
  // synchronisable sub-panel type. Used by useSyncedPanelScroll so that
  // scrolling within e.g. the Charts pane in one drive panel mirrors to all
  // others while syncDrivePanels is on. Keyed by panel id ('charts',
  // 'imagery'). EVRs are excluded — their scroll is already coupled to the
  // shared playhead, which is enough.
  panelScrollFractions: Record<string, number>
  setPanelScrollFraction: (panel: string, fraction: number) => void
}

// Playhead state previously in TimelinePlayheadProvider
interface PlayheadSlice {
  position: number | null
  setPosition: (position: number | null) => void
  hoveredElement: string | null
  setHoveredElement: (elementId: string | null) => void
  drivePositions: Record<string, number | null>
  setDrivePosition: (driveId: string, position: number | null) => void
}

export type AppState = DriveSlice & SegmentSlice & UiSlice & PlayheadSlice & SearchSlice & UrlSlice

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      urlSyncMiddleware(
        (set, get) => ({
          // Search slice
          ...createSearchSlice(set, get),

          // URL slice
          ...createUrlSlice(set, get),

          // Drive/selection slice
          selectedDrives: [],
          setSelectedDrives: (drives) => set({ selectedDrives: drives }),
          toggleDriveSelection: (driveId) =>
            set((state) => {
              const already = state.selectedDrives.includes(driveId)
              if (already) {
                return { selectedDrives: state.selectedDrives.filter((id) => id !== driveId) }
              }
              if (!state.canSelectMore()) {
                return {}
              }
              return { selectedDrives: [...state.selectedDrives, driveId] }
            }),
          clearSelectedDrives: () => set({ selectedDrives: [] }),

          hoveredDrive: null,
          setHoveredDrive: (driveId) => set({ hoveredDrive: driveId }),

          maxSelectedDrives: 3,
          setMaxSelectedDrives: (max) => set({ maxSelectedDrives: max }),

          isSelected: (driveId: string) => get().selectedDrives.includes(driveId),
          isHovered: (driveId: string) => get().hoveredDrive === driveId,
          canSelectMore: () => get().selectedDrives.length < get().maxSelectedDrives,
          isInSearchResults: (driveId: string) => {
            const state = get();
            return state.searchResults.map((r) => r.sol.toString()).includes(driveId);
          },
          isReferenceDrive: (driveId: string) => {
            const state = get();
            return state.searchResults.some(
              (result) =>
                result.sol.toString() === driveId &&
                'isReference' in result &&
                result.isReference === true
            );
          },
          searchResultDriveIds: () => {
            const state = get();
            return state.searchResults.map((r) => r.sol.toString());
          },

          // Segment slice
          segmentStartMarker: null,
          segmentEndMarker: null,
          segmentSelectionMode: 'none',
          setSegmentStartMarker: (marker) => set({ segmentStartMarker: marker }),
          setSegmentEndMarker: (marker) => set({ segmentEndMarker: marker }),
          setSegmentSelectionMode: (mode) => set({ segmentSelectionMode: mode }),
          clearSegmentSelection: () => set({ segmentStartMarker: null, segmentEndMarker: null, segmentSelectionMode: 'none' }),

          // UI slice
          viewMode: 'map',
          setViewMode: (mode) => set({ viewMode: mode }),
          isSearchPanelOpen: true,
          toggleSearchPanel: () => set((s) => ({ isSearchPanelOpen: !s.isSearchPanelOpen })),
          focusedSol: null,
          setFocusedSol: (sol) => set({ focusedSol: sol }),

          // Timeline UI state (persisted)
          timelineExpanded: true,
          setTimelineExpanded: (expanded) => set({ timelineExpanded: expanded }),
          timelineSpeed: 60,
          setTimelineSpeed: (speed) => set({ timelineSpeed: speed }),
          drivePlayStates: {},
          setDrivePlayState: (driveId, playing) => set((s) => ({ drivePlayStates: { ...s.drivePlayStates, [driveId]: playing } })),

          // Layout sync toggle (persisted)
          syncDrivePanels: true,
          setSyncDrivePanels: (enabled) => set({ syncDrivePanels: enabled }),

          // Drive panel layout structure persistence
          driveLayoutStructure: null,
          setDriveLayoutStructure: (structure: DriveLayoutStructure | null) => set({ driveLayoutStructure: structure }),

          // Global reset trigger
          driveLayoutResetNonce: 0,
          resetAllDriveLayouts: () => set((s) => ({ driveLayoutStructure: null, driveLayoutResetNonce: s.driveLayoutResetNonce + 1 })),

          // Chart state for syncing between drive panels
          activeCharts: [],
          setActiveCharts: (charts) => set({ activeCharts: charts }),
          addChart: (parameter) => set((s) => ({
            activeCharts: s.activeCharts.includes(parameter) ? s.activeCharts : [...s.activeCharts, parameter]
          })),
          removeChart: (parameter) => set((s) => ({ activeCharts: s.activeCharts.filter(p => p !== parameter) })),
          clearCharts: () => set({ activeCharts: [] }),

          // Imagery view preferences (persisted)
          vceImageSideMode: 'both',
          setVceImageSideMode: (mode) => set({ vceImageSideMode: mode }),
          pdiImageSideMode: 'both',
          setPdiImageSideMode: (mode) => set({ pdiImageSideMode: mode }),

          // Fault overlay state (persisted)
          faultOverlayEnabled: false,
          setFaultOverlayEnabled: (enabled) => set({ faultOverlayEnabled: enabled }),

          // Pinned parameters for sol tooltips (persisted)
          pinnedParameters: [] as string[],
          addPinnedParameter: (parameter: string) =>
            set((s) => ({
              pinnedParameters: s.pinnedParameters.includes(parameter)
                ? s.pinnedParameters
                : [...s.pinnedParameters, parameter]
            })),
          removePinnedParameter: (parameter: string) =>
            set((s) => ({
              pinnedParameters: s.pinnedParameters.filter(p => p !== parameter)
            })),

          // Track highlighted EVR row (persisted)
          highlightedEvrIndex: {},
          setHighlightedEvrIndex: (driveId: string, index: number | null) =>
            set((s) => ({
              highlightedEvrIndex: {
                ...s.highlightedEvrIndex,
                [driveId]: index
              }
            })),

          // Synced scroll fractions per panel id
          panelScrollFractions: {},
          setPanelScrollFraction: (panel: string, fraction: number) =>
            set((s) => {
              const prev = s.panelScrollFractions[panel]
              if (typeof prev === 'number' && Math.abs(prev - fraction) < 0.001) return s
              return { panelScrollFractions: { ...s.panelScrollFractions, [panel]: fraction } }
            }),

          // Playhead slice
          position: null,
          setPosition: (position) => set({ position }),
          hoveredElement: null,
          setHoveredElement: (elementId) => set({ hoveredElement: elementId }),
          drivePositions: {},
          setDrivePosition: (driveId, position) =>
            set((prev) => {
              const clampedPosition =
                position === null ? null : Math.max(0, Math.min(1, position));
              return {
                drivePositions: {
                  ...prev.drivePositions,
                  [driveId]: clampedPosition,
                },
              }
            }),
        })
      ),
      { name: 'app-store' },
    ),
    { enabled: import.meta.env.DEV },
  ),
)


