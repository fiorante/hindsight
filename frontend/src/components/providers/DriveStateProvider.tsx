import { useAppStore } from '../../state/store'
import type { SimilarityResult } from '../../types'

export type DriveSearchResult =
  | SimilarityResult
  | {
    sol: number
    similarity_score: number
    distance?: number
    duration?: number
    point_count?: number
  }

export const useDriveState = () => {
  const searchResults = useAppStore((s) => s.searchResults)
  const setSearchResults = useAppStore((s) => s.setSearchResults)
  const selectedDrives = useAppStore((s) => s.selectedDrives)
  const setSelectedDrives = useAppStore((s) => s.setSelectedDrives)
  const hoveredDrive = useAppStore((s) => s.hoveredDrive)
  const setHoveredDrive = useAppStore((s) => s.setHoveredDrive)

  const segmentStartMarker = useAppStore((s) => s.segmentStartMarker)
  const segmentEndMarker = useAppStore((s) => s.segmentEndMarker)
  const segmentSelectionMode = useAppStore((s) => s.segmentSelectionMode)
  const setSegmentStartMarker = useAppStore((s) => s.setSegmentStartMarker)
  const setSegmentEndMarker = useAppStore((s) => s.setSegmentEndMarker)
  const setSegmentSelectionMode = useAppStore((s) => s.setSegmentSelectionMode)
  const clearSegmentSelection = useAppStore((s) => s.clearSegmentSelection)

  const maxSelectedDrives = useAppStore((s) => s.maxSelectedDrives)

  const isInSearchResults = useAppStore((s) => s.isInSearchResults)
  const isReferenceDrive = useAppStore((s) => s.isReferenceDrive)
  const isSelected = useAppStore((s) => s.isSelected)
  const isHovered = useAppStore((s) => s.isHovered)
  const canSelectMore = useAppStore((s) => s.canSelectMore)
  const toggleDriveSelection = useAppStore((s) => s.toggleDriveSelection)
  const clearSelectedDrives = useAppStore((s) => s.clearSelectedDrives)
  const searchResultDriveIds = searchResults.map(r => r.sol.toString())

  return {
    searchResults,
    setSearchResults,
    selectedDrives,
    setSelectedDrives,
    hoveredDrive,
    setHoveredDrive,
    segmentStartMarker,
    segmentEndMarker,
    segmentSelectionMode,
    setSegmentStartMarker,
    setSegmentEndMarker,
    setSegmentSelectionMode,
    clearSegmentSelection,
    maxSelectedDrives,
    isInSearchResults,
    isReferenceDrive,
    isSelected,
    isHovered,
    canSelectMore,
    toggleDriveSelection,
    clearSelectedDrives,
    searchResultDriveIds,
  }
}