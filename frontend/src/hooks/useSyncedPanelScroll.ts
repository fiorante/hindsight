import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useAppStore } from '../state/store'

// Mirrors a scrollable container's vertical scroll position across every drive
// panel rendering the same sub-panel id. The shared value is a fraction in
// [0, 1] of (scrollHeight - clientHeight). The hook:
//  - applies incoming fractions from the store to the local element
//  - writes user-driven scrolls back to the store
//  - guards a feedback loop by tracking the last self-applied scrollTop and
//    ignoring scroll events that match it within 1px.
export function useSyncedPanelScroll(
  panelId: string,
  enabled: boolean,
  externalRef?: MutableRefObject<HTMLDivElement | null>,
) {
  const localRef = useRef<HTMLDivElement | null>(null)
  const ref = externalRef ?? localRef
  const fraction = useAppStore((s) => s.panelScrollFractions[panelId])
  const setFraction = useAppStore((s) => s.setPanelScrollFraction)
  const lastSelfAppliedTopRef = useRef<number>(-1)

  // Apply incoming fraction → local scrollTop
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    if (typeof fraction !== 'number') return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    const target = fraction * max
    if (Math.abs(el.scrollTop - target) < 1) return
    lastSelfAppliedTopRef.current = target
    el.scrollTop = target
  }, [fraction, enabled, ref])

  const onScroll = useCallback(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const top = el.scrollTop
    if (Math.abs(top - lastSelfAppliedTopRef.current) < 1) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 0) return
    setFraction(panelId, top / max)
  }, [panelId, setFraction, enabled, ref])

  return { ref, onScroll }
}
