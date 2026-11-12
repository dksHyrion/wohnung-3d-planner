import { OpeningType, WallOpening } from './types';

export const OPENING_TYPES: readonly OpeningType[] = ['door', 'sliding-door', 'passage', 'balcony-door', 'window'];

export function openingHasSwingArc(type: OpeningType): boolean {
  return type === 'door' || type === 'balcony-door';
}

export function openingLetsLightThrough(type: OpeningType): boolean {
  return type === 'window' || type === 'balcony-door';
}

export function openingIsWalkthrough(type: OpeningType): boolean {
  return type !== 'window';
}

/** Dicke des Türblatts in der 2D-Ansicht und im 3D-Modell. */
export const DOOR_LEAF_THICKNESS_CM = 4;

/**
 * Das Blatt steht im 3D-Bild so weit offen, dass Fläche und Öffnung
 * gleichzeitig lesbar sind. Der Grundriss bleibt beim 90°-Symbol.
 */
export const DOOR_LEAF_OPEN_RAD = (72 * Math.PI) / 180;

export function doorSwingsInward(
  swing: WallOpening['swingDirection'] | undefined
): boolean {
  return swing !== 'out-left' && swing !== 'out-right';
}

export function doorHingeOnRight(
  swing: WallOpening['swingDirection'] | undefined
): boolean {
  return swing === 'in-right' || swing === 'out-right';
}

export interface DoorLeafPose {
  hingeX: number;
  rotationYRad: number;
  leafWidthCm: number;
  leafHeightCm: number;
  /** Mitte des Blatts in der Bandgruppe, entlang der Wand, bei geschlossenem Blatt. */
  leafCenterX: number;
  leafCenterY: number;
}

/**
 * Lage des Türblatts im Wandkoordinatensystem.
 * X läuft von der Wandmitte zum Wandende, Y nach oben, Z entlang der Wandnormalen.
 * Eine positive Drehung um Y schwenkt die lokale +X-Achse nach -Z.
 */
export function doorLeafPose(
  opening: WallOpening,
  wallLengthCm: number
): DoorLeafPose {
  const hingeOnRight = doorHingeOnRight(opening.swingDirection);
  const inward = doorSwingsInward(opening.swingDirection);
  const openingStart = -wallLengthCm / 2 + opening.offsetFromStartCm;
  const hingeX = hingeOnRight
    ? openingStart + opening.widthCm
    : openingStart;
  const leafWidthCm = Math.max(20, opening.widthCm - 1.2);
  const leafHeightCm = Math.max(40, opening.heightCm - 1.2);
  const swingSign = inward ? 1 : -1;
  const rotationYRad = (hingeOnRight ? 1 : -1) * swingSign * DOOR_LEAF_OPEN_RAD;

  return {
    hingeX,
    rotationYRad,
    leafWidthCm,
    leafHeightCm,
    leafCenterX: hingeOnRight ? -leafWidthCm / 2 : leafWidthCm / 2,
    leafCenterY: opening.sillHeightCm + opening.heightCm / 2,
  };
}

/** Bogen der offenen Tür auf dem Boden, vom geschlossenen Ende bis zum Blatt. */
export function doorSwingArcPoints(
  opening: WallOpening,
  wallLengthCm: number,
  steps = 8
): { x: number; z: number }[] {
  const pose = doorLeafPose(opening, wallLengthCm);
  const hingeOnRight = doorHingeOnRight(opening.swingDirection);
  const along = hingeOnRight ? -1 : 1;
  const swingSign = doorSwingsInward(opening.swingDirection) ? 1 : -1;
  const radius = pose.leafWidthCm;
  const safeSteps = Math.max(1, steps);
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i <= safeSteps; i++) {
    const t = (i / safeSteps) * DOOR_LEAF_OPEN_RAD;
    points.push({
      x: pose.hingeX + along * Math.cos(t) * radius,
      z: swingSign * Math.sin(t) * radius,
    });
  }
  return points;
}

export interface DoorSwingFloorSegment {
  x: number;
  z: number;
  lengthCm: number;
  rotationYRad: number;
}

/** Schmale Bodenlinie. Die Box liegt mit ihrer Länge auf der lokalen +X-Achse. */
export function doorSwingFloorSegments(
  opening: WallOpening,
  wallLengthCm: number,
  steps = 8
): DoorSwingFloorSegment[] {
  const points = doorSwingArcPoints(opening, wallLengthCm, steps);
  const segments: DoorSwingFloorSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthCm = Math.hypot(dx, dz);
    if (lengthCm < 0.05) continue;
    segments.push({
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
      lengthCm,
      rotationYRad: Math.atan2(-dz, dx),
    });
  }
  return segments;
}

/** Gefülltes Türblatt im Grundriss, 4 cm dick, vom Band bis zum offenen Ende. */
export function doorLeafPlanPoints(
  hingeX: number,
  hingeZ: number,
  leafEndX: number,
  leafEndZ: number,
  tangentX: number,
  tangentZ: number,
  thicknessCm = DOOR_LEAF_THICKNESS_CM
): string {
  const half = thicknessCm / 2;
  const px = tangentX * half;
  const pz = tangentZ * half;
  return [
    `${hingeX + px},${hingeZ + pz}`,
    `${hingeX - px},${hingeZ - pz}`,
    `${leafEndX - px},${leafEndZ - pz}`,
    `${leafEndX + px},${leafEndZ + pz}`,
  ].join(' ');
}
