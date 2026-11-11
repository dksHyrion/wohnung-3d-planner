import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFloorplanStore, type Language } from '../src/store/useFloorplanStore';
import { getGlobalLanguage, setGlobalLanguage } from '../src/i18n/i18n';

describe('Zustand Store i18n Integration', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    });
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage('de');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('defaults language to de in initial store state', () => {
    const state = useFloorplanStore.getState();
    expect(state.language).toBe('de');
  });

  it('updates store, localStorage, and getGlobalLanguage when setLanguage is called with en', () => {
    const lang: Language = 'en';
    useFloorplanStore.getState().setLanguage(lang);

    expect(useFloorplanStore.getState().language).toBe('en');
    expect(localStorage.getItem('wohnung-3d-planner-lang')).toBe('en');
    expect(getGlobalLanguage()).toBe('en');
  });

  it('switches back to de and updates store, localStorage, and getGlobalLanguage', () => {
    useFloorplanStore.getState().setLanguage('en');
    expect(useFloorplanStore.getState().language).toBe('en');

    useFloorplanStore.getState().setLanguage('de');
    expect(useFloorplanStore.getState().language).toBe('de');
    expect(localStorage.getItem('wohnung-3d-planner-lang')).toBe('de');
    expect(getGlobalLanguage()).toBe('de');
  });

  it('synchronizes store state when global language is updated externally', () => {
    setGlobalLanguage('en');
    expect(useFloorplanStore.getState().language).toBe('en');

    setGlobalLanguage('de');
    expect(useFloorplanStore.getState().language).toBe('de');
  });
});
