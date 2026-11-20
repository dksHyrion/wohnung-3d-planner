import {
  evaluateErgonomicsScorecard,
  evaluatePassageClearances,
  type PassageClearanceReport,
} from '../ergonomicsEngine';
import type { ErgonomicsScorecardReport } from '../ergonomicsScorecard';
import {
  compareLayoutVariants,
  type VariantComparisonReport,
} from '../layoutVariants';
import {
  DEFAULT_LEVEL_ID,
  normalizeLevels,
  scopeFloorplanToLevel,
} from '../levels';
import type { FloorplanData, LayoutVariant } from '../types';
import type {
  ErgonomicsWorkerRequest,
  ErgonomicsWorkerResponse,
} from './ergonomicsWorkerProtocol';

export interface WorkerLike {
  postMessage: (data: unknown) => void;
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent) => void
  ) => void;
  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent) => void
  ) => void;
  terminate: () => void;
}

export interface ErgonomicsEvalResult {
  passageReport: PassageClearanceReport;
  ergonomicsScorecard: ErgonomicsScorecardReport;
}

export interface ErgonomicsWorkerClientOptions {
  workerFactory?: () => WorkerLike;
  debounceMs?: number;
}

export interface ErgonomicsWorkerClient {
  isWorkerSupported: () => boolean;
  evaluateErgonomicsAsync: (
    data: FloorplanData,
    options?: { immediate?: boolean; levelId?: string }
  ) => Promise<ErgonomicsEvalResult | null>;
  compareVariantsAsync: (
    baseArchitecture: Omit<FloorplanData, 'furniture' | 'rugs'>,
    variants: LayoutVariant[]
  ) => Promise<VariantComparisonReport | null>;
  cancelPending: () => void;
  dispose: () => void;
}

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('./ergonomicsWorker.ts', import.meta.url), {
    type: 'module',
  });
}

