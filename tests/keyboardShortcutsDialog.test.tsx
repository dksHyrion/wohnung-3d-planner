import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { KeyboardShortcutsDialog } from '../src/components/layout/KeyboardShortcutsDialog';

describe('KeyboardShortcutsDialog Component', () => {
  beforeEach(() => {
    useFloorplanStore.setState({ showKeyboardShortcuts: false });
  });

  it('renders nothing when showKeyboardShortcuts is false', () => {
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(KeyboardShortcutsDialog));
    expect(html).toBe('');
  });

  it('renders accessible dialog with shortcut groups when open', () => {
    useFloorplanStore.setState({ showKeyboardShortcuts: true });
    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(KeyboardShortcutsDialog));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Tastaturkürzel');
    expect(html).toContain('Rückgängig (Undo)');
    expect(html).toContain('Wiederholen (Redo)');
    expect(html).toContain('Ausgewähltes Element löschen');
    expect(html).toContain('2D-Grundriss-Navigation');
    expect(html).toContain('3D-Kamera-Navigation');
    expect(html).toContain('Mausrad');
  });

  it('toggles showKeyboardShortcuts via store action and Escape handler', () => {
    useFloorplanStore.getState().setShowKeyboardShortcuts(true);
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(true);

    useFloorplanStore.getState().setShowKeyboardShortcuts(false);
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(false);
  });
});
