import { describe, it, expect, beforeEach } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

describe('Keyboard Shortcuts Store State', () => {
  beforeEach(() => {
    useFloorplanStore.setState({ showKeyboardShortcuts: false });
  });

  it('initializes showKeyboardShortcuts as false', () => {
    const state = useFloorplanStore.getState();
    expect(state.showKeyboardShortcuts).toBe(false);
  });

  it('toggles showKeyboardShortcuts via setShowKeyboardShortcuts', () => {
    useFloorplanStore.getState().setShowKeyboardShortcuts(true);
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(true);

    useFloorplanStore.getState().setShowKeyboardShortcuts(false);
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(false);
  });

  it('toggles showKeyboardShortcuts via toggleKeyboardShortcuts', () => {
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(false);

    useFloorplanStore.getState().toggleKeyboardShortcuts();
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(true);

    useFloorplanStore.getState().toggleKeyboardShortcuts();
    expect(useFloorplanStore.getState().showKeyboardShortcuts).toBe(false);
  });
});
