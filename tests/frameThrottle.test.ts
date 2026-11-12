import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFrameThrottle } from '../src/core/frameThrottle';

describe('createFrameThrottle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs only the latest callback once per frame', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const throttle = createFrameThrottle();
    const calls: number[] = [];
    throttle.schedule(() => calls.push(1));
    throttle.schedule(() => calls.push(2));
    throttle.schedule(() => calls.push(3));
    expect(frames).toHaveLength(1);
    expect(calls).toEqual([]);
    frames[0](0);
    expect(calls).toEqual([3]);
  });

  it('flush commits the pending callback immediately', () => {
    vi.stubGlobal('requestAnimationFrame', () => 7);
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const throttle = createFrameThrottle();
    const calls: number[] = [];
    throttle.schedule(() => calls.push(1));
    throttle.flush();
    expect(calls).toEqual([1]);
    expect(cancel).toHaveBeenCalledWith(7);
    throttle.flush();
    expect(calls).toEqual([1]);
  });

  it('runs synchronously without requestAnimationFrame', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const throttle = createFrameThrottle();
    const calls: number[] = [];
    throttle.schedule(() => calls.push(1));
    expect(calls).toEqual([1]);
  });
});
