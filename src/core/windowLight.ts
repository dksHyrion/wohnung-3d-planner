/** Wie weit der Lichtfleck vom Fenster in den Raum reicht. */
export const WINDOW_LIGHT_POOL_DEPTH_CM = 140;

/**
 * Sichtbarkeit des Flecks. Bei Nacht (Intensität 0,5) bleibt er fast unsichtbar,
 * am Morgen (2,5) liegt er ruhig auf dem Boden, in der Goldenen Stunde ist er am deutlichsten.
 */
export function windowLightPoolOpacity(intensity: number): number {
  if (!Number.isFinite(intensity) || intensity <= 0) return 0;
  return Math.min(0.28, (intensity / 4) * 0.28);
}

export function windowLightPoolCenter(args: {
  offsetFromStartCm: number;
  widthCm: number;
  wallLengthCm: number;
  wallThicknessCm: number;
  inwardSign: 1 | -1;
  depthCm?: number;
}): { x: number; z: number; widthCm: number; depthCm: number } {
  const depthCm = args.depthCm ?? WINDOW_LIGHT_POOL_DEPTH_CM;
  const widthCm = Math.max(20, args.widthCm * 0.9);
  const x = args.offsetFromStartCm + args.widthCm / 2 - args.wallLengthCm / 2;
  const z = args.inwardSign * (args.wallThicknessCm / 2 + 4 + depthCm / 2);
  return { x, z, widthCm, depthCm };
}

/**
 * Drehung der Bodenebene. Die helle Texturkante ist die lokale +Y der Ebene.
 * Nach einer Drehung um X um −90° zeigt diese Kante nach −Z und die Normale nach oben.
 * Zeigt der Raum nach −Z, dreht eine weitere halbe Drehung um Z die Kante zur Wand.
 * Eine negative Skalierung würde die Fläche von oben unsichtbar machen.
 */
export function windowLightPoolRotation(inwardSign: 1 | -1): [number, number, number] {
  return inwardSign === 1 ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI];
}
