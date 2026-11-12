/**
 * Collapses high-frequency pointer moves into at most one store commit per animation frame.
 * Only the latest scheduled callback runs. Without requestAnimationFrame (SSR, tests) it runs
 * immediately.
 */
export interface FrameThrottle {
  schedule: (fn: () => void) => void;
  /** Runs a pending callback now, e.g. on pointer up so the final position is committed. */
  flush: () => void;
}

export function createFrameThrottle(): FrameThrottle {
  let pending: (() => void) | null = null;
  let handle: number | null = null;

  const run = () => {
    handle = null;
    const fn = pending;
    pending = null;
    fn?.();
  };

  return {
    schedule(fn) {
      if (typeof requestAnimationFrame !== 'function') {
        fn();
        return;
      }
      pending = fn;
      if (handle === null) handle = requestAnimationFrame(run);
    },
    flush() {
      if (handle === null) return;
      cancelAnimationFrame(handle);
      run();
    },
  };
}
