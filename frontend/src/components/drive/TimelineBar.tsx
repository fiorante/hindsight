import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSolData } from '../../hooks/useSol'
import { Play, Pause, Turtle, Plane, Rabbit } from 'lucide-react'
import type { FaultRecord } from '../../types'

interface TimelineBarProps {
  driveId: string
  isPlaying: boolean
  onTogglePlay: () => void
  onPause: () => void
  speed: number
  onSpeedChange: (speed: number) => void
  position: number
  onChangePosition: (pos: number) => void
  faults?: FaultRecord[]
  faultOverlayEnabled?: boolean
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  driveId,
  isPlaying,
  onTogglePlay,
  onPause,
  speed,
  onSpeedChange,
  position,
  onChangePosition,
  faults = [],
  faultOverlayEnabled = false,
}) => {
  const barRef = useRef<HTMLDivElement>(null)
  const [displayMode, setDisplayMode] = useState<'relative' | 'sclk'>('relative')
  const [hoveredFault, setHoveredFault] = useState<{ fault: FaultRecord; position: { x: number; y: number } } | null>(null)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null)
  const clampedPosition = useMemo(() => Math.max(0, Math.min(1, position || 0)), [position])
  const internalUpdateRef = useRef(false)
  const prevPosRef = useRef(clampedPosition)
  const playStartTsRef = useRef<number | null>(null)
  const basePositionRef = useRef<number>(clampedPosition)

  // fetch start/end sclk via hook
  const { data: solData } = useSolData(parseInt(driveId), !!driveId)
  useEffect(() => {
    if (solData) setRange({ start: solData.start_sclk, end: solData.end_sclk })
  }, [solData])

  // drive playhead forward while playing (absolute-time based)
  useEffect(() => {
    let intervalId: number | null = null
    if (isPlaying && range) {
      basePositionRef.current = clampedPosition
      playStartTsRef.current = performance.now()
      const tick = () => {
        if (!playStartTsRef.current) return
        const now = performance.now()
        const elapsedSec = (now - playStartTsRef.current) / 1000
        const duration = Math.max(1, range.end - range.start)
        const next = Math.min(1, basePositionRef.current + (elapsedSec * speed) / duration)
        // Avoid spamming updates when change is imperceptible
        if (Math.abs(next - prevPosRef.current) < 0.0005) return
        internalUpdateRef.current = true
        prevPosRef.current = next
        onChangePosition(next)
        if (next >= 1) {
          // stop automatically at end
          playStartTsRef.current = null
          if (intervalId) window.clearInterval(intervalId)
        }
      }
      // 20 Hz update cadence for smoothness without overloading charts
      intervalId = window.setInterval(tick, 50)
    } else {
      playStartTsRef.current = null
    }
    return () => { if (intervalId) window.clearInterval(intervalId) }
  }, [isPlaying, speed, range, onChangePosition, clampedPosition])

  // Detect external playhead updates and pause if needed
  useEffect(() => {
    const changedExternally = !internalUpdateRef.current && Math.abs(clampedPosition - prevPosRef.current) > 0.0001
    if (changedExternally && isPlaying) {
      onPause()
    }
    prevPosRef.current = clampedPosition
    // clear internal flag after paint
    if (internalUpdateRef.current) {
      const id = requestAnimationFrame(() => { internalUpdateRef.current = false })
      return () => cancelAnimationFrame(id)
    }
  }, [clampedPosition, isPlaying, onPause])

  const handlePointer = (clientX: number) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    internalUpdateRef.current = true
    onChangePosition(x / rect.width)
  }

  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => handlePointer(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  // Prevent text selection during dragging
  useEffect(() => {
    if (dragging) {
      // Store original user-select style
      const originalUserSelect = document.body.style.userSelect;
      const originalWebkitUserSelect = (document.body.style as any).webkitUserSelect;

      // Disable text selection
      document.body.style.userSelect = 'none';
      (document.body.style as any).webkitUserSelect = 'none';

      return () => {
        // Restore original user-select style
        document.body.style.userSelect = originalUserSelect;
        (document.body.style as any).webkitUserSelect = originalWebkitUserSelect;
      };
    }
  }, [dragging]);

  // no dropdown; cycling speeds via a single button

  const totalSec = range ? Math.max(0, range.end - range.start) : 0
  const currentSec = range ? Math.round((range.end - range.start) * clampedPosition) : 0
  const formatHm = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const label = displayMode === 'relative' && range
    ? `${formatHm(currentSec)} / ${formatHm(totalSec)}`
    : range
      ? `${Math.round(range.start + clampedPosition * (range.end - range.start))} / ${range.end}`
      : '—'

  return (
    <div className={`flex items-center gap-3 ${faultOverlayEnabled && faults.length > 0 ? 'pb-2' : ''}`}>
      {/* left time label (click to toggle). Fixed width to prevent layout shift */}
      <button
        className="text-xs text-gray-700 dark:text-stellar-dark-text-primary hover:text-gray-900 dark:hover:text-stellar-dark-text-primary underline-offset-2 hover:underline font-mono tabular-nums w-32 text-left"
        onClick={() => setDisplayMode(displayMode === 'relative' ? 'sclk' : 'relative')}
        title="Toggle label format"
      >
        {label}
      </button>

      {/* play/pause: circular */}
      <button
        onClick={onTogglePlay}
        className="w-8 h-8 rounded-full bg-gray-900 dark:bg-stellar-cta text-white dark:text-black flex items-center justify-center hover:bg-gray-800 dark:hover:bg-stellar-dark-text-secondary focus:outline-none flex-none"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* bar fills available space */}
      <div className="flex-1 relative">
        <div
          className="relative h-3 bg-gray-300 dark:bg-stellar-dark-background rounded w-full cursor-pointer"
          ref={barRef}
          onMouseDown={(e) => { setDragging(true); handlePointer(e.clientX) }}
        >
          <div className="absolute left-0 top-0 bottom-0 bg-gray-900 dark:bg-white rounded" style={{ width: `${Math.max(0, Math.min(100, clampedPosition * 100))}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white dark:bg-white border-2 border-black dark:border-black rounded-full shadow cursor-grab"
            style={{ left: `${clampedPosition * 100}%`, transform: 'translate(-50%, -50%)' }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(true) }}
          />
        </div>

        {/* fault overlay */}
        {faultOverlayEnabled && faults.length > 0 && range && (
          <div className="absolute top-full left-0 right-0 h-6 flex items-center justify-center">
            {faults.map((fault, index) => {
              // Calculate position based on SCLK
              const position = Math.max(0, Math.min(1, (fault.sclk - range.start) / (range.end - range.start)));

              return (
                <div
                  key={`fault-${index}`}
                  className="absolute w-3 h-3 bg-stellar-fault-red rounded-full transform -translate-x-1/2 cursor-pointer"
                  style={{
                    left: `${position * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredFault({
                      fault,
                      position: { x: rect.left + rect.width / 2, y: rect.top }
                    });
                  }}
                  onMouseLeave={() => setHoveredFault(null)}
                  onClick={() => {
                    // Move playhead to fault's SCLK timestamp when clicked
                    if (range && fault.sclk) {
                      const startSclk = range.start;
                      const endSclk = range.end;
                      const duration = endSclk - startSclk;

                      if (duration > 0) {
                        // Calculate normalized position (0-1) based on fault's SCLK
                        const normalized = Math.max(0, Math.min(1, (fault.sclk - startSclk) / duration));
                        onChangePosition(normalized);
                      }
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Custom fault tooltip */}
      {hoveredFault && (
        <div
          className="fixed bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs pointer-events-none z-50"
          style={{
            left: hoveredFault.position.x,
            top: hoveredFault.position.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold">{hoveredFault.fault.fault_type}</div>
          <div className="text-xs opacity-90">SCLK: {hoveredFault.fault.sclk}</div>
        </div>
      )}

      {/* speed cycle button: 10x (turtle), 60x (squirrel), 600x (rabbit) */}
      <button
        onClick={() => {
          const options = [10, 60, 600]
          const idx = options.indexOf(speed)
          const next = options[(idx + 1 + options.length) % options.length]
          onSpeedChange(next)
        }}
        className="w-8 h-8 rounded-full bg-stellar-dark-surface-elevated dark:bg-stellar-cta text-white dark:text-black flex items-center justify-center hover:bg-gray-700 dark:hover:bg-stellar-dark-text-secondary focus:outline-none flex-none"
        title={`Speed: ${speed}x (click to change)`}
      >
        {speed >= 600 ? (
          <Plane className="w-4 h-4" />
        ) : speed >= 60 ? (
          <Rabbit className="w-4 h-4" />
        ) : (
          <Turtle className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}


