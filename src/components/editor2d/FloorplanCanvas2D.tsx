import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  applyRoomLabels,
  computeFitViewBox,
  computeFloorPolygons,
  getWallGeometry,
  snapAngleToOrthogonal,
  snapValueToGrid,
} from '../../core/wallMath';
import {
  clientDeltaToWorldDelta,
  clientPointToSvgWorldCm,
  computeWallEndpointFromLength,
  zoomViewBoxAtPoint,
} from '../../core/canvas2dMath';
import { Corner, Wall } from '../../core/types';
import { selectFurnitureIdsInMarquee } from '../../core/groupTransformMath';
import { BackgroundOverlayControls } from './BackgroundOverlayControls';
import { ScaleCalibrationDialog } from './ScaleCalibrationDialog';
import { CanvasDragState, FloorplanSvg2D } from './FloorplanSvg2D';
import { createFrameThrottle } from '../../core/frameThrottle';
import { getEntityLevelId } from '../../core/levels';

export const FloorplanCanvas2D: React.FC = () => {
  const { t } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
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
  const selectMultipleFurniture = useFloorplanStore((s) => s.selectMultipleFurniture);
  const selectedIds = useFloorplanStore((s) => s.selectedIds);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const furniture = useFloorplanStore((s) => s.furniture);
  const setActiveTool = useFloorplanStore((s) => s.setActiveTool);
  const moveCorner = useFloorplanStore((s) => s.moveCorner);
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture);
  const moveSelectedFurniture = useFloorplanStore((s) => s.moveSelectedFurniture);
  const moveRug = useFloorplanStore((s) => s.moveRug);
  const moveStair = useFloorplanStore((s) => s.moveStair);
  const clearAlignmentGuides = useFloorplanStore((s) => s.clearAlignmentGuides);
  const addWallWithCorners = useFloorplanStore((s) => s.addWallWithCorners);
  const splitWallAt = useFloorplanStore((s) => s.splitWallAt);
  const addOpening = useFloorplanStore((s) => s.addOpening);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ViewBox state in cm coordinates
  const [viewBox, setViewBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>(() => {
    const initialLevelCorners = corners.filter(
      (c) => getEntityLevelId(c) === activeLevelId
    );
    return computeFitViewBox(
      initialLevelCorners.length > 0 ? initialLevelCorners : corners
    );
  });
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  const [calibrationHoverPt, setCalibrationHoverPt] = useState<{ x: number; z: number } | null>(null);
  const [calibrationInputCm, setCalibrationInputCm] = useState<string>('200');
  const [polylineWalls, setPolylineWalls] = useState(false);
  const [wallLengthInput, setWallLengthInput] = useState('');

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
  const dragStateRef = useRef<CanvasDragState>(dragState);
  dragStateRef.current = dragState;
  const wallLengthInputRef = useRef(wallLengthInput);
  wallLengthInputRef.current = wallLengthInput;

  useEffect(() => {
    if (activeTool !== 'draw-wall') {
      setWallLengthInput('');
    }
  }, [activeTool]);

  useEffect(() => {
    if (dragState?.type !== 'draw-wall') return;
    const handleWallKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const currentDrag = dragStateRef.current;
      if (!currentDrag || currentDrag.type !== 'draw-wall') return;

      if (/^[0-9]$/.test(e.key) || e.key === '.' || e.key === ',') {
        e.preventDefault();
        const ch = e.key === ',' ? '.' : e.key;
        if (ch === '.' && wallLengthInputRef.current.includes('.')) return;
        const nextInput = wallLengthInputRef.current + ch;
        setWallLengthInput(nextInput);
        const parsed = parseFloat(nextInput);
        if (Number.isFinite(parsed) && parsed >= 1) {
          const endPt = computeWallEndpointFromLength(
            { x: currentDrag.startX, z: currentDrag.startZ },
            { x: currentDrag.currentX, z: currentDrag.currentZ },
            parsed,
            orthoSnapEnabled,
            e.shiftKey
          );
          setDragState({
            ...currentDrag,
            currentX: endPt.x,
            currentZ: endPt.z,
          });
        }
        return;
      }

      if (e.key === 'Backspace') {
        if (wallLengthInputRef.current.length > 0) {
          e.preventDefault();
          setWallLengthInput((prev) => prev.slice(0, -1));
        }
        return;
      }

      if (e.key === 'Enter') {
        const parsed = parseFloat(wallLengthInputRef.current);
        if (Number.isFinite(parsed) && parsed >= 10) {
          e.preventDefault();
          const endPt = computeWallEndpointFromLength(
            { x: currentDrag.startX, z: currentDrag.startZ },
            { x: currentDrag.currentX, z: currentDrag.currentZ },
            parsed,
            orthoSnapEnabled,
            e.shiftKey
          );
          addWallWithCorners(
            { x: currentDrag.startX, z: currentDrag.startZ },
            endPt
          );
          setWallLengthInput('');
          if (polylineWalls) {
            setDragState({
              type: 'draw-wall',
              startX: endPt.x,
              startZ: endPt.z,
              currentX: endPt.x,
              currentZ: endPt.z,
            });
          } else {
            setDragState(null);
            setActiveTool('select');
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setWallLengthInput('');
        setDragState(null);
      }
    };

    window.addEventListener('keydown', handleWallKeyDown);
    return () => window.removeEventListener('keydown', handleWallKeyDown);
  }, [dragState?.type, orthoSnapEnabled, polylineWalls, addWallWithCorners, setActiveTool]);

  const levelCorners = useMemo(
    () => corners.filter((c) => getEntityLevelId(c) === activeLevelId),
    [corners, activeLevelId]
  );
  const levelWalls = useMemo(
    () => walls.filter((w) => getEntityLevelId(w) === activeLevelId),
    [walls, activeLevelId]
  );
  const levelRoomLabels = useMemo(
    () => roomLabels.filter((l) => getEntityLevelId(l) === activeLevelId),
    [roomLabels, activeLevelId]
  );
  const levelFurniture = useMemo(
    () => furniture.filter((f) => getEntityLevelId(f) === activeLevelId),
    [furniture, activeLevelId]
  );

  const cornerMap = useMemo(
    () => new Map<string, Corner>(levelCorners.map((c) => [c.id, c])),
    [levelCorners]
  );

  const clientToWorldCm = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, z: 0 };
      const rect = svg.getBoundingClientRect();
      const ctmInverse =
        typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM()?.inverse() ?? null : null;
      return clientPointToSvgWorldCm(clientX, clientY, rect, viewBoxRef.current, ctmInverse);
    },
    []
  );

  const snapToGridCm = (val: number) => snapValueToGrid(val, gridSizeCm);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      const rect = svgEl.getBoundingClientRect();
      setViewBox((v) => {
        const anchor = clientPointToSvgWorldCm(e.clientX, e.clientY, rect, v);
        return zoomViewBoxAtPoint(v, anchor, factor);
      });
    };
    svgEl.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      svgEl.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

  const handleResetView = () => {
    setViewBox(computeFitViewBox(levelCorners.length > 0 ? levelCorners : corners));
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

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore in environments without pointer capture
      }
    }

    const pt = clientToWorldCm(e.clientX, e.clientY);

    if (activeTool === 'draw-wall') {
      if (e.button === 2 && dragState?.type === 'draw-wall') {
        setWallLengthInput('');
        setDragState(null);
        return;
      }
      if (dragState?.type === 'draw-wall' && polylineWalls) {
        const dist = Math.hypot(
          dragState.currentX - dragState.startX,
          dragState.currentZ - dragState.startZ
        );
        if (dist >= 10) {
          addWallWithCorners(
            { x: dragState.startX, z: dragState.startZ },
            { x: dragState.currentX, z: dragState.currentZ }
          );
          setWallLengthInput('');
          setDragState({
            type: 'draw-wall',
            startX: dragState.currentX,
            startZ: dragState.currentZ,
            currentX: dragState.currentX,
            currentZ: dragState.currentZ,
          });
          return;
        }
      }
      const sx = snapToGridCm(pt.x);
      const sz = snapToGridCm(pt.z);
      setWallLengthInput('');
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

    if (activeTool === 'select' && e.shiftKey) {
      setDragState({
        type: 'marquee',
        startX: pt.x,
        startZ: pt.z,
        currentX: pt.x,
        currentZ: pt.z,
      });
      return;
    }

    if (e.button !== 0) {
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

  // One store commit per animation frame while dragging; pointer up flushes the last position.
  const dragFrame = useRef(createFrameThrottle()).current;
  const groupDragCommittedDeltaRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  useEffect(() => {
    return () => {
      dragFrame.cancel();
    };
  }, [dragFrame]);

  useEffect(() => {
    if (!dragState || dragState.type === 'draw-wall') return;
    const handleWindowPointerEnd = () => {
      dragFrame.flush();
      clearAlignmentGuides();
      groupDragCommittedDeltaRef.current = { x: 0, z: 0 };
      setDragState(null);
    };
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [dragState, dragFrame, clearAlignmentGuides]);

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
      dragFrame.schedule(() =>
        updateBackgroundImage({ xCm: newX, zCm: newZ }, { recordHistory: false })
      );
      return;
    }

    if (dragState.type === 'pan') {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const { dxCm, dzCm } = clientDeltaToWorldDelta(
        e.clientX - dragState.startClientX,
        e.clientY - dragState.startClientY,
        rect,
        dragState.startVB
      );
      const nextVB = {
        ...dragState.startVB,
        x: dragState.startVB.x - dxCm,
        y: dragState.startVB.y - dzCm,
      };
      dragFrame.schedule(() => setViewBox(nextVB));
      return;
    }

    const pt = clientToWorldCm(e.clientX, e.clientY);

    if (dragState.type === 'corner') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
      }
      const { cornerId } = dragState;
      dragFrame.schedule(() =>
        moveCorner(cornerId, snapToGridCm(pt.x), snapToGridCm(pt.z), { recordHistory: false })
      );
      return;
    }

    if (dragState.type === 'furniture') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
        groupDragCommittedDeltaRef.current = { x: 0, z: 0 };
      }
      const { furnitureId, anchorStartX, anchorStartZ } = dragState;
      const x = pt.x - dragState.offsetX;
      const z = pt.z - dragState.offsetZ;
      const isGroupDrag =
        selectedType === 'furniture' &&
        selectedIds.length > 1 &&
        selectedIds.includes(furnitureId) &&
        anchorStartX !== undefined &&
        anchorStartZ !== undefined;
      if (isGroupDrag) {
        const idsSnapshot = selectedIds;
        dragFrame.schedule(() => {
          const totalDx = x - anchorStartX;
          const totalDz = z - anchorStartZ;
          const stepDx = totalDx - groupDragCommittedDeltaRef.current.x;
          const stepDz = totalDz - groupDragCommittedDeltaRef.current.z;
          groupDragCommittedDeltaRef.current = { x: totalDx, z: totalDz };
          moveSelectedFurniture(idsSnapshot, stepDx, stepDz, { recordHistory: false });
        });
      } else {
        dragFrame.schedule(() => moveFurniture(furnitureId, x, z, { recordHistory: false }));
      }
      return;
    }

    if (dragState.type === 'marquee') {
      setDragState({
        ...dragState,
        currentX: pt.x,
        currentZ: pt.z,
      });
      return;
    }

    if (dragState.type === 'rug') {
      if (!(dragState as { hasMoved?: boolean }).hasMoved) {
        pushUndoSnapshot();
        (dragState as { hasMoved?: boolean }).hasMoved = true;
      }
      const { rugId } = dragState;
      const x = snapToGridCm(pt.x - dragState.offsetX);
      const z = snapToGridCm(pt.z - dragState.offsetZ);
      dragFrame.schedule(() => moveRug(rugId, x, z, { recordHistory: false }));
      return;
    }

    if (dragState.type === 'stair') {
      if (!dragState.hasMoved) {
        pushUndoSnapshot();
        dragState.hasMoved = true;
      }
      const { stairId } = dragState;
      const x = snapToGridCm(pt.x - dragState.offsetX);
      const z = snapToGridCm(pt.z - dragState.offsetZ);
      dragFrame.schedule(() => moveStair(stairId, x, z, { recordHistory: false }));
      return;
    }

    if (dragState.type === 'draw-wall') {
      const parsedLen = parseFloat(wallLengthInput);
      if (Number.isFinite(parsedLen) && parsedLen >= 1 && wallLengthInput.length > 0) {
        const endPt = computeWallEndpointFromLength(
          { x: dragState.startX, z: dragState.startZ },
          { x: snapToGridCm(pt.x), z: snapToGridCm(pt.z) },
          parsedLen,
          orthoSnapEnabled,
          e.shiftKey
        );
        setDragState({
          ...dragState,
          currentX: endPt.x,
          currentZ: endPt.z,
        });
        return;
      }
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
    dragFrame.flush();
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
        setWallLengthInput('');
        if (polylineWalls) {
          setDragState({
            type: 'draw-wall',
            startX: dragState.currentX,
            startZ: dragState.currentZ,
            currentX: dragState.currentX,
            currentZ: dragState.currentZ,
          });
          return;
        }
        setActiveTool('select');
      } else if (polylineWalls) {
        // Stay anchored in polyline mode after initial click-point
        return;
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
    if (dragState?.type === 'marquee') {
      const ids = selectFurnitureIdsInMarquee(levelFurniture, dragState);
      selectMultipleFurniture(ids);
    }
    if (dragState?.type === 'furniture' || dragState?.type === 'rug') {
      clearAlignmentGuides();
      groupDragCommittedDeltaRef.current = { x: 0, z: 0 };
    }
    setDragState(null);
  };

  const handleSvgPointerCancel = () => {
    dragFrame.flush();
    clearAlignmentGuides();
    setDragState(null);
  };

  const handleSvgLostPointerCapture = () => {
    // Releasing the pointer in polyline draw mode fires pointerup (which anchors the next
    // segment) followed immediately by lostpointercapture; preserve the active polyline chain.
    if (dragState?.type === 'draw-wall' && polylineWalls) {
      return;
    }
    handleSvgPointerCancel();
  };

  const handleWallClick = useCallback(
    (e: React.MouseEvent, wall: Wall) => {
      e.stopPropagation();
      const start = cornerMap.get(wall.startCornerId);
      const end = cornerMap.get(wall.endCornerId);
      if (!start || !end) return;

      const geom = getWallGeometry(start, end);

      if (activeTool === 'select' && e.altKey) {
        const clickPt = clientToWorldCm(e.clientX, e.clientY);
        splitWallAt(wall.id, clickPt);
        return;
      }

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
    },
    [cornerMap, activeTool, clientToWorldCm, splitWallAt, addOpening, setActiveTool, selectEntity]
  );

  const roomPolygons = useMemo(
    () => applyRoomLabels(computeFloorPolygons(levelCorners, levelWalls), levelRoomLabels),
    [levelCorners, levelWalls, levelRoomLabels]
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="viewport-badge">
        <span>
          {t('editor2d.badge', {
            grid: gridSizeCm,
            snap: orthoSnapEnabled ? t('editor2d.orthoSnapSuffix') : '',
          })}
        </span>
        {activeTool === 'draw-wall' && (
          <button
            type="button"
            className={`btn ${polylineWalls ? 'active' : 'btn-outline'}`}
            aria-pressed={polylineWalls}
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              fontSize: '0.72rem',
              pointerEvents: 'auto',
            }}
            title={t('editor2d.polylineTitle')}
            onClick={() => {
              setPolylineWalls((prev) => !prev);
              setDragState(null);
            }}
          >
            {t('editor2d.polylineLabel')}
          </button>
        )}
        {dragState?.type === 'draw-wall' && (
          <span
            data-testid="wall-numeric-hint"
            style={{ marginLeft: 8, color: '#38bdf8', fontWeight: 600 }}
          >
            {wallLengthInput.length > 0
              ? t('editor2d.numericLengthBadge', { value: wallLengthInput })
              : t('editor2d.numericLengthHint')}
          </span>
        )}
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
          title={t('editor2d.zoomIn')}
          aria-label={t('editor2d.zoomIn')}
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
          title={t('editor2d.zoomOut')}
          aria-label={t('editor2d.zoomOut')}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleResetView}
          title={t('editor2d.centerView')}
          aria-label={t('editor2d.centerView')}
        >
          <Maximize2 size={14} />
          <span>{t('editor2d.center')}</span>
        </button>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label={t('editor2d.ariaLabel')}
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
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerCancel}
        onLostPointerCapture={handleSvgLostPointerCapture}
        onContextMenu={(e) => {
          if (dragState?.type === 'draw-wall') {
            e.preventDefault();
            setWallLengthInput('');
            setDragState(null);
          }
        }}
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
          wallLengthInput={wallLengthInput}
        />
      </svg>

      {/* Floating Toolbar Controls for Background Overlay */}
      <BackgroundOverlayControls />

      {/* Calibration Reference Distance Dialog */}
      <ScaleCalibrationDialog
        isOpen={Boolean(
          activeTool === 'calibrate-scale' &&
            calibrationPoints.p1 &&
            calibrationPoints.p2
        )}
        valueCm={calibrationInputCm}
        onChangeCm={setCalibrationInputCm}
        onApply={applyCalibration}
        onCancel={cancelCalibration}
      />
    </div>
  );
};
