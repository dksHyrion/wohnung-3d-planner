export type FurniturePose = 'closed' | 'open';

export interface FurniturePoseSpec {
  widthCm: number;
  heightCm: number;
  depthCm: number;
  /** false: die Höhe ist aus dem anderen Zustand übernommen, nicht neu gemessen. */
  heightMeasured: boolean;
}

/** BoConcept Osaka Schlafcouch. Aufgeklappt ist nur die Liegefläche 170×200 bekannt. */
export const OSAKA_POSES: Record<FurniturePose, FurniturePoseSpec> = {
  closed: { widthCm: 190, heightCm: 90, depthCm: 95, heightMeasured: true },
  open: { widthCm: 170, heightCm: 90, depthCm: 200, heightMeasured: false },
};

/** Inwerk Masterlift 2, Sitzhöhe laut Hersteller. Die gezeigte Ausgangshöhe bleibt 73 cm. */
export const MASTERLIFT_HEIGHT = {
  minCm: 62.5,
  maxCm: 127.5,
  defaultCm: 73,
};

export function clampMasterliftHeightCm(heightCm: number): number {
  return Math.min(MASTERLIFT_HEIGHT.maxCm, Math.max(MASTERLIFT_HEIGHT.minCm, heightCm));
}
