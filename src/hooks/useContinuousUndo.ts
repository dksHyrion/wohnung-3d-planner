import { useCallback, useRef } from 'react';
import { useFloorplanStore } from '../store/useFloorplanStore';

/**
 * Manages a single undo snapshot per continuous drag/edit interaction
 * (e.g. color pickers and range sliders) so intermediate change events
 * do not flood the undo history.
 */
export function useContinuousUndo() {
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);
  const undoPushedRef = useRef(false);

  const begin = useCallback(() => {
    if (!undoPushedRef.current) {
      pushUndoSnapshot();
      undoPushedRef.current = true;
    }
  }, [pushUndoSnapshot]);

  const end = useCallback(() => {
    undoPushedRef.current = false;
  }, []);

  return {
    begin,
    end,
    handlers: {
      onPointerDown: begin,
      onPointerUp: end,
      onBlur: end,
    },
  };
}
