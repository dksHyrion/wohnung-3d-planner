import React from 'react';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import { snapAngleToOrthogonal, applyRoomLabels, computeFloorPolygons } from '../../../core/wallMath';
import { resolveRoofSlopePlanes, computeRoofSlopeContourLines } from '../../../core/roofSlopeMath';
import { evaluateWalkAndSightlines } from '../../../core/walkAndSightlines';
import { computePointDistanceCm } from '../../../core/measureMath';
import { bedHeadboardDepthCm, isOsakaOpen, layoutFurnitureParts } from '../../../core/furnitureShapes';
import { computeVariantDiff } from '../../../core/layoutVariants';
import { resolveFurnitureVisual } from '../../../core/furnitureVisual';
import { getEntityLevelId } from '../../../core/levels';
import { computeStairGeometry } from '../../../core/stairsMath';
import {
  PASSAGE_SEVERITY_COLORS,
  formatPassageBadgeLabel,
  getPassageBadgeTextColor,
} from '../../../core/ergonomicsEngine';
import type { CanvasDragState } from '../FloorplanSvg2D';

export const StairsLayer = React.memo(function StairsLayer({
  setDragState,
  clientToWorldCm,
}: {
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
}) {
  const stairs = useFloorplanStore((s) => s.stairs);
  const levels = useFloorplanStore((s) => s.levels);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const visibleStairs = React.useMemo(
    () =>
      stairs.filter(
        (s) => s.fromLevelId === activeLevelId || s.toLevelId === activeLevelId
      ),
    [stairs, activeLevelId]
  );

  return (
    <>
      {visibleStairs.map((stair) => {
        const fromLevel = levels.find((l) => l.id === stair.fromLevelId);
        const toLevel = levels.find((l) => l.id === stair.toLevelId);
        const geom = computeStairGeometry(stair, fromLevel, toLevel);
        const isArriving =
          stair.toLevelId === activeLevelId && stair.fromLevelId !== activeLevelId;
        const isSelected = selectedType === 'stair' && selectedId === stair.id;
        const strokeCol = isSelected ? '#38bdf8' : geom.din18065Ok ? '#cbd5e1' : '#f59e0b';
        const polyPts = (
          isArriving ? geom.openingPolygonXZ : geom.footprintPolygonXZ
        )
          .map((p) => `${p.x},${p.z}`)
          .join(' ');
        const arrowPts = geom.walkArrowPolylineXZ.map((p) => `${p.x},${p.z}`).join(' ');
        const arrowEnd = geom.walkArrowPolylineXZ[geom.walkArrowPolylineXZ.length - 1];
        const arrowPrev = geom.walkArrowPolylineXZ[geom.walkArrowPolylineXZ.length - 2];
        let arrowHead = null;
        if (arrowEnd && arrowPrev) {
          const dx = arrowEnd.x - arrowPrev.x;
          const dz = arrowEnd.z - arrowPrev.z;
          const len = Math.hypot(dx, dz) || 1;
          const ux = dx / len;
          const uz = dz / len;
          const px = -uz;
          const pz = ux;
          const tip = `${arrowEnd.x},${arrowEnd.z}`;
          const left = `${arrowEnd.x - ux * 12 + px * 7},${arrowEnd.z - uz * 12 + pz * 7}`;
          const right = `${arrowEnd.x - ux * 12 - px * 7},${arrowEnd.z - uz * 12 - pz * 7}`;
          arrowHead = <polygon points={`${tip} ${left} ${right}`} fill={strokeCol} />;
        }

        return (
          <g
            key={stair.id}
            data-stair-id={stair.id}
            style={{ cursor: 'move' }}
            onPointerDown={(e) => {
              if (activeTool !== 'select') return;
              e.stopPropagation();
              selectEntity(stair.id, 'stair');
              const pt = clientToWorldCm(e.clientX, e.clientY);
              setDragState({
                type: 'stair',
                stairId: stair.id,
                offsetX: pt.x - stair.x,
                offsetZ: pt.z - stair.z,
              });
            }}
          >
            <polygon
              points={polyPts}
              fill={isArriving ? 'rgba(15, 23, 42, 0.35)' : 'rgba(148, 163, 184, 0.18)'}
              stroke={strokeCol}
              strokeWidth={isSelected ? 2.8 : 1.6}
              strokeDasharray={isArriving ? '6 4' : undefined}
            />
            {isArriving && geom.openingPolygonXZ.length >= 4 && (
              <>
                <line
                  x1={geom.openingPolygonXZ[0].x}
                  y1={geom.openingPolygonXZ[0].z}
                  x2={geom.openingPolygonXZ[2].x}
                  y2={geom.openingPolygonXZ[2].z}
                  stroke={strokeCol}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
                <line
                  x1={geom.openingPolygonXZ[1].x}
                  y1={geom.openingPolygonXZ[1].z}
                  x2={geom.openingPolygonXZ[3].x}
                  y2={geom.openingPolygonXZ[3].z}
                  stroke={strokeCol}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              </>
            )}
            {!isArriving &&
              geom.treadLines.map((tl, idx) => (
                <line
                  key={`tread-${idx}`}
                  x1={tl.x1}
                  y1={tl.z1}
                  x2={tl.x2}
                  y2={tl.z2}
                  stroke={strokeCol}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              ))}
            <polyline
              points={arrowPts}
              fill="none"
              stroke={strokeCol}
              strokeWidth={1.8}
              pointerEvents="none"
            />
            {arrowHead}
          </g>
        );
      })}
    </>
  );
});

