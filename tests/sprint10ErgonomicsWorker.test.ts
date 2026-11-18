import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { processErgonomicsWorkerRequest } from '../src/core/workers/ergonomicsWorkerProtocol';
import {
  createErgonomicsWorkerClient,
  type WorkerLike,
} from '../src/core/workers/ergonomicsWorkerClient';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { ErgonomicsScorecardSection } from '../src/components/sidebar/ErgonomicsScorecardSection';
import type { LayoutVariant } from '../src/core/types';

class MockWorker implements WorkerLike {
  private listeners = new Set<(event: MessageEvent) => void>();
  public posted: unknown[] = [];
  public terminated = false;

  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.delete(listener);
  }

  postMessage(data: unknown): void {
    this.posted.push(data);
  }

  emitMessage(data: unknown): void {
    const event = { data } as MessageEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('Sprint 10A: Ergonomics WebWorker Protocol & Client', () => {
  it('processes evaluate-ergonomics and compare-variants requests accurately', () => {
    const plan = PRESET_FLOORPLANS['standard-55'].data;
    const ergRes = processErgonomicsWorkerRequest({
      requestId: 1,
      kind: 'evaluate-ergonomics',
      payload: plan,
    });
    expect(ergRes.kind).toBe('evaluate-ergonomics');
    if (ergRes.kind === 'evaluate-ergonomics') {
      expect(ergRes.requestId).toBe(1);
      expect(ergRes.ergonomicsScorecard.overallScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(ergRes.passageReport.passages)).toBe(true);
    }

    const variants: LayoutVariant[] = [
      {
        id: 'v-1',
        name: 'Variante A',
        createdAt: '2026-11-18T00:00:00Z',
        furniture: plan.furniture,
        rugs: plan.rugs ?? [],
      },
    ];
    const varRes = processErgonomicsWorkerRequest({
      requestId: 2,
      kind: 'compare-variants',
      payload: {
        baseArchitecture: {
          corners: plan.corners,
          walls: plan.walls,
          openings: plan.openings,
          roomLabels: plan.roomLabels,
          roofSlopes: plan.roofSlopes,
          fixtures: plan.fixtures,
        },
        variants,
      },
    });
    expect(varRes.kind).toBe('compare-variants');
    if (varRes.kind === 'compare-variants') {
      expect(varRes.report.metrics).toHaveLength(1);
      expect(varRes.report.recommendedVariantId).toBe('v-1');
    }
  });

  it('drops stale worker responses when a newer request is dispatched', async () => {
    const mockWorker = new MockWorker();
    const client = createErgonomicsWorkerClient({
      workerFactory: () => mockWorker,
      debounceMs: 0,
    });
    expect(client.isWorkerSupported()).toBe(true);

    const plan = PRESET_FLOORPLANS['standard-55'].data;
    const p1 = client.evaluateErgonomicsAsync(plan, { immediate: true });
    const p2 = client.evaluateErgonomicsAsync(plan, { immediate: true });

    expect(mockWorker.posted).toHaveLength(2);
    const req1 = mockWorker.posted[0] as { requestId: number };
    const req2 = mockWorker.posted[1] as { requestId: number };

    // Reply out of order or reply to req1 after req2 started
    const res1 = processErgonomicsWorkerRequest({
      requestId: req1.requestId,
      kind: 'evaluate-ergonomics',
      payload: plan,
    });
    mockWorker.emitMessage(res1);
    expect(await p1).toBeNull();

    const res2 = processErgonomicsWorkerRequest({
      requestId: req2.requestId,
      kind: 'evaluate-ergonomics',
      payload: plan,
    });
    mockWorker.emitMessage(res2);
    const resolved2 = await p2;
    expect(resolved2).not.toBeNull();
    expect(resolved2!.ergonomicsScorecard.overallScore).toBeGreaterThanOrEqual(0);

    client.dispose();
    expect(mockWorker.terminated).toBe(true);
  });

  it('debounces rapid non-immediate drag updates before posting to worker', async () => {
    vi.useFakeTimers();
    try {
      const mockWorker = new MockWorker();
      const client = createErgonomicsWorkerClient({
        workerFactory: () => mockWorker,
        debounceMs: 80,
      });
      const plan = PRESET_FLOORPLANS['standard-55'].data;

      const p1 = client.evaluateErgonomicsAsync(plan, { immediate: false });
      const p2 = client.evaluateErgonomicsAsync(plan, { immediate: false });
      const p3 = client.evaluateErgonomicsAsync(plan, { immediate: false });

      expect(mockWorker.posted).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(85);

      // Only the final debounced request should have been posted
      expect(mockWorker.posted).toHaveLength(1);
      const req = mockWorker.posted[0] as { requestId: number };
      mockWorker.emitMessage(
        processErgonomicsWorkerRequest({
          requestId: req.requestId,
          kind: 'evaluate-ergonomics',
          payload: plan,
        })
      );

      expect(await p1).toBeNull();
      expect(await p2).toBeNull();
      expect(await p3).not.toBeNull();
      client.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Sprint 10B: Store Sync Fallback & Scorecard Status UI', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('standard-55');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('renders computing status badge in ErgonomicsScorecardSection when isComputingErgonomics is true', () => {
    useFloorplanStore.getState().setShowPassageHeatmap(true);
    useFloorplanStore.setState({ isComputingErgonomics: true });

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ErgonomicsScorecardSection)
    );
    expect(html).toContain('ergonomics-computing-badge');
    useFloorplanStore.setState({ isComputingErgonomics: false });
  });
});
