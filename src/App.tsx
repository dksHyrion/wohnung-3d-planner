import React, { useEffect, useLayoutEffect } from 'react';
import { floorplanStoreGeneration, useFloorplanStore } from './store/useFloorplanStore';
import { createAutosaveScheduler, restoreAutosaveForGeneration } from './store/autosave';
import { adoptPlanFileIfBrowserHasOnlyExample } from './store/planFile';
import { TopBar } from './components/layout/TopBar';
import { FloorplanCanvas2D } from './components/editor2d/FloorplanCanvas2D';
import { Scene3D } from './components/viewer3d/Scene3D';
import { InspectorSidebar } from './components/sidebar/InspectorSidebar';

export const App: React.FC = () => {
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const undo = useFloorplanStore((s) => s.undo);
  const redo = useFloorplanStore((s) => s.redo);
  const saveToLocalStorage = useFloorplanStore((s) => s.saveToLocalStorage);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useFloorplanStore.getState();
        if (!state.selectedId || !state.selectedType) return;
        e.preventDefault();
        if (state.selectedType === 'furniture') {
          state.removeFurniture(state.selectedId);
        } else if (state.selectedType === 'opening') {
          state.removeOpening(state.selectedId);
        } else if (state.selectedType === 'wall') {
          state.removeWall(state.selectedId);
        } else if (state.selectedType === 'corner') {
          state.removeCorner(state.selectedId);
        } else if (state.selectedType === 'rug') {
          state.removeRug(state.selectedId);
        }
      } else if (e.key === 'Escape') {
        const state = useFloorplanStore.getState();
        if (state.activeTool !== 'calibrate-scale') {
          if (state.activeTool !== 'select') {
            state.setActiveTool('select');
          } else if (state.selectedId) {
            state.selectEntity(null, null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useLayoutEffect(() => {
    restoreAutosaveForGeneration(floorplanStoreGeneration, () =>
      useFloorplanStore.getState().loadFromLocalStorage()
    );
    void adoptPlanFileIfBrowserHasOnlyExample({
      exportJson: () => useFloorplanStore.getState().exportJson(),
      importJson: (json) => useFloorplanStore.getState().importJson(json),
      save: (json) => useFloorplanStore.getState().saveToLocalStorage(json),
    });
    const scheduler = createAutosaveScheduler((json) => {
      useFloorplanStore.getState().saveToLocalStorage(json);
    });
    const unsub = useFloorplanStore.subscribe((state, prev) => {
      scheduler.notify(prev, state, () => useFloorplanStore.getState().exportJson());
    });
    const writePlan = () => {
      scheduler.flush();
      saveToLocalStorage();
    };
    const handleHide = () => {
      if (document.visibilityState === 'hidden') writePlan();
    };
    window.addEventListener('beforeunload', writePlan);
    document.addEventListener('visibilitychange', handleHide);
    return () => {
      unsub();
      scheduler.flush();
      window.removeEventListener('beforeunload', writePlan);
      document.removeEventListener('visibilitychange', handleHide);
    };
  }, [saveToLocalStorage]);

  const show2D = viewMode === '2d' || viewMode === 'split';
  const show3D =
    viewMode === 'split' || viewMode === '3d-iso' || viewMode === '3d-persp';

  return (
    <div className="app-shell">
      <TopBar />
      <main className="workspace-main">
        <div className="viewports-area">
          {show2D && (
            <div className="viewport-pane">
              <FloorplanCanvas2D />
            </div>
          )}
          {show3D && (
            <div className="viewport-pane">
              <Scene3D />
            </div>
          )}
        </div>
        <InspectorSidebar />
      </main>
    </div>
  );
};

export default App;