export function createErgonomicsWorkerClient(
  options: ErgonomicsWorkerClientOptions = {}
): ErgonomicsWorkerClient {
  const debounceMs = options.debounceMs ?? 80;
  const hasCustomFactory = typeof options.workerFactory === 'function';
  const isWorkerSupported = () =>
    hasCustomFactory || typeof Worker !== 'undefined';

  let worker: WorkerLike | null = null;
  let nextRequestId = 1;
  let latestErgonomicsId = 0;
  let latestVariantsId = 0;
  let ergonomicsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const pendingResolvers = new Map<
    number,
    {
      kind: 'evaluate-ergonomics' | 'compare-variants';
      resolve: (val: unknown) => void;
    }
  >();

  const handleWorkerMessage = (event: MessageEvent<ErgonomicsWorkerResponse>) => {
    const res = event.data;
    if (!res || typeof res.requestId !== 'number') return;
    const entry = pendingResolvers.get(res.requestId);
    if (!entry) return;
    pendingResolvers.delete(res.requestId);

    if (res.kind === 'error') {
      entry.resolve(null);
      return;
    }

    if (res.kind === 'evaluate-ergonomics') {
      if (res.requestId !== latestErgonomicsId) {
        entry.resolve(null);
        return;
      }
      entry.resolve({
        passageReport: res.passageReport,
        ergonomicsScorecard: res.ergonomicsScorecard,
      });
      return;
    }

    if (res.kind === 'compare-variants') {
      if (res.requestId !== latestVariantsId) {
        entry.resolve(null);
        return;
      }
      entry.resolve(res.report);
    }
  };

  const ensureWorker = (): WorkerLike => {
    if (!worker) {
      const factory = options.workerFactory ?? defaultWorkerFactory;
      worker = factory();
      worker.addEventListener('message', handleWorkerMessage);
    }
    return worker;
  };

  const clearDebounce = () => {
    if (ergonomicsDebounceTimer !== null) {
      clearTimeout(ergonomicsDebounceTimer);
      ergonomicsDebounceTimer = null;
    }
  };

  const supersedePendingByKind = (
    kind: 'evaluate-ergonomics' | 'compare-variants'
  ) => {
    for (const [id, entry] of pendingResolvers) {
      if (entry.kind === kind) {
        pendingResolvers.delete(id);
        entry.resolve(null);
      }
    }
  };

  return {
    isWorkerSupported,

    evaluateErgonomicsAsync: (data, opts) => {
      if (!isWorkerSupported()) {
        const levels = normalizeLevels(data.levels);
        const targetLevelId =
          opts?.levelId ??
          levels.find((l) => l.index === 0)?.id ??
          levels[0]?.id ??
          DEFAULT_LEVEL_ID;
        const scoped =
          opts?.levelId || levels.length > 1
            ? scopeFloorplanToLevel(data, targetLevelId)
            : data;
        const passageReport = evaluatePassageClearances(
          scoped.furniture,
          scoped.walls,
          scoped.corners
        );
        const ergonomicsScorecard = evaluateErgonomicsScorecard(
          data,
          passageReport,
          { levelId: targetLevelId }
        );
        return Promise.resolve({ passageReport, ergonomicsScorecard });
      }

      const requestId = nextRequestId++;
      latestErgonomicsId = requestId;
      clearDebounce();
      supersedePendingByKind('evaluate-ergonomics');

      const dispatch = (resolve: (val: ErgonomicsEvalResult | null) => void) => {
        if (requestId !== latestErgonomicsId) {
          resolve(null);
          return;
        }
        pendingResolvers.set(requestId, {
          kind: 'evaluate-ergonomics',
          resolve: resolve as (val: unknown) => void,
        });
        const req: ErgonomicsWorkerRequest = {
          requestId,
          kind: 'evaluate-ergonomics',
          payload: data,
          ...(opts?.levelId ? { levelId: opts.levelId } : {}),
        };
        ensureWorker().postMessage(req);
      };

      if (opts?.immediate || debounceMs <= 0) {
        return new Promise((resolve) => dispatch(resolve));
      }

      return new Promise((resolve) => {
        pendingResolvers.set(requestId, {
          kind: 'evaluate-ergonomics',
          resolve: resolve as (val: unknown) => void,
        });
        ergonomicsDebounceTimer = setTimeout(() => {
          ergonomicsDebounceTimer = null;
          if (!pendingResolvers.has(requestId) || requestId !== latestErgonomicsId) {
            pendingResolvers.delete(requestId);
            resolve(null);
            return;
          }
          const req: ErgonomicsWorkerRequest = {
            requestId,
            kind: 'evaluate-ergonomics',
            payload: data,
            ...(opts?.levelId ? { levelId: opts.levelId } : {}),
          };
          ensureWorker().postMessage(req);
        }, debounceMs);
      });
    },

    compareVariantsAsync: (baseArchitecture, variants) => {
      if (!isWorkerSupported()) {
        return Promise.resolve(compareLayoutVariants(baseArchitecture, variants));
      }
      const requestId = nextRequestId++;
      latestVariantsId = requestId;
      supersedePendingByKind('compare-variants');

      return new Promise((resolve) => {
        pendingResolvers.set(requestId, {
          kind: 'compare-variants',
          resolve: resolve as (val: unknown) => void,
        });
        const req: ErgonomicsWorkerRequest = {
          requestId,
          kind: 'compare-variants',
          payload: { baseArchitecture, variants },
        };
        ensureWorker().postMessage(req);
      });
    },

    cancelPending: () => {
      latestErgonomicsId = nextRequestId++;
      clearDebounce();
      supersedePendingByKind('evaluate-ergonomics');
    },

    dispose: () => {
      clearDebounce();
      for (const [, entry] of pendingResolvers) {
        entry.resolve(null);
      }
      pendingResolvers.clear();
      if (worker) {
        worker.removeEventListener('message', handleWorkerMessage);
        worker.terminate();
        worker = null;
      }
    },
  };
}

export const sharedErgonomicsWorkerClient = createErgonomicsWorkerClient();
