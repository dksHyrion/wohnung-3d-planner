import React from 'react';
import type { CanvasViewBox } from '../../core/canvas2dMath';
import type { Corner, RoomPolygon, Wall } from '../../core/types';
import { GridAndBackgroundLayer, RoomsLayer } from './layers/RoomsAndBackgroundLayers';
import { RugsLayer, WallsAndOpeningsLayer } from './layers/WallsOpeningsRugsLayers';
import {
  CornersLayer,
  FurnitureLayer,
  OverlaysAndGuidesLayer,
  VariantGhostLayer,
} from './layers/FurnitureAndOverlaysLayers';

export type { CanvasViewBox };

export type CanvasDragState =
  | { type: 'pan'; startClientX: number; startClientY: number; startVB: CanvasViewBox }
  | { type: 'corner'; cornerId: string; hasMoved?: boolean }
  | {
      type: 'furniture';
      furnitureId: string;
      offsetX: number;
      offsetZ: number;
      anchorStartX?: number;
      anchorStartZ?: number;
      hasMoved?: boolean;
    }
  | {
      type: 'rug';
      rugId: string;
      offsetX: number;
      offsetZ: number;
      hasMoved?: boolean;
    }
  | { type: 'draw-wall'; startX: number; startZ: number; currentX: number; currentZ: number }
  | { type: 'measure'; startX: number; startZ: number; currentX: number; currentZ: number }
  | { type: 'marquee'; startX: number; startZ: number; currentX: number; currentZ: number }
  | { type: 'background-image'; offsetX: number; offsetZ: number; hasMoved: boolean }
  | null;

export function FloorplanSvg2D({
  viewBox,
  dragState,
  setDragState,
  calibrationHoverPt,
  cornerMap,
  roomPolygons,
  clientToWorldCm,
  handleWallClick,
  wallLengthInput,
}: {
  viewBox: CanvasViewBox;
  dragState: CanvasDragState;
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  calibrationHoverPt: { x: number; z: number } | null;
  cornerMap: Map<string, Corner>;
  roomPolygons: RoomPolygon[];
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
  handleWallClick: (event: React.MouseEvent, wall: Wall) => void;
  wallLengthInput?: string;
}) {
  return (
    <>
      <GridAndBackgroundLayer
        viewBox={viewBox}
        setDragState={setDragState}
        clientToWorldCm={clientToWorldCm}
      />
      <RoomsLayer roomPolygons={roomPolygons} />
      <RugsLayer setDragState={setDragState} clientToWorldCm={clientToWorldCm} />
      <WallsAndOpeningsLayer cornerMap={cornerMap} handleWallClick={handleWallClick} />
      <FurnitureLayer setDragState={setDragState} clientToWorldCm={clientToWorldCm} />
      <VariantGhostLayer />
      <OverlaysAndGuidesLayer
        dragState={dragState}
        calibrationHoverPt={calibrationHoverPt}
        wallLengthInput={wallLengthInput}
      />
      <CornersLayer setDragState={setDragState} />
    </>
  );
}
