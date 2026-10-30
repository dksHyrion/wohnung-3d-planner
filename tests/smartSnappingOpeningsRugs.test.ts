import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import {
  computeFurnitureAlignment,
  getFurnitureWorldBoundsXZ,
} from '../src/core/alignmentMath';
import {
  OPENING_TYPE_LABELS,
  openingHasSwingArc,
  openingLetsLightThrough,
  openingIsWalkthrough,
} from '../src/core/doorLeaf';
import {
  computeDoorSwingSector,
  evaluateFloorplanCollisions,
} from '../src/core/collisionEngine';
import { checkWallFitCm } from '../src/core/wallMath';
import { computeDominantWindowDirection } from '../src/components/viewer3d/StudioStage3D';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { OpeningInspector } from '../src/components/sidebar/OpeningInspector';
import { RugInspector } from '../src/components/sidebar/RugInspector';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { Corner, Wall, FurnitureItem, WallOpening } from '../src/core/types';

describe('Paket 3C & 3D: Smart Alignment Snapping, Erweiterte Wandöffnungen & Teppich-Editor', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('rectangular-room');
    useFloorplanStore.getState().setSnapToWallEnabled(true);
  });

  describe('3C: Smart Alignment Guides & Kante-an-Kante Möbel-Snapping', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 500, z: 0 },
      { id: 'c3', x: 500, z: 400 },
      { id: 'c4', x: 0, z: 400 },
    ];
    const walls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ];

    it('computes oriented XZ world bounds accurately for 0° and 90° rotated furniture', () => {
      const baseItem: FurnitureItem = {
        id: 'f1',
        name: 'Schrank',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 200,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };
      const b0 = getFurnitureWorldBoundsXZ(baseItem);
      expect(b0.minX).toBeCloseTo(150);
      expect(b0.maxX).toBeCloseTo(250);
      expect(b0.minZ).toBeCloseTo(70);
      expect(b0.maxZ).toBeCloseTo(130);

      const b90 = getFurnitureWorldBoundsXZ({ ...baseItem, rotationYDeg: 90 });
      expect(b90.minX).toBeCloseTo(170);
      expect(b90.maxX).toBeCloseTo(230);
      expect(b90.minZ).toBeCloseTo(50);
      expect(b90.maxZ).toBeCloseTo(150);
    });

    it('snaps two cabinets on the same wall flush edge-to-edge (0 cm gap) and emits a flush guide', () => {
      const cabinetA: FurnitureItem = {
        id: 'cab-a',
        name: 'PAX Links',
        category: 'storage',
        widthCm: 100,
        heightCm: 236,
        depthCm: 60,
        x: 100, // occupies [50, 150] along wall w1
        z: 37.5,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f4f1ea',
        snappedWallId: 'w1',
      };
      const cabinetB: FurnitureItem = {
        id: 'cab-b',
        name: 'PAX Rechts',
        category: 'storage',
        widthCm: 100,
        heightCm: 236,
        depthCm: 60,
        x: 205, // left edge at 155 -> 5 cm away from cab-a right edge (150)
        z: 37.5,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f4f1ea',
        snappedWallId: 'w1',
      };

      const res = computeFurnitureAlignment(
        cabinetB,
        [cabinetA, cabinetB],
        corners,
        walls,
        8
      );
      // Should snap x to 200 so cab-b occupies [150, 250] (0 cm gap to cab-a [50, 150])
      expect(res.x).toBeCloseTo(200, 1);
      expect(res.z).toBeCloseTo(37.5, 1);
      expect(res.guides.length).toBeGreaterThan(0);
      expect(res.guides[0].kind).toBe('flush');
      expect(res.guides[0].targetFurnitureId).toBe('cab-a');
    });

    it('snaps a free-standing coffee table to the center axis and edge of a sofa in the room', () => {
      const sofa: FurnitureItem = {
        id: 'sofa-1',
        name: 'Osaka Sofa',
        category: 'living',
        widthCm: 200,
        heightCm: 85,
        depthCm: 90,
        x: 250, // centerX = 250, minX = 150, maxX = 350
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#333333',
      };
      const table: FurnitureItem = {
        id: 'table-1',
        name: 'Couchtisch',
        category: 'living',
        widthCm: 100,
        heightCm: 42,
        depthCm: 60,
        x: 254, // 4 cm off sofa centerX (250)
        z: 210,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#cccccc',
        snappedWallId: null,
      };

      const res = computeFurnitureAlignment(
        table,
        [sofa, table],
        corners,
        walls,
        8
      );
      expect(res.x).toBeCloseTo(250, 1);
      expect(res.guides.some((g) => g.kind === 'center' && g.targetFurnitureId === 'sofa-1')).toBe(true);
    });

    it('populates activeAlignmentGuides during moveFurniture and clears them via clearAlignmentGuides', () => {
      const state = useFloorplanStore.getState();
      // In rectangular-room: f-rect-wardrobe is at x=130, width=200 (right edge = 230) on w1
      // f-rect-desk has width=140 (halfW = 70) on w1. Flush right of wardrobe => x = 230 + 70 = 300.
      state.moveFurniture('f-rect-desk', 304, 38, { recordHistory: false });

      const afterMove = useFloorplanStore.getState();
      const movedDesk = afterMove.furniture.find((f) => f.id === 'f-rect-desk')!;
      expect(movedDesk.x).toBeCloseTo(300, 1);
      expect(afterMove.activeAlignmentGuides.length).toBeGreaterThan(0);

      afterMove.clearAlignmentGuides();
      expect(useFloorplanStore.getState().activeAlignmentGuides).toEqual([]);
    });
  });

  describe('3D-A: Erweiterte Wandöffnungen (sliding-door, passage, balcony-door)', () => {
    it('classifies swing arc, light transmission, and walkthrough properties correctly', () => {
      expect(openingHasSwingArc('door')).toBe(true);
      expect(openingHasSwingArc('balcony-door')).toBe(true);
      expect(openingHasSwingArc('sliding-door')).toBe(false);
      expect(openingHasSwingArc('passage')).toBe(false);
      expect(openingHasSwingArc('window')).toBe(false);

      expect(openingLetsLightThrough('window')).toBe(true);
      expect(openingLetsLightThrough('balcony-door')).toBe(true);
      expect(openingLetsLightThrough('door')).toBe(false);
      expect(openingLetsLightThrough('sliding-door')).toBe(false);
      expect(openingLetsLightThrough('passage')).toBe(false);

      expect(openingIsWalkthrough('door')).toBe(true);
      expect(openingIsWalkthrough('sliding-door')).toBe(true);
      expect(openingIsWalkthrough('passage')).toBe(true);
      expect(openingIsWalkthrough('balcony-door')).toBe(true);
      expect(openingIsWalkthrough('window')).toBe(false);

      expect(OPENING_TYPE_LABELS['sliding-door']).toContain('Schiebetür');
      expect(OPENING_TYPE_LABELS['passage']).toContain('Wanddurchbruch');
      expect(OPENING_TYPE_LABELS['balcony-door']).toContain('Balkon');
    });

    it('eliminates 90° door swing collisions for sliding-door and passage while still guarding the wall opening itself', () => {
      const state = useFloorplanStore.getState();
      const door = state.openings.find((o) => o.type === 'door')!;
      const wall = state.walls.find((w) => w.id === door.wallId)!;
      const start = state.corners.find((c) => c.id === wall.startCornerId)!;
      const end = state.corners.find((c) => c.id === wall.endCornerId)!;

      // Standard door has a swing sector
      expect(computeDoorSwingSector(start, end, wall, door)).not.toBeNull();
      // Balcony door also has a swing sector
      expect(
        computeDoorSwingSector(start, end, wall, { ...door, type: 'balcony-door' })
      ).not.toBeNull();
      // Sliding door and passage have NO swing sector
      expect(
        computeDoorSwingSector(start, end, wall, { ...door, type: 'sliding-door' })
      ).toBeNull();
      expect(
        computeDoorSwingSector(start, end, wall, { ...door, type: 'passage' })
      ).toBeNull();

      // Placing a furniture item in the swing zone in front of w3 door
      // w3 goes from c3(450, 360) to c4(0, 360), offset 280..366 -> x around 127, z around 310
      const chairInFrontOfDoor: FurnitureItem = {
        id: 'chair-front',
        name: 'Sessel vor Öffnung',
        category: 'living',
        widthCm: 65,
        heightCm: 80,
        depthCm: 65,
        x: 127,
        z: 310,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#888888',
      };

      const collisionsWithSwingDoor = evaluateFloorplanCollisions({
        corners: state.corners,
        walls: state.walls,
        openings: [door],
        furniture: [chairInFrontOfDoor],
      });
      expect(collisionsWithSwingDoor['chair-front'].hasCollision).toBe(true);

      const collisionsWithSlidingDoor = evaluateFloorplanCollisions({
        corners: state.corners,
        walls: state.walls,
        openings: [{ ...door, type: 'sliding-door' }],
        furniture: [chairInFrontOfDoor],
      });
      expect(collisionsWithSlidingDoor['chair-front'].hasCollision).toBe(false);

      const collisionsWithPassage = evaluateFloorplanCollisions({
        corners: state.corners,
        walls: state.walls,
        openings: [{ ...door, type: 'passage' }],
        furniture: [chairInFrontOfDoor],
      });
      expect(collisionsWithPassage['chair-front'].hasCollision).toBe(false);

      // However, a cabinet snapped directly onto wall w3 across the sliding-door opening IS reported!
      const blockingCabinet: FurnitureItem = {
        ...chairInFrontOfDoor,
        x: 127,
        z: 322.5,
        snappedWallId: wall.id,
      };
      const wallFit = checkWallFitCm(
        start,
        end,
        wall,
        [{ ...door, type: 'sliding-door' }],
        blockingCabinet
      );
      expect(wallFit.fitsOnWall).toBe(false);
      expect(wallFit.issues[0].message).toContain('Schiebetür');
    });

    it('includes balcony-door when computing dominant window sunlight direction', () => {
      const state = useFloorplanStore.getState();
      const balconyOnlyOpenings: WallOpening[] = [
        {
          id: 'op-balcony-1',
          wallId: 'w2',
          type: 'balcony-door',
          offsetFromStartCm: 100,
          widthCm: 110,
          heightCm: 210,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ];
      const sunDir = computeDominantWindowDirection(
        state.corners,
        state.walls,
        balconyOnlyOpenings,
        { minX: 0, maxX: 450, minZ: 0, maxZ: 360, cx: 225, cz: 180 }
      );
      expect(sunDir.hasWindows).toBe(true);
      expect(sunDir.windowCount).toBe(1);
    });

    it('exports and imports all 5 opening types via JSON and renders them in 1:50 SVG export and OpeningInspector', () => {
      const state = useFloorplanStore.getState();
      const slidingId = state.addOpening({
        wallId: 'w1',
        type: 'sliding-door',
        offsetFromStartCm: 40,
        widthCm: 90,
        heightCm: 205,
        sillHeightCm: 0,
        swingDirection: 'in-left',
      });
      const passageId = state.addOpening({
        wallId: 'w4',
        type: 'passage',
        offsetFromStartCm: 60,
        widthCm: 110,
        heightCm: 210,
        sillHeightCm: 0,
      });
      const balconyId = state.addOpening({
        wallId: 'w2',
        type: 'balcony-door',
        offsetFromStartCm: 20,
        widthCm: 90,
        heightCm: 210,
        sillHeightCm: 0,
        swingDirection: 'in-right',
      });

      const exportedJson = useFloorplanStore.getState().exportJson();
      useFloorplanStore.getState().loadPreset('empty-room');
      expect(useFloorplanStore.getState().importJson(exportedJson)).toBe(true);

      const importedOpenings = useFloorplanStore.getState().openings;
      expect(importedOpenings.find((o) => o.id === slidingId)?.type).toBe('sliding-door');
      expect(importedOpenings.find((o) => o.id === passageId)?.type).toBe('passage');
      expect(importedOpenings.find((o) => o.id === balconyId)?.type).toBe('balcony-door');

      // Check 1:50 SVG export contains specialized classes
      const svg = exportScaledFloorplanSvg(useFloorplanStore.getState(), {
        scale: '1:50',
      });
      expect(svg).toContain('arch-sliding-door');
      expect(svg).toContain('arch-passage');
      expect(svg).toContain('arch-balcony-door');

      // Check OpeningInspector renders type selector
      const slidingOp = importedOpenings.find((o) => o.id === slidingId)!;
      const html = renderToStaticMarkup(
        React.createElement(OpeningInspector, { selectedOpening: slidingOp })
      );
      expect(html).toContain('Schiebetür');
      expect(html).toContain('Wanddurchbruch');
      expect(html).toContain('Balkon-/Terrassentür');
    });
  });

  describe('3D-B: Interaktiver Teppich-Editor (AreaRug Store, Inspector & SVG Export)', () => {
    it('supports adding, updating, dragging without undo flooding, selecting, and removing AreaRugs', () => {
      const state = useFloorplanStore.getState();
      const initialRugCount = state.rugs.length;

      const rugId = state.addRug({
        name: 'Wollteppich Creme',
        widthCm: 240,
        depthCm: 170,
        x: 225,
        z: 180,
        rotationYDeg: 0,
        color: '#edece8',
      });

      let cur = useFloorplanStore.getState();
      expect(cur.rugs.length).toBe(initialRugCount + 1);
      expect(cur.selectedId).toBe(rugId);
      expect(cur.selectedType).toBe('rug');

      // Update rug dimensions & rotation
      cur.updateRug(rugId, { widthCm: 260, rotationYDeg: 90, color: '#cbd5c0' });
      cur = useFloorplanStore.getState();
      const updatedRug = cur.rugs.find((r) => r.id === rugId)!;
      expect(updatedRug.widthCm).toBe(260);
      expect(updatedRug.rotationYDeg).toBe(90);
      expect(updatedRug.color).toBe('#cbd5c0');

      // Drag rug with recordHistory: false
      const undoBeforeDrag = cur.undoStack.length;
      cur.pushUndoSnapshot();
      for (let i = 1; i <= 5; i++) {
        useFloorplanStore.getState().moveRug(rugId, 225 + i * 10, 180 + i * 5, {
          recordHistory: false,
        });
      }
      cur = useFloorplanStore.getState();
      expect(cur.undoStack.length).toBe(undoBeforeDrag + 1);
      expect(cur.rugs.find((r) => r.id === rugId)?.x).toBe(275);
      expect(cur.rugs.find((r) => r.id === rugId)?.z).toBe(205);

      // Render RugInspector & InspectorSidebar with selected rug
      const rugInspectorHtml = renderToStaticMarkup(
        React.createElement(RugInspector, {
          selectedRug: cur.rugs.find((r) => r.id === rugId)!,
        })
      );
      expect(rugInspectorHtml).toContain('Teppich-Inspektor');
      expect(rugInspectorHtml).toContain('Wollteppich Creme');

      const sidebarHtml = renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );
      expect(sidebarHtml).toContain('Teppich-Inspektor');

      // Verify 1:50 SVG export renders the rug
      const svg = exportScaledFloorplanSvg(cur, { scale: '1:50' });
      expect(svg).toContain('arch-rug');
      expect(svg).toContain('Wollteppich Creme');

      // Remove rug
      cur.removeRug(rugId);
      cur = useFloorplanStore.getState();
      expect(cur.rugs.find((r) => r.id === rugId)).toBeUndefined();
      expect(cur.selectedId).toBeNull();
      expect(cur.selectedType).toBeNull();
    });
  });
});
