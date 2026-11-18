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
import type { FloorplanData, LayoutVariant } from '../types';

export type ErgonomicsWorkerRequest =
  | {
      requestId: number;
      kind: 'evaluate-ergonomics';
      payload: FloorplanData;
    }
  | {
      requestId: number;
      kind: 'compare-variants';
      payload: {
        baseArchitecture: Omit<FloorplanData, 'furniture' | 'rugs'>;
        variants: LayoutVariant[];
      };
    };

export type ErgonomicsWorkerResponse =
  | {
      requestId: number;
      kind: 'evaluate-ergonomics';
      passageReport: PassageClearanceReport;
      ergonomicsScorecard: ErgonomicsScorecardReport;
    }
  | {
      requestId: number;
      kind: 'compare-variants';
      report: VariantComparisonReport;
    }
  | {
      requestId: number;
      kind: 'error';
      message: string;
    };

export function processErgonomicsWorkerRequest(
  req: ErgonomicsWorkerRequest
): ErgonomicsWorkerResponse {
  try {
    if (req.kind === 'evaluate-ergonomics') {
      const data = req.payload;
      const passageReport = evaluatePassageClearances(
        data.furniture,
        data.walls,
        data.corners
      );
      const ergonomicsScorecard = evaluateErgonomicsScorecard(data, passageReport);
      return {
        requestId: req.requestId,
        kind: 'evaluate-ergonomics',
        passageReport,
        ergonomicsScorecard,
      };
    }

    const report = compareLayoutVariants(
      req.payload.baseArchitecture,
      req.payload.variants
    );
    return {
      requestId: req.requestId,
      kind: 'compare-variants',
      report,
    };
  } catch (err) {
    return {
      requestId: req.requestId,
      kind: 'error',
      message: err instanceof Error ? err.message : 'Worker evaluation error',
    };
  }
}
