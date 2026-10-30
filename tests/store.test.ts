import { describe, it, expect, beforeEach } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { getWallGeometry } from '../src/core/wallMath';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('useFloorplanStore', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('rectangular-room');
  });

  it('loads the rectangular-room preset with exact cm dimensions', () => {
    const state = useFloorplanStore.getState();
    expect(state.corners.length).toBeGreaterThanOrEqual(4);
    expect(state.walls.length).toBeGreaterThanOrEqual(4);
  });

  it('updates a wall length in cm and recalculates endpoint coordinates', () => {
    const state = useFloorplanStore.getState();
    const firstWall = state.walls[0];
    state.updateWallLengthCm(firstWall.id, 520);

    const updated = useFloorplanStore.getState();
    const start = updated.corners.find((c) => c.id === firstWall.startCornerId)!;
    const end = updated.corners.find((c) => c.id === firstWall.endCornerId)!;
    const geom = getWallGeometry(start, end);
    expect(geom.lengthCm).toBeCloseTo(520, 1);
  });

  it('adds custom furniture in cm and computes collision reports automatically', () => {
    const state = useFloorplanStore.getState();
    const firstWall = state.walls[0];
    // Add an oversized wardrobe (600 cm wide on a 450 cm wall)
    const id = state.addFurniture({
      name: 'XXL Schrankwand',
      category: 'storage',
      widthCm: 600,
      heightCm: 220,
      depthCm: 60,
      x: 225,
      z: 37.5,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ef4444',
      snappedWallId: firstWall.id,
    });

    const updated = useFloorplanStore.getState();
    expect(updated.collisionReports[id]).toBeDefined();
    expect(updated.collisionReports[id].hasCollision).toBe(true);
    expect(
      updated.collisionReports[id].issues.some((i) => i.type === 'wall-exceeded')
    ).toBe(true);
  });

  it('exports and imports floorplan JSON state without data loss and rejects malformed JSON safely', () => {
    const state = useFloorplanStore.getState();
    const json = state.exportJson();
    state.loadPreset('empty-room');
    const ok = useFloorplanStore.getState().importJson(json);
    expect(ok).toBe(true);
    expect(useFloorplanStore.getState().furniture.length).toBe(
      state.furniture.length
    );

    const bad = useFloorplanStore.getState().importJson('{invalid-json');
    expect(bad).toBe(false);
  });

  it('snaps furniture to walls during moveFurniture when snapToWallEnabled is true and clears snap when moved away', () => {
    const state = useFloorplanStore.getState();
    state.setSnapToWallEnabled(true);
    const desk = state.furniture[0];

    // Move near top wall w1 (z=0, thickness=15, depth=60 => target z=37.5)
    state.moveFurniture(desk.id, 200, 42);
    const snapped = useFloorplanStore
      .getState()
      .furniture.find((f) => f.id === desk.id)!;
    expect(snapped.snappedWallId).toBe('w1');
    expect(snapped.z).toBeCloseTo(37.5, 1);

    // Move to center of room away from walls
    state.moveFurniture(desk.id, 225, 180);
    const unsnapped = useFloorplanStore
      .getState()
      .furniture.find((f) => f.id === desk.id)!;
    expect(unsnapped.snappedWallId).toBeNull();
    expect(unsnapped.x).toBe(225);
    expect(unsnapped.z).toBe(180);
  });

  it('enforces minimum dimensions on walls, openings, and furniture and does not mutate presets', () => {
    const state = useFloorplanStore.getState();
    const firstWall = state.walls[0];

    state.updateWallProps(firstWall.id, { thicknessCm: 1, heightCm: 10 });
    const updatedWall = useFloorplanStore
      .getState()
      .walls.find((w) => w.id === firstWall.id)!;
    expect(updatedWall.thicknessCm).toBe(5);
    expect(updatedWall.heightCm).toBe(50);

    const opId = state.addOpening({
      wallId: firstWall.id,
      type: 'window',
      offsetFromStartCm: -10,
      widthCm: 0,
      heightCm: -5,
      sillHeightCm: -20,
    });
    const op = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId)!;
    expect(op.widthCm).toBe(1);
    expect(op.heightCm).toBe(1);
    expect(op.offsetFromStartCm).toBe(0);
    expect(op.sillHeightCm).toBe(0);

    state.removeOpening(opId);
    expect(
      useFloorplanStore.getState().openings.find((o) => o.id === opId)
    ).toBeUndefined();

    // Ensure PRESET_FLOORPLANS was not mutated
    expect(
      PRESET_FLOORPLANS['rectangular-room'].data.walls[0].thicknessCm
    ).toBe(15);
  });

  it('updates or clears snappedWallId in updateFurniture when position or rotation is edited manually', () => {
    const state = useFloorplanStore.getState();
    state.setSnapToWallEnabled(true);
    const desk = state.furniture[0];

    // Snap desk to wall w1 first
    state.moveFurniture(desk.id, 200, 37.5);
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === desk.id)!
        .snappedWallId
    ).toBe('w1');

    // Slide along wall w1 via updateFurniture({ x }) -> remains snapped to w1
    state.updateFurniture(desk.id, { x: 240 });
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === desk.id)!
        .snappedWallId
    ).toBe('w1');

    // Rotate via updateFurniture({ rotationYDeg }) -> clears snappedWallId
    state.updateFurniture(desk.id, { rotationYDeg: 45 });
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === desk.id)!
        .snappedWallId
    ).toBeNull();

    // Snap again and move to room center via updateFurniture({ z }) -> clears snappedWallId
    state.moveFurniture(desk.id, 200, 37.5);
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === desk.id)!
        .snappedWallId
    ).toBe('w1');
    state.updateFurniture(desk.id, { z: 180 });
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === desk.id)!
        .snappedWallId
    ).toBeNull();
  });

  it('splits walls at T-junctions when a new wall meets an existing wall mid-span and extracts adjoining rooms', async () => {
    const state = useFloorplanStore.getState();
    // In rectangular-room (450 x 360 cm), add a dividing partition wall from (200, 0) to (200, 360)
    // (200, 0) lands mid-span on top wall w1 (0,0 -> 450,0)
    // (200, 360) lands mid-span on bottom wall w3 (450,360 -> 0,360)
    state.addWallWithCorners({ x: 200, z: 0 }, { x: 200, z: 360 });

    const updated = useFloorplanStore.getState();
    const { computeFloorPolygons } = await import('../src/core/wallMath');
    const rooms = computeFloorPolygons(updated.corners, updated.walls);

    // Both divided halves of the room should be recognized as distinct closed rooms
    expect(rooms.length).toBe(2);
    const sortedAreas = rooms.map((r) => r.areaSqM).sort((a, b) => a - b);
    expect(sortedAreas[0]).toBeCloseTo(7.2, 1); // 200 x 360 cm = 7.2 m²
    expect(sortedAreas[1]).toBeCloseTo(9.0, 1); // 250 x 360 cm = 9.0 m²
  });
});

