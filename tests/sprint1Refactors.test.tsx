import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { ConfirmDialog } from '../src/components/layout/ConfirmDialog';
import { TopBar } from '../src/components/layout/TopBar';
import { LevelManagerSection } from '../src/components/sidebar/LevelManagerSection';
import { useActiveLevelEntities } from '../src/hooks/useActiveLevelEntities';
import { useContinuousUndo } from '../src/hooks/useContinuousUndo';

describe('Sprint 1: Shared Hooks, ConfirmDialog & Semantics', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('standard-55');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('ConfirmDialog renders alertdialog when open and nothing when closed', () => {
    const closedHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        isOpen: false,
        title: 'Test Title',
        message: 'Test Message',
        onConfirm: () => {},
        onCancel: () => {},
      })
    );
    expect(closedHtml).toBe('');

    const openHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        isOpen: true,
        title: 'Grundriss zurücksetzen?',
        message: 'Alle Änderungen werden ersetzt.',
        confirmLabel: 'Jetzt zurücksetzen',
        onConfirm: () => {},
        onCancel: () => {},
      })
    );
    expect(openHtml).toContain('role="alertdialog"');
    expect(openHtml).toContain('aria-modal="true"');
    expect(openHtml).toContain('Grundriss zurücksetzen?');
    expect(openHtml).toContain('Jetzt zurücksetzen');
    expect(openHtml).toContain('Abbrechen');
  });

  it('useActiveLevelEntities filters entities strictly to the active level', () => {
    const store = useFloorplanStore.getState();
    const initialWallCount = store.walls.length;
    store.addLevel({ name: 'OG 1', direction: 'above' });

    let capturedWalls = -1;
    let capturedLevelId = '';
    const Probe: React.FC = () => {
      const entities = useActiveLevelEntities();
      capturedWalls = entities.walls.length;
      capturedLevelId = entities.levelId;
      return null;
    };

    ReactDOMServer.renderToStaticMarkup(React.createElement(Probe));
    expect(capturedLevelId).not.toBe('level-0');
    expect(capturedWalls).toBe(0);

    // Switch back to ground floor
    useFloorplanStore.getState().setActiveLevel('level-0');
    ReactDOMServer.renderToStaticMarkup(React.createElement(Probe));
    expect(capturedLevelId).toBe('level-0');
    expect(capturedWalls).toBe(initialWallCount);
  });

  it('useContinuousUndo pushes one snapshot per interaction cycle', () => {
    let api: ReturnType<typeof useContinuousUndo> | null = null;
    const Probe: React.FC = () => {
      api = useContinuousUndo();
      return null;
    };

    ReactDOMServer.renderToStaticMarkup(React.createElement(Probe));
    expect(api).not.toBeNull();

    const startDepth = useFloorplanStore.getState().undoStack.length;
    api!.begin();
    api!.begin();
    api!.begin();
    expect(useFloorplanStore.getState().undoStack.length).toBe(startDepth + 1);

    api!.end();
    api!.begin();
    expect(useFloorplanStore.getState().undoStack.length).toBe(startDepth + 2);
  });

  it('TopBar renders semantic h1 brand heading and LevelManagerSection renders h2', () => {
    const topbarHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(TopBar)
    );
    expect(topbarHtml).toContain('<h1 class="topbar-brand-heading">');

    const levelsHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(LevelManagerSection)
    );
    expect(levelsHtml).toContain('<h2 class="sidebar-title">');
  });
});
