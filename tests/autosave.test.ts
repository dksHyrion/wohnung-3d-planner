import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_DELAY_MS,
  createAutosaveScheduler,
  planContentChanged,
  rememberPristinePlan,
  resetAutosaveRestoreForTests,
  restoreAutosaveForGeneration,
  wouldClobberSavedPlan,
} from '../src/store/autosave';

const slice = {
  corners: 1,
  walls: 1,
  openings: 1,
  furniture: 1,
  rugs: 1,
  roomLabels: 1,
  backgroundImage: 1,
};

describe('Autosave', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetAutosaveRestoreForTests();
  });

  it('erkennt eine Möbeländerung und ignoriert dieselbe Lage', () => {
    expect(planContentChanged(slice, slice)).toBe(false);
    expect(planContentChanged(slice, { ...slice, furniture: 2 })).toBe(true);
  });

  it('schreibt erst nach der Wartezeit und holt eine wartende Änderung beim Flush nach', () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const scheduler = createAutosaveScheduler((json) => {
      saved.push(json);
    });

    scheduler.notify(slice, { ...slice, furniture: 2 }, () => 'plan-2');
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(saved).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(saved).toEqual(['plan-2']);

    scheduler.notify(slice, { ...slice, furniture: 3 }, () => 'plan-3');
    scheduler.flush();
    expect(saved).toEqual(['plan-2', 'plan-3']);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(saved).toEqual(['plan-2', 'plan-3']);
  });

  it('schreibt den verschobenen Plan, auch wenn der offene Plan danach das Beispiel ist', () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    let current = 'verschoben';
    const scheduler = createAutosaveScheduler((json) => {
      saved.push(json);
    });

    scheduler.notify(slice, { ...slice, furniture: 2 }, () => current);
    current = 'beispiel';
    scheduler.flush();
    expect(saved).toEqual(['verschoben']);
  });

  it('lädt den gespeicherten Plan einmal je Speicher-Erzeugung', () => {
    const load = vi.fn(() => true);
    expect(restoreAutosaveForGeneration(1, load)).toBe(true);
    expect(restoreAutosaveForGeneration(1, load)).toBe(false);
    expect(restoreAutosaveForGeneration(2, load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('lässt einen gespeicherten Plan stehen, wenn das Beispiel darüber geschrieben würde', () => {
    rememberPristinePlan('beispiel');
    expect(wouldClobberSavedPlan(null, 'beispiel')).toBe(false);
    expect(wouldClobberSavedPlan('beispiel', 'beispiel')).toBe(false);
    expect(wouldClobberSavedPlan('dein-plan', 'dein-plan')).toBe(false);
    expect(wouldClobberSavedPlan('dein-plan', 'beispiel')).toBe(true);
  });
});
