import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import {
  applyRoomLabels,
  computeFitViewBox,
  computeFloorPolygons,
  getWallGeometry,
  snapAngleToOrthogonal,
  snapValueToGrid,
} from '../../core/wallMath';
import { Corner, Wall } from '../../core/types';
import { BackgroundOverlayControls } from './BackgroundOverlayControls';
import { CanvasDragState, FloorplanSvg2D } from './FloorplanSvg2D';

export const FloorplanCanvas2D: React.FC = () => {
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const measureStart = useFloorplanStore((s) => s.measureStart);
  const measureEnd = useFloorplanStore((s) => s.measureEnd);
  const setMeasurePoints = useFloorplanStore((s) => s.setMeasurePoints);
  const gridSizeCm = useFloorplanStore((s) => s.gridSizeCm);
  const orthoSnapEnabled = useFloorplanStore((s) => s.orthoSnapEnabled);
  const updateBackgroundImage = useFloorplanStore((s) => s.updateBackgroundImage);
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);
  const calibrationPoints = useFloorplanStore((s) => s.calibrationPoints);
  const setCalibrationPoint = useFloorplanStore((s) => s.setCalibrationPoint);
  const applyCalibration = useFloorplanStore((s) => s.applyCalibration);
  const cancelCalibration = useFloorplanStore((s) => s.cancelCalibration);

  const selectEntity = useFloorplanStore((s) => s.selectEntity);
  const setActiveTool = useFloorplanStore((s) => s.setActiveTool);
  const moveCorner = useFloorplanStore((s) => s.moveCorner);
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture);
  const moveRug = useFloorplanStore((s) => s.moveRug);
  const clearAlignmentGuides = useFloorplanStore((s) => s.clearAlignmentGuides);
  const addWallWithCorners = useFloorplanStore((s) => s.addWallWithCorners);
  const addOpening = useFloorplanStore((s) => s.addOpening);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ViewBox state in cm coordinates
  const [viewBox, setViewBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>(() => computeFitViewBox(corners));

  const [calibrationHoverPt, setCalibrationHoverPt] = useState<{ x: number; z: number } | null>(null);
  const [calibrationInputCm, setCalibrationInputCm] = useState<string>('200');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTool === 'calibrate-scale') {
        cancelCalibration();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, cancelCalibration]);

  const [dragState, setDragState] = useState<CanvasDragState>(null);

  const cornerMap = useMemo(
    () => new Map<string, Corner>(corners.map((c) => [c.id, c])),
    [corners]
  );

  const clientToWorldCm = (clientX: number, clientY: number): { x: number; z: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, z: 0 };

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;
    return {
      x: Number((viewBox.x + normX * viewBox.w).toFixed(1)),
      z: Number((viewBox.y + normY * viewBox.h).toFixed(1)),
    };
  };

  const snapToGridCm = (val: number) => snapValueToGrid(val, gridSizeCm);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const newW = Math.min(3000, Math.max(250, viewBox.w * factor));
    const newH = Math.min(2400, Math.max(200, viewBox.h * factor));
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    setViewBox({
      x: cx - newW / 2,
      y: cy - newH / 2,
      w: newW,
      h: newH,
    });
  };

  const handleResetView = () => {
    setViewBox(computeFitViewBox(corners));
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'calibrate-scale') {
      if (!calibrationPoints.p1 || !calibrationPoints.p2) {
        const pt = clientToWorldCm(e.clientX, e.clientY);
        setCalibrationPoint({ x: pt.x, z: pt.z });
      }
      return;
    }

    if (e.target !== svgRef.current && (e.target as Element).getAttribute('data-bg') !== 'true') {
      return;
    }

    const pt = clientToWorldCm(e.clientX, e.clientY);

    if (activeTool === 'draw-wall') {
      const sx = snapToGridCm(pt.x);
      const sz = snapToGridCm(pt.z);
      setDragState({
        type: 'draw-wall',
        startX: sx,
        startZ: sz,
        currentX: sx,
        currentZ: sz,
      });
      return;
    }

    if (activeTool === 'measure') {
      const sx = snapToGridCm(pt.x);
      const sz = snapToGridCm(pt.z);
      if (!measureStart || (measureStart && measureEnd)) {
        setMeasurePoints({ x: sx, z: sz }, null);
        setDragState({
          type: 'measure',
          startX: sx,
          startZ: sz,
          currentX: sx,
          currentZ: sz,
        });
      } else {
        setMeasurePoints(measureStart, { x: sx, z: sz });
        setDragState(null);
      }
      return;
    }

    selectEntity(null, null);
    setDragState({
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVB: { ...viewBox },
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'calibrate-scale' && calibrationPoints.p1 && !calibrationPoints.p2) {
      setCalibrationHoverPt(clientToWorldCm(e.clientX, e.clientY));
    }

    if (!dragState) return;

    if (dragState.type === 'background-image') {
      if (!dragState.hasMoved) {
        pushUndoSnapshot();
        dragState.hasMoved = true;
      }
      const pt = clientToWorldCm(e.clientX, e.clientY);
      const newX = Number((pt.x - dragState.offsetX).toFixed(1));
      const newZ = Number((pt.z - dragState.offsetZ).toFixed(1));
      updateBackgroundImage({ xCm: newX, zCm: newZ }, { recordHistory: false });
      return;
    }

    if (dragState.type === 'pan') {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxCm = ((e.clientX - dragState.startClientX) / rect.width) * dragState.startVB.w;
      const dyCm = ((e.clientY - dragState.startClientY) / rect.height) * dragState.startVB.h;
      setViewBox({
        ...dragState.startVB,
        x: dragState.startVB.x - dxCm,
        y: dragState.startVB.y - dyCm,
      });
      return;
    }

    const pt = clientToWorldCm(e.clientX, e.clientY);

    if (dragState.type === 'corner') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
      }
      moveCorner(dragState.cornerId, snapToGridCm(pt.x), snapToGridCm(pt.z), {
        recordHistory: false,
      });
      return;
    }

    if (dragState.type === 'furniture') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
      }
      moveFurniture(
        dragState.furnitureId,
        pt.x - dragState.offsetX,
        pt.z - dragState.offsetZ,
        { recordHistory: false }
      );
      return;
    }

    if (dragState.type === 'rug') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
      }
      moveRug(
        dragState.rugId,
        snapToGridCm(pt.x - dragState.offsetX),
        snapToGridCm(pt.z - dragState.offsetZ),
        { recordHistory: false }
      );
      return;
    }

    if (dragState.type === 'draw-wall') {
      let curX = snapToGridCm(pt.x);
      let curZ = snapToGridCm(pt.z);
      if (orthoSnapEnabled || e.shiftKey) {
        const threshold = e.shiftKey ? 45.0 : 7.0;
        const snapped = snapAngleToOrthogonal(
          dragState.startX,
          dragState.startZ,
          curX,
          curZ,
          threshold
        );
        if (snapped.isSnapped) {
          curX = snapped.x;
          curZ = snapped.z;
        }
      }
      setDragState({
        ...dragState,
        currentX: curX,
        currentZ: curZ,
      });
      return;
    }

    if (dragState.type === 'measure') {
      setDragState({
        ...dragState,
        currentX: snapToGridCm(pt.x),
        currentZ: snapToGridCm(pt.z),
      });
      return;
    }
  };

  const handleSvgPointerUp = () => {
    if (dragState?.type === 'draw-wall') {
      const dist = Math.hypot(
        dragState.currentX - dragState.startX,
        dragState.currentZ - dragState.startZ
      );
      if (dist >= 10) {
        addWallWithCorners(
          { x: dragState.startX, z: dragState.startZ },
          { x: dragState.currentX, z: dragState.currentZ }
        );
        setActiveTool('select');
      }
    }

    if (dragState?.type === 'measure') {
      const dist = Math.hypot(
        dragState.currentX - dragState.startX,
        dragState.currentZ - dragState.startZ
      );
      if (dist >= 5) {
        setMeasurePoints(
          { x: dragState.startX, z: dragState.startZ },
          { x: dragState.currentX, z: dragState.currentZ }
        );
      }
    }
    if (dragState?.type === 'furniture') {
      clearAlignmentGuides();
    }
    setDragState(null);
  };

  const handleWallClick = (e: React.MouseEvent, wall: Wall) => {
    e.stopPropagation();
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) return;

    const geom = getWallGeometry(start, end);

    if (activeTool === 'add-door' || activeTool === 'add-window') {
      const clickPt = clientToWorldCm(e.clientX, e.clientY);
      const relX = clickPt.x - start.x;
      const relZ = clickPt.z - start.z;
      const proj = relX * geom.tangent.x + relZ * geom.tangent.z;
      const defaultWidth = activeTool === 'add-door' ? 86 : 120;
      const clampedOffset = Math.max(
        10,
        Math.min(geom.lengthCm - defaultWidth - 10, Math.round(proj - defaultWidth / 2))
      );

      addOpening({
        wallId: wall.id,
        type: activeTool === 'add-door' ? 'door' : 'window',
        offsetFromStartCm: Math.max(0, clampedOffset),
        widthCm: defaultWidth,
        heightCm: activeTool === 'add-door' ? 200 : 130,
        sillHeightCm: activeTool === 'add-door' ? 0 : 90,
        swingDirection: activeTool === 'add-door' ? 'in-left' : undefined,
      });
      setActiveTool('select');
      return;
    }

    selectEntity(wall.id, 'wall');
  };

  const roomPolygons = useMemo(
    () => applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels),
    [corners, walls, roomLabels]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="viewport-badge">
        <span>2D Grundriss-Editor (Raster: {gridSizeCm} cm{orthoSnapEnabled ? ' • 90° Ortho-Snap' : ''})</span>
      </div>

      <div className="viewport-controls">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setViewBox((v) => ({
              x: v.x + v.w * 0.08,
              y: v.y + v.h * 0.08,
              w: v.w * 0.84,
              h: v.h * 0.84,
            }))
          }
          title="Vergrößern"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setViewBox((v) => ({
              x: v.x - v.w * 0.1,
              y: v.y - v.h * 0.1,
              w: v.w * 1.2,
              h: v.h * 1.2,
            }))
          }
          title="Verkleinern"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleResetView}
          title="Ansicht zentrieren"
        >
          <Maximize2 size={14} />
          <span>Zentrieren</span>
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        style={{
          width: '100%',
          height: '100%',
          cursor:
            activeTool === 'calibrate-scale'
              ? 'crosshair'
              : activeTool === 'draw-wall' || activeTool === 'measure'
              ? 'crosshair'
              : dragState?.type === 'pan'
              ? 'grabbing'
              : 'grab',
        }}
        onWheel={handleWheel}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
      >
        <FloorplanSvg2D
          viewBox={viewBox}
          dragState={dragState}
          setDragState={setDragState}
          calibrationHoverPt={calibrationHoverPt}
          cornerMap={cornerMap}
          roomPolygons={roomPolygons}
          clientToWorldCm={clientToWorldCm}
          handleWallClick={handleWallClick}
        />
      </svg>

      {/* Floating Toolbar Controls for Background Overlay */}
      <BackgroundOverlayControls />

      {/* Calibration Reference Distance Dialog */}
      {activeTool === 'calibrate-scale' && calibrationPoints.p1 && calibrationPoints.p2 && (
        <div
          className="calibration-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Kalibrierung Referenzlänge"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #06b6d4',
            borderRadius: 10,
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#38bdf8' }}>
            📏 Kalibrierung
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
            <span>Reale Referenzlänge in cm:</span>
            <input
              type="number"
              min={1}
              step={1}
              autoFocus
              value={calibrationInputCm}
              onChange={(e) => setCalibrationInputCm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const dist = parseFloat(calibrationInputCm);
                  if (Number.isFinite(dist) && dist > 0) {
                    applyCalibration(dist);
                  }
                } else if (e.key === 'Escape') {
                  cancelCalibration();
                }
              }}
              aria-label="Reale Referenzlänge in cm"
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '6px 10px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => cancelCalibration()}
              style={{ fontSize: '0.8rem', padding: '5px 12px' }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn active"
              disabled={!(parseFloat(calibrationInputCm) > 0)}
              onClick={() => {
                const dist = parseFloat(calibrationInputCm);
                if (Number.isFinite(dist) && dist > 0) {
                  applyCalibration(dist);
                }
              }}
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                background: '#0284c7',
                opacity: !(parseFloat(calibrationInputCm) > 0) ? 0.5 : 1,
                cursor: !(parseFloat(calibrationInputCm) > 0) ? 'not-allowed' : 'pointer',
              }}
            >
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
