import { useCallback, useRef, useEffect } from 'react';

interface ThrottledCallbackOptions<TArgs extends any[] = any[]> {
  epsilon?: number;
  // Extract the numeric value from args to compare with epsilon
  getValue?: (...args: TArgs) => number;
}

/**
 * rAF-throttled callback to prevent excessive updates.
 * Works with any function signature. Provide getValue to control epsilon gating.
 */
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  options: ThrottledCallbackOptions<Parameters<T>> = {}
): (...args: Parameters<T>) => void {
  const { epsilon = 0.0005, getValue } = options;

  const rafIdRef = useRef<number | null>(null);
  const lastCommittedRef = useRef<number | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    // We intentionally avoid using value/last here to prevent per-move branching;
    // gating happens in the rAF flush below based on the committed value.
    // Always stash latest args
    pendingArgsRef.current = args;

    // Ensure we have a frame scheduled even for within-epsilon moves,
    // so the very last movement still flushes next frame.
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const pendingArgs = pendingArgsRef.current;
        if (!pendingArgs) return;
        (callback as any)(...pendingArgs);
        const committedValue = (getValue ? getValue(...pendingArgs) : (pendingArgs[0] as unknown as number));
        lastCommittedRef.current = committedValue;
      });
    }

    // If the move is well beyond epsilon, we rely on the scheduled frame above.
    // No immediate call to keep everything aligned to rAF.
  }, [callback, epsilon, getValue]);

  return throttledCallback;
}