export const FurnitureLayer = React.memo(function FurnitureLayer({
  setDragState,
  clientToWorldCm,
}: {
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
}) {
  const furniture = useFloorplanStore((s) => s.furniture);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedIds = useFloorplanStore((s) => s.selectedIds);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);
  const toggleSelectFurniture = useFloorplanStore((s) => s.toggleSelectFurniture);

  const levelFurniture = React.useMemo(
    () => furniture.filter((f) => getEntityLevelId(f) === activeLevelId),
    [furniture, activeLevelId]
  );

  return (
    <>
      {levelFurniture.map((item) => {
        const report = collisionReports[item.id];
        const hasCollision = report?.hasCollision ?? false;
        const hasClearanceBlocked =
          report?.issues.some((i) => i.type === 'clearance-blocked') ?? false;
        const isSelected =
          selectedType === 'furniture' &&
          (selectedIds.includes(item.id) || selectedId === item.id);
        const visual = resolveFurnitureVisual(item);
        const parts = layoutFurnitureParts(item);
        const fillCol = hasCollision ? 'rgba(239, 68, 68, 0.38)' : item.color;
        const strokeCol = hasCollision
          ? '#ef4444'
          : isSelected
          ? '#38bdf8'
          : '#e2e8f0';
        const strokeW = isSelected || hasCollision ? 3 : 1.5;

        return (
          <g
            key={item.id}
            data-furniture-id={item.id}
            data-visual={visual}
            transform={`translate(${item.x}, ${item.z}) rotate(${-item.rotationYDeg})`}
            style={{ cursor: 'move' }}
            onPointerDown={(e) => {
              if (activeTool !== 'select') return;
              e.stopPropagation();
              if (e.shiftKey) {
                toggleSelectFurniture(item.id);
                return;
              }
              if (
                !(
                  selectedType === 'furniture' &&
                  selectedIds.length > 1 &&
                  selectedIds.includes(item.id)
                )
              ) {
                selectEntity(item.id, 'furniture');
              }
              const pt = clientToWorldCm(e.clientX, e.clientY);
              setDragState({
                type: 'furniture',
                furnitureId: item.id,
                offsetX: pt.x - item.x,
                offsetZ: pt.z - item.z,
                anchorStartX: item.x,
                anchorStartZ: item.z,
              });
            }}
          >
            {item.clearanceZoneCm && item.clearanceZoneCm > 0 && (
              <rect
                x={-item.widthCm / 2}
                y={item.depthCm / 2}
                width={item.widthCm}
                height={item.clearanceZoneCm}
                rx={2}
                fill={
                  hasClearanceBlocked
                    ? 'rgba(239, 68, 68, 0.18)'
                    : isSelected
                    ? 'rgba(56, 189, 248, 0.14)'
                    : 'rgba(245, 158, 11, 0.08)'
                }
                stroke={
                  hasClearanceBlocked
                    ? '#ef4444'
                    : isSelected
                    ? '#38bdf8'
                    : '#f59e0b'
                }
                strokeWidth={isSelected || hasClearanceBlocked ? 2 : 1.2}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}

            {visual === 'boconcept-osaka' && isOsakaOpen(item) ? (
              <>
                {parts.map((part) => {
                  const isMattress = part.id === 'mattress-open';
                  return (
                    <rect
                      key={part.id}
                      data-part={part.id}
                      x={part.cx - part.widthCm / 2}
                      y={part.cz - part.depthCm / 2}
                      width={part.widthCm}
                      height={part.depthCm}
                      rx={isMattress ? 3 : 4}
                      fill={isMattress ? (hasCollision ? 'rgba(239, 68, 68, 0.38)' : '#e2ded5') : fillCol}
                      fillOpacity={isMattress ? 0.82 : hasCollision ? 0.9 : 0.85}
                      stroke={strokeCol}
                      strokeWidth={isMattress ? 1.2 : strokeW}
                    />
                  );
                })}
                <line
                  x1={-item.widthCm / 2 + 18}
                  y1={0}
                  x2={item.widthCm / 2 - 18}
                  y2={0}
                  stroke="rgba(71, 85, 105, 0.45)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              </>
            ) : (
              parts.map((part) => (
                <rect
                  key={part.id}
                  data-part={part.id}
                  x={part.cx - part.widthCm / 2}
                  y={part.cz - part.depthCm / 2}
                  width={part.widthCm}
                  height={part.depthCm}
                  rx={part.id.startsWith('chair') ? 2 : 4}
                  fill={fillCol}
                  fillOpacity={
                    hasCollision
                      ? 0.9
                      : part.id.startsWith('chair')
                      ? 0.62
                      : 0.78
                  }
                  stroke={strokeCol}
                  strokeWidth={part.id.startsWith('chair') ? 1.1 : strokeW}
                />
              ))
            )}

            {visual === 'bed' && (
              <>
                <rect
                  x={-item.widthCm / 2}
                  y={-item.depthCm / 2}
                  width={item.widthCm}
                  height={bedHeadboardDepthCm(item.depthCm)}
                  rx={2}
                  fill="rgba(15, 23, 42, 0.32)"
                  pointerEvents="none"
                />
                {item.widthCm >= 140 ? (
                  <>
                    <rect
                      x={-item.widthCm * 0.38}
                      y={-item.depthCm / 2 + bedHeadboardDepthCm(item.depthCm) + 5}
                      width={item.widthCm * 0.32}
                      height={22}
                      rx={4}
                      fill="rgba(255, 255, 255, 0.35)"
                      pointerEvents="none"
                    />
                    <rect
                      x={item.widthCm * 0.06}
                      y={-item.depthCm / 2 + bedHeadboardDepthCm(item.depthCm) + 5}
                      width={item.widthCm * 0.32}
                      height={22}
                      rx={4}
                      fill="rgba(255, 255, 255, 0.35)"
                      pointerEvents="none"
                    />
                  </>
                ) : (
                  <rect
                    x={-item.widthCm * 0.32}
                    y={-item.depthCm / 2 + bedHeadboardDepthCm(item.depthCm) + 5}
                    width={item.widthCm * 0.64}
                    height={22}
                    rx={4}
                    fill="rgba(255, 255, 255, 0.35)"
                    pointerEvents="none"
                  />
                )}
              </>
            )}

            {visual !== 'sectional-sofa' && (
              <line
                x1={-item.widthCm / 2 + 8}
                y1={item.depthCm / 2 - 4}
                x2={item.widthCm / 2 - 8}
                y2={item.depthCm / 2 - 4}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={2}
              />
            )}

            <text
              x={0}
              y={-3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="11"
              fontWeight={700}
              pointerEvents="none"
            >
              {item.name}
            </text>
            <text
              x={0}
              y={11}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="9.5"
              pointerEvents="none"
            >
              {item.widthCm} × {item.depthCm} cm (H {item.heightCm})
            </text>
          </g>
        );
      })}
    </>
  );
});

export const OverlaysAndGuidesLayer = React.memo(function OverlaysAndGuidesLayer({
  dragState,
  calibrationHoverPt,
  wallLengthInput,
}: {
  dragState: CanvasDragState;
  calibrationHoverPt: { x: number; z: number } | null;
  wallLengthInput?: string;
}) {
  const showPassageHeatmap = useFloorplanStore((s) => s.showPassageHeatmap);
  const passageReport = useFloorplanStore((s) => s.passageReport);
  const ergonomicsScorecard = useFloorplanStore((s) => s.ergonomicsScorecard);
  const allCorners = useFloorplanStore((s) => s.corners);
  const allWalls = useFloorplanStore((s) => s.walls);
  const allOpenings = useFloorplanStore((s) => s.openings);
  const allFurniture = useFloorplanStore((s) => s.furniture);
  const allRoomLabels = useFloorplanStore((s) => s.roomLabels);
  const allRoofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const alignSunWithWindows = useFloorplanStore((s) => s.alignSunWithWindows);

  const corners = React.useMemo(
    () => allCorners.filter((c) => getEntityLevelId(c) === activeLevelId),
    [allCorners, activeLevelId]
  );
  const walls = React.useMemo(
    () => allWalls.filter((w) => getEntityLevelId(w) === activeLevelId),
    [allWalls, activeLevelId]
  );
  const openings = React.useMemo(
    () => allOpenings.filter((o) => getEntityLevelId(o) === activeLevelId),
    [allOpenings, activeLevelId]
  );
  const furniture = React.useMemo(
    () => allFurniture.filter((f) => getEntityLevelId(f) === activeLevelId),
    [allFurniture, activeLevelId]
  );
  const roomLabels = React.useMemo(
    () => allRoomLabels.filter((l) => getEntityLevelId(l) === activeLevelId),
    [allRoomLabels, activeLevelId]
  );
  const roofSlopes = React.useMemo(
    () => allRoofSlopes.filter((s) => getEntityLevelId(s) === activeLevelId),
    [allRoofSlopes, activeLevelId]
  );

  const roofContours = React.useMemo(() => {
    if (!roofSlopes || roofSlopes.length === 0) return [];
    const rooms = applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels);
    const planes = resolveRoofSlopePlanes(corners, walls, roofSlopes, rooms);
    return planes.map(computeRoofSlopeContourLines);
  }, [corners, walls, roomLabels, roofSlopes]);

  const walkSightReport = React.useMemo(() => {
    if (!showPassageHeatmap) return null;
    return evaluateWalkAndSightlines(
      { corners, walls, openings, furniture },
      { timeOfDay, alignSunWithWindows }
    );
  }, [showPassageHeatmap, corners, walls, openings, furniture, timeOfDay, alignSunWithWindows]);
  const measureStart = useFloorplanStore((s) => s.measureStart);
  const measureEnd = useFloorplanStore((s) => s.measureEnd);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const calibrationPoints = useFloorplanStore((s) => s.calibrationPoints);
  const activeAlignmentGuides = useFloorplanStore((s) => s.activeAlignmentGuides);

  return (
    <>
      {showPassageHeatmap && passageReport && (
        <g pointerEvents="none" className="passage-heatmap-group" data-testid="passage-heatmap-2d">
          {passageReport.passages.map((p) => {
            const color = PASSAGE_SEVERITY_COLORS[p.severity];
            const strokeWidth = p.severity === 'critical' ? 2.5 : 2;
            const midX = (p.point1.x + p.point2.x) / 2;
            const midZ = (p.point1.z + p.point2.z) / 2;
            const label = formatPassageBadgeLabel(p.severity, p.clearanceCm);
            const textColor = getPassageBadgeTextColor(p.severity);

            return (
              <g key={p.id} className={`passage-item passage-${p.severity}`} data-testid={`passage-${p.id}`}>
                <line
                  x1={p.point1.x}
                  y1={p.point1.z}
                  x2={p.point2.x}
                  y2={p.point2.z}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray="4 3"
                />
                <circle cx={p.point1.x} cy={p.point1.z} r={3} fill={color} />
                <circle cx={p.point2.x} cy={p.point2.z} r={3} fill={color} />
                <g transform={`translate(${midX}, ${midZ})`}>
                  <rect x={-34} y={-10} width={68} height={20} rx={8} fill={color} />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize="10"
                    fontWeight={700}
                  >
                    {label}
                  </text>
                </g>
              </g>
            );
          })}
          {ergonomicsScorecard?.rooms.map((rm) => {
            if (!rm.turningCircleCenter || rm.maxTurningDiameterCm < 30) return null;
            const radiusCm = rm.hasTurningCircle150 ? 75 : rm.maxTurningDiameterCm / 2;
            const strokeColor = rm.hasTurningCircle150 ? '#10b981' : '#f59e0b';
            return (
              <g
                key={`turn-${rm.roomId}`}
                data-testid={`turning-circle-${rm.roomId}`}
                transform={`translate(${rm.turningCircleCenter.x}, ${rm.turningCircleCenter.z})`}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={radiusCm}
                  fill={rm.hasTurningCircle150 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)'}
                  stroke={strokeColor}
                  strokeWidth={1.6}
                  strokeDasharray="6 4"
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize="10"
                  fontWeight={700}
                >
                  {rm.hasTurningCircle150 ? 'Ø 150 cm' : `Ø ${rm.maxTurningDiameterCm} cm`}
                </text>
              </g>
            );
          })}
          {walkSightReport?.glareIssues.map((gl, idx) => (
            <line
              key={`glare-2d-${idx}`}
              data-testid={`glare-ray-${gl.furnitureId}`}
              x1={gl.windowPoint.x}
              y1={gl.windowPoint.z}
              x2={gl.screenPoint.x}
              y2={gl.screenPoint.z}
              stroke={gl.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              strokeWidth={1.8}
              strokeDasharray="3 3"
            />
          ))}
          {walkSightReport?.sightlines.map((sl, idx) => (
            <line
              key={`sight-2d-${idx}`}
              data-testid={`sightline-ray-${sl.fromId}-${sl.toId}`}
              x1={sl.fromPoint.x}
              y1={sl.fromPoint.z}
              x2={sl.toPoint.x}
              y2={sl.toPoint.z}
              stroke={
                sl.status === 'obstructed'
                  ? '#ef4444'
                  : sl.status === 'angled'
                  ? '#f59e0b'
                  : '#38bdf8'
              }
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          ))}
        </g>
      )}

      {roofContours.length > 0 && (
        <g pointerEvents="none" data-testid="roof-slope-contours-2d">
          {roofContours.map((rc) => (
            <g key={`rc-${rc.slopeId}`}>
              {rc.line100 && (
                <g>
                  <line
                    x1={rc.line100[0].x}
                    y1={rc.line100[0].z}
                    x2={rc.line100[1].x}
                    y2={rc.line100[1].z}
                    stroke="#f59e0b"
                    strokeWidth={1.6}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={(rc.line100[0].x + rc.line100[1].x) / 2}
                    y={(rc.line100[0].z + rc.line100[1].z) / 2 - 4}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize="9"
                    fontWeight={700}
                  >
                    1,00 m
                  </text>
                </g>
              )}
              {rc.line200 && (
                <g>
                  <line
                    x1={rc.line200[0].x}
                    y1={rc.line200[0].z}
                    x2={rc.line200[1].x}
                    y2={rc.line200[1].z}
                    stroke="#38bdf8"
                    strokeWidth={1.6}
                    strokeDasharray="8 4"
                  />
                  <text
                    x={(rc.line200[0].x + rc.line200[1].x) / 2}
                    y={(rc.line200[0].z + rc.line200[1].z) / 2 - 4}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight={700}
                  >
                    2,00 m
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>
      )}

      {dragState?.type === 'draw-wall' && (() => {
        const orthoCheck = snapAngleToOrthogonal(
          dragState.startX,
          dragState.startZ,
          dragState.currentX,
          dragState.currentZ,
          1.5
        );
        const isOrtho = orthoCheck.isSnapped;
        const lengthCm = Math.round(
          Math.hypot(
            dragState.currentX - dragState.startX,
            dragState.currentZ - dragState.startZ
          )
        );
        const midX = (dragState.startX + dragState.currentX) / 2;
        const midZ = (dragState.startZ + dragState.currentZ) / 2;

        return (
          <g pointerEvents="none">
            <line
              x1={dragState.startX}
              y1={dragState.startZ}
              x2={dragState.currentX}
              y2={dragState.currentZ}
              stroke={isOrtho ? '#10b981' : '#818cf8'}
              strokeWidth={15}
              strokeOpacity={0.65}
              strokeDasharray="8 6"
            />
            <text
              x={midX}
              y={midZ - 14}
              textAnchor="middle"
              fill={isOrtho ? '#34d399' : '#a5b4fc'}
              fontSize="12"
              fontWeight={700}
            >
              {wallLengthInput && wallLengthInput.length > 0
                ? `${wallLengthInput} cm`
                : `${lengthCm} cm`}
              {isOrtho ? ` (${orthoCheck.snappedAngleDeg}°)` : ''}
            </text>
          </g>
        );
      })()}

      {(() => {
        const p1 =
          dragState?.type === 'measure'
            ? { x: dragState.startX, z: dragState.startZ }
            : measureStart;
        const p2 =
          dragState?.type === 'measure'
            ? { x: dragState.currentX, z: dragState.currentZ }
            : measureEnd;

        if (!p1 || !p2) return null;
        const meas = computePointDistanceCm(p1, p2);
        if (meas.distanceCm < 1) return null;

        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const len = meas.distanceCm;
        const nx = -dz / len;
        const nz = dx / len;
        const tickH = 8;
        const midX = (p1.x + p2.x) / 2;
        const midZ = (p1.z + p2.z) / 2;

        return (
          <g pointerEvents="none" className="measure-tape-group">
            <line
              x1={p1.x}
              y1={p1.z}
              x2={p2.x}
              y2={p2.z}
              stroke="#0284c7"
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            <line
              x1={p1.x - nx * tickH}
              y1={p1.z - nz * tickH}
              x2={p1.x + nx * tickH}
              y2={p1.z + nz * tickH}
              stroke="#0284c7"
              strokeWidth={2.5}
            />
            <line
              x1={p2.x - nx * tickH}
              y1={p2.z - nz * tickH}
              x2={p2.x + nx * tickH}
              y2={p2.z + nz * tickH}
              stroke="#0284c7"
              strokeWidth={2.5}
            />
            <circle cx={p1.x} cy={p1.z} r={3.5} fill="#0284c7" />
            <circle cx={p2.x} cy={p2.z} r={3.5} fill="#0284c7" />
            <g transform={`translate(${midX}, ${midZ})`}>
              <rect
                x={-42}
                y={-12}
                width={84}
                height={24}
                rx={6}
                fill="#0369a1"
                stroke="#38bdf8"
                strokeWidth={1.2}
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight={700}
              >
                {meas.formattedDistance}
              </text>
            </g>
          </g>
        );
      })()}

      {activeTool === 'calibrate-scale' && (
        <g pointerEvents="none" className="calibration-graphics-group">
          {calibrationPoints.p1 && (() => {
            const p1 = calibrationPoints.p1;
            const chSize = 14;
            return (
              <g key="calib-p1">
                <circle cx={p1.x} cy={p1.z} r={5} fill="none" stroke="#06b6d4" strokeWidth={2} />
                <circle cx={p1.x} cy={p1.z} r={2} fill="#06b6d4" />
                <line x1={p1.x - chSize} y1={p1.z} x2={p1.x + chSize} y2={p1.z} stroke="#06b6d4" strokeWidth={2} />
                <line x1={p1.x} y1={p1.z - chSize} x2={p1.x} y2={p1.z + chSize} stroke="#06b6d4" strokeWidth={2} />
                <text x={p1.x + 8} y={p1.z - 8} fill="#06b6d4" fontSize={11} fontWeight={700}>
                  P1
                </text>
              </g>
            );
          })()}

          {calibrationPoints.p1 && (() => {
            const p1 = calibrationPoints.p1;
            const target = calibrationPoints.p2 ?? calibrationHoverPt;
            if (!target) return null;
            return (
              <line
                x1={p1.x}
                y1={p1.z}
                x2={target.x}
                y2={target.z}
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            );
          })()}

          {calibrationPoints.p2 && (() => {
            const p2 = calibrationPoints.p2;
            const chSize = 14;
            return (
              <g key="calib-p2">
                <circle cx={p2.x} cy={p2.z} r={5} fill="none" stroke="#06b6d4" strokeWidth={2} />
                <circle cx={p2.x} cy={p2.z} r={2} fill="#06b6d4" />
                <line x1={p2.x - chSize} y1={p2.z} x2={p2.x + chSize} y2={p2.z} stroke="#06b6d4" strokeWidth={2} />
                <line x1={p2.x} y1={p2.z - chSize} x2={p2.x} y2={p2.z + chSize} stroke="#06b6d4" strokeWidth={2} />
                <text x={p2.x + 8} y={p2.z - 8} fill="#06b6d4" fontSize={11} fontWeight={700}>
                  P2
                </text>
              </g>
            );
          })()}
        </g>
      )}

      {activeAlignmentGuides.length > 0 && (
        <g pointerEvents="none" className="alignment-guides-group">
          {activeAlignmentGuides.map((g, idx) => {
            const color = g.kind === 'flush' ? '#ec4899' : '#06b6d4';
            const midX = (g.start.x + g.end.x) / 2;
            const midZ = (g.start.z + g.end.z) / 2;
            return (
              <g key={`align-guide-${idx}`} data-guide-kind={g.kind}>
                <line
                  x1={g.start.x}
                  y1={g.start.z}
                  x2={g.end.x}
                  y2={g.end.z}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={g.kind === 'flush' ? '3 2' : '5 3'}
                />
                <circle cx={g.start.x} cy={g.start.z} r={3} fill={color} />
                <circle cx={g.end.x} cy={g.end.z} r={3} fill={color} />
                {g.label && (
                  <g transform={`translate(${midX}, ${midZ - 12})`}>
                    <rect
                      x={-36}
                      y={-9}
                      width={72}
                      height={18}
                      rx={4}
                      fill="rgba(15, 23, 42, 0.92)"
                      stroke={color}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fill={color}
                      fontSize={9.5}
                      fontWeight={700}
                    >
                      {g.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      )}

      {dragState?.type === 'marquee' && (
        <rect
          data-testid="marquee-selection-rect"
          x={Math.min(dragState.startX, dragState.currentX)}
          y={Math.min(dragState.startZ, dragState.currentZ)}
          width={Math.abs(dragState.currentX - dragState.startX)}
          height={Math.abs(dragState.currentZ - dragState.startZ)}
          fill="rgba(56, 189, 248, 0.14)"
          stroke="#38bdf8"
          strokeWidth={1.8}
          strokeDasharray="6 3"
          pointerEvents="none"
        />
      )}
    </>
  );
});

export const CornersLayer = React.memo(function CornersLayer({
  setDragState,
}: {
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
}) {
  const corners = useFloorplanStore((s) => s.corners);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const levelCorners = React.useMemo(
    () => corners.filter((c) => getEntityLevelId(c) === activeLevelId),
    [corners, activeLevelId]
  );

  return (
    <>
      {levelCorners.map((c) => {
        const isSelected = selectedType === 'corner' && selectedId === c.id;
        return (
          <circle
            key={c.id}
            cx={c.x}
            cy={c.z}
            r={isSelected ? 9 : 7}
            fill={isSelected ? '#6366f1' : '#f8fafc'}
            stroke="#0f172a"
            strokeWidth={2.5}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              if (activeTool !== 'select') return;
              e.stopPropagation();
              selectEntity(c.id, 'corner');
              setDragState({ type: 'corner', cornerId: c.id });
            }}
          />
        );
      })}
    </>
  );
});

export const VariantGhostLayer = React.memo(function VariantGhostLayer() {
  const ghostVariantId = useFloorplanStore((s) => s.ghostVariantId);
  const layoutVariants = useFloorplanStore((s) => s.layoutVariants);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);

  const ghostVariant = ghostVariantId
    ? layoutVariants.find((v) => v.id === ghostVariantId)
    : undefined;

  if (!ghostVariant) return null;

  const levelFurniture = furniture.filter((f) => getEntityLevelId(f) === activeLevelId);
  const levelRugs = rugs.filter((r) => getEntityLevelId(r) === activeLevelId);
  const levelGhostVariant = {
    ...ghostVariant,
    furniture: ghostVariant.furniture.filter((f) => getEntityLevelId(f) === activeLevelId),
    rugs: ghostVariant.rugs.filter((r) => getEntityLevelId(r) === activeLevelId),
  };

  const diff = computeVariantDiff(
    { furniture: levelFurniture, rugs: levelRugs },
    levelGhostVariant
  );
  const ghostItems = [
    ...diff.ghostOnlyFurniture,
    ...diff.movedFurniture.map((m) => m.ghost),
  ];
  const ghostRugs = [
    ...diff.ghostOnlyRugs,
    ...diff.movedRugs.map((m) => m.ghost),
  ];

  return (
    <g data-testid="variant-ghost-layer-2d" pointerEvents="none">
      {ghostRugs.map((rug) => (
        <g
          key={`ghost-rug-${rug.id}`}
          transform={`translate(${rug.x}, ${rug.z}) rotate(${-(rug.rotationYDeg ?? 0)})`}
        >
          <rect
            x={-rug.widthCm / 2}
            y={-rug.depthCm / 2}
            width={rug.widthCm}
            height={rug.depthCm}
            rx={3}
            fill="rgba(168, 85, 247, 0.08)"
            stroke="#a855f7"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        </g>
      ))}

      {ghostItems.map((item) => {
        const parts = layoutFurnitureParts(item);
        return (
          <g
            key={`ghost-item-${item.id}`}
            data-ghost-furniture-id={item.id}
            transform={`translate(${item.x}, ${item.z}) rotate(${-item.rotationYDeg})`}
          >
            {parts.map((part) => (
              <rect
                key={part.id}
                x={part.cx - part.widthCm / 2}
                y={part.cz - part.depthCm / 2}
                width={part.widthCm}
                height={part.depthCm}
                rx={3}
                fill="rgba(168, 85, 247, 0.14)"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="5 3"
              />
            ))}
          </g>
        );
      })}

      {diff.movedFurniture.map(({ ghost, active }) => (
        <g key={`ghost-delta-${ghost.id}`}>
          <line
            x1={ghost.x}
            y1={ghost.z}
            x2={active.x}
            y2={active.z}
            stroke="#c084fc"
            strokeWidth={1.8}
            strokeDasharray="4 3"
          />
          <circle cx={ghost.x} cy={ghost.z} r={3.5} fill="#a855f7" />
        </g>
      ))}
    </g>
  );
});
