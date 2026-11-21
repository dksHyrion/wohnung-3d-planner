import type { Point2D } from '../types';
import type { PassageSeverity } from '../ergonomicsEngine';

export type DeliveryStatus = 'fits' | 'tilted-fit' | 'blocked';
export type ScorecardGrade = 'A' | 'B' | 'C' | 'D';

export interface FurnitureDeliveryCheck {
  furnitureId: string;
  furnitureName: string;
  status: DeliveryStatus;
  minDoorWidthCm: number | null;
  bottleneckCm: number | null;
}

export interface ChairPullbackIssue {
  furnitureId: string;
  furnitureName: string;
  availableCm: number;
  recommendedCm: number;
  severity: PassageSeverity;
}

export interface FoldOpenDiffItem {
  furnitureId: string;
  furnitureName: string;
  currentPose: 'closed' | 'open';
  simulatedPose: 'open' | 'closed';
  introducesCollisions: boolean;
  newIssueMessages: string[];
}

export interface RoomScorecard {
  roomId: string;
  roomName: string;
  netAreaSqM: number;
  occupiedPercent: number;
  freeFloorPercent: number;
  reachableFromEntrance: boolean;
  hasTurningCircle150: boolean;
  maxTurningDiameterCm: number;
  turningCircleCenter: Point2D | null;
  minClearanceCm: number | null;
  criticalCount: number;
  warningCount: number;
  score: number;
  grade: ScorecardGrade;
}

export interface ErgonomicsScorecardReport {
  overallScore: number;
  overallGrade: ScorecardGrade;
  rooms: RoomScorecard[];
  unreachableFurnitureIds: string[];
  deliveryChecks: FurnitureDeliveryCheck[];
  chairPullbackIssues: ChairPullbackIssue[];
  foldOpenDiffs: FoldOpenDiffItem[];
  hasEntranceSeed: boolean;
}

export const TURNING_CIRCLE_DIAMETER_CM = 150;
export const CHAIR_PULLBACK_RECOMMENDED_CM = 80;
export const CHAIR_PULLBACK_CRITICAL_CM = 55;
/** Minimum center-to-obstacle-surface half-width for a 60 cm DIN 18040 person corridor (with 5 cm raster slack). */
export const MIN_WALK_HALF_WIDTH_CM = 27.5;

