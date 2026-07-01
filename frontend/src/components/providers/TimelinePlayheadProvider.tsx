import { useAppStore } from '../../state/store'

export const usePlayhead = () => {
  const position = useAppStore((s) => s.position)
  const setPosition = useAppStore((s) => s.setPosition)
  const hoveredElement = useAppStore((s) => s.hoveredElement)
  const setHoveredElement = useAppStore((s) => s.setHoveredElement)
  const selectedDrives = useAppStore((s) => s.selectedDrives)
  const setSelectedDrives = useAppStore((s) => s.setSelectedDrives)
  const drivePositions = useAppStore((s) => s.drivePositions)
  const setDrivePosition = useAppStore((s) => s.setDrivePosition)
  return {
    position,
    setPosition,
    hoveredElement,
    setHoveredElement,
    selectedDrives,
    setSelectedDrives,
    drivePositions,
    setDrivePosition,
  }
}

// Provider fully removed; consumers can use usePlayhead directly.
