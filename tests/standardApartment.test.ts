import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { applyRoomLabels, computeFloorPolygons } from '../src/core/wallMath';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';
import { ArchitecturalFurniture3D } from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import type { RoomPolygon, Wall, WallOpening } from '../src/core/types';

function boundaryWalls(room: RoomPolygon, walls: Wall[]): Wall[] {
  const found: Wall[] = [];
  for (let i = 0; i < room.corners.length; i++) {
    const a = room.corners[i].id;
    const b = room.corners[(i + 1) % room.corners.length].id;
    const wall = walls.find(
      (candidate) =>
        (candidate.startCornerId === a && candidate.endCornerId === b) ||
        (candidate.startCornerId === b && candidate.endCornerId === a)
    );
    if (wall) found.push(wall);
  }
  return found;
}

function hasOpening(walls: Wall[], openings: WallOpening[], type: 'door' | 'window'): boolean {
  const ids = new Set(walls.map((wall) => wall.id));
  return openings.some((opening) => opening.type === type && ids.has(opening.wallId));
}

function shortSideCm(room: RoomPolygon): number {
  const xs = room.netCorners.map((corner) => corner.x);
  const zs = room.netCorners.map((corner) => corner.z);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  return Math.min(width, depth);
}

describe('Standardwohnung 55 m²', () => {
  const plan = PRESET_FLOORPLANS['standard-55'];

  it('ist die Vorlage und trägt den Sorrent', () => {
    expect(plan).toBeDefined();
    const sorrent = plan.data.furniture.find((item) => item.visual === 'musterring-sorrent');
    expect(sorrent?.widthCm).toBe(200);
    expect(sorrent?.depthCm).toBe(67);
    expect(sorrent?.heightCm).toBe(217);
    expect(sorrent?.isRealFurniture).toBe(true);
    expect(sorrent?.clearanceZoneCm).toBeUndefined();
  });

  it('ist eine Wohnküche mit Bad, Diele und Schlafen, ohne Kollision', () => {
    const rooms = applyRoomLabels(
      computeFloorPolygons(plan.data.corners, plan.data.walls),
      plan.data.roomLabels
    );
    const net = rooms.reduce((sum, room) => sum + room.netAreaSqM, 0);
    expect(rooms).toHaveLength(4);
    expect(net).toBeGreaterThan(54);
    expect(net).toBeLessThan(56.5);

    const byName = Object.fromEntries(rooms.map((room) => [room.name, room]));
    expect(Object.keys(byName).sort()).toEqual(['Bad', 'Diele', 'Schlafen', 'Wohnküche']);

    expect(byName.Schlafen.netAreaSqM).toBeGreaterThan(14);
    expect(byName.Schlafen.netAreaSqM).toBeLessThan(17);
    expect(byName.Wohnküche.netAreaSqM).toBeGreaterThan(25);
    expect(byName.Wohnküche.netAreaSqM).toBeLessThan(30);
    expect(byName.Bad.netAreaSqM).toBeGreaterThan(5.5);
    expect(byName.Bad.netAreaSqM).toBeLessThan(7.5);
    expect(byName.Diele.netAreaSqM).toBeGreaterThan(5.5);
    expect(byName.Diele.netAreaSqM).toBeLessThan(8);

    expect(shortSideCm(byName.Bad)).toBeGreaterThan(210);
    expect(shortSideCm(byName.Diele)).toBeGreaterThan(200);
    expect(shortSideCm(byName.Schlafen)).toBeGreaterThan(300);

    expect(plan.data.walls.some((wall) => wall.id === 'w-woh-kue')).toBe(false);
    expect(plan.data.openings.some((opening) => opening.wallId === 'w-die-kue')).toBe(false);
    expect(plan.data.openings.some((opening) => opening.id === 'op-std-kitchen')).toBe(false);

    for (const room of rooms) {
      expect(hasOpening(boundaryWalls(room, plan.data.walls), plan.data.openings, 'door')).toBe(true);
    }
    for (const name of ['Schlafen', 'Wohnküche'] as const) {
      expect(
        hasOpening(boundaryWalls(byName[name], plan.data.walls), plan.data.openings, 'window')
      ).toBe(true);
    }

    const visuals = plan.data.furniture.map((item) => item.visual);
    expect(visuals.filter((visual) => visual === 'plant').length).toBeGreaterThanOrEqual(3);
    expect(visuals.filter((visual) => visual === 'sofa' || visual === 'sectional-sofa')).toHaveLength(0);
    const osaka = plan.data.furniture.find((item) => item.visual === 'boconcept-osaka');
    expect(osaka?.isRealFurniture).toBe(true);
    expect(osaka?.widthCm).toBe(190);
    expect(osaka?.depthCm).toBe(95);
    expect(osaka?.heightCm).toBe(90);
    expect(visuals).not.toContain('bathtub');
    for (const visual of ['shower', 'toilet', 'washing-machine', 'kitchen-unit', 'vanity'] as const) {
      expect(visuals, visual).toContain(visual);
    }
    const kitchen = plan.data.furniture.find((item) => item.visual === 'kitchen-unit');
    expect(kitchen?.heightCm).toBeGreaterThanOrEqual(140);
    expect(kitchen?.clearanceZoneCm).toBe(50);

    const lamp = plan.data.furniture.find((item) => item.visual === 'artemide-tolomeo');
    expect(lamp?.isRealFurniture).toBe(true);
    expect((lamp?.elevationCm ?? 0) + (lamp?.heightCm ?? 0)).toBeLessThanOrEqual(250);

    const desk = plan.data.furniture.find((item) => item.visual === 'inwerk-masterlift');
    expect(desk?.isRealFurniture).toBe(true);
    expect(desk?.widthCm).toBe(160);
    expect(desk?.depthCm).toBe(80);
    expect(desk?.brand).toBe('Inwerk');

    const gesture = plan.data.furniture.find((item) => item.visual === 'steelcase-gesture');
    expect(gesture?.isRealFurniture).toBe(true);
    expect(gesture?.widthCm).toBe(66);
    expect(gesture?.depthCm).toBe(66);
    expect(gesture?.heightCm).toBe(107);
    expect(gesture?.brand).toBe('Steelcase');

    const monitor = plan.data.furniture.find((item) => item.visual === 'desk-monitor');
    expect(monitor?.isRealFurniture).toBe(true);
    expect(monitor?.elevationCm).toBe(73);
    expect(monitor?.widthCm).toBe(62);
    expect(monitor?.heightCm).toBe(50);
    expect(monitor?.depthCm).toBe(22);

    const lium = plan.data.furniture.find((item) => item.visual === 'regalraum-lium');
    expect(lium?.isRealFurniture).toBe(true);
    expect(lium?.widthCm).toBe(57);
    expect(lium?.depthCm).toBe(36);
    expect(lium?.heightCm).toBe(140);

    const viva = plan.data.furniture.find((item) => item.visual === 'neona-viva');
    expect(viva?.isRealFurniture).toBe(true);
    expect(viva?.widthCm).toBe(26.5);
    expect(viva?.depthCm).toBe(14);
    expect(viva?.heightCm).toBe(140);

    for (const visual of ['steelcase-gesture', 'desk-monitor', 'regalraum-lium', 'neona-viva'] as const) {
      const piece = plan.data.furniture.find((entry) => entry.visual === visual);
      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item: piece! })
      );
      expect(markup, visual).toContain(visual);
    }

    for (const name of ['shower-cabin', 'toilet-wall-hung', 'washing-machine'] as const) {
      const item = plan.data.furniture.find((entry) => {
        if (name === 'shower-cabin') return entry.visual === 'shower';
        if (name === 'toilet-wall-hung') return entry.visual === 'toilet';
        return entry.visual === 'washing-machine';
      });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item: item! })
      );
      expect(html).toContain(name);
    }

    const reports = Object.values(evaluateFloorplanCollisions(plan.data));
    const hits = reports.filter((report) => report.hasCollision);
    expect(hits.map((report) => ({ id: report.furnitureId, messages: report.issues.map((issue) => issue.message) }))).toEqual([]);
  });
});
