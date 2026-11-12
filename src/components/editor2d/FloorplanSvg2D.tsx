import React from 'react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { getWallGeometry, snapAngleToOrthogonal } from '../../core/wallMath';
import { computePointDistanceCm } from '../../core/measureMath';
import { Corner, RoomPolygon, Wall } from '../../core/types';
import { doorHingeOnRight, doorLeafPlanPoints, doorSwingsInward } from '../../core/doorLeaf';
import { bedHeadboardDepthCm, isOsakaOpen, layoutFurnitureParts } from '../../core/furnitureShapes';
import { resolveFurnitureVisual } from '../../core/furnitureVisual';
import {
  PASSAGE_SEVERITY_COLORS,
  formatPassageBadgeLabel,
  getPassageBadgeTextColor,
} from '../../core/ergonomicsEngine';

export type CanvasViewBox = { x: number; y: number; w: number; h: number };

export type CanvasDragState =
  | { type: 'pan'; startClientX: number; startClientY: number; startVB: CanvasViewBox }
  | { type: 'corner'; cornerId: string; hasMoved?: boolean }
  | {
      type: 'furniture';
      furnitureId: string;
      offsetX: number;
      offsetZ: number;
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
}: {
  viewBox: CanvasViewBox;
  dragState: CanvasDragState;
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  calibrationHoverPt: { x: number; z: number } | null;
  cornerMap: Map<string, Corner>;
  roomPolygons: RoomPolygon[];
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
  handleWallClick: (event: React.MouseEvent, wall: Wall) => void;
}) {
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const measureStart = useFloorplanStore((s) => s.measureStart);
  const measureEnd = useFloorplanStore((s) => s.measureEnd);
  const backgroundImage = useFloorplanStore((s) => s.backgroundImage);
  const calibrationPoints = useFloorplanStore((s) => s.calibrationPoints);
  const showPassageHeatmap = useFloorplanStore((s) => s.showPassageHeatmap);
  const passageReport = useFloorplanStore((s) => s.passageReport);
  const activeAlignmentGuides = useFloorplanStore((s) => s.activeAlignmentGuides);
  const language = useFloorplanStore((s) => s.language);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  return (
    <>
      <defs>
        <pattern
          id="grid-10cm"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 10 0 L 0 0 0 10"
            fill="none"
            stroke="rgba(148, 163, 184, 0.08)"
            strokeWidth="0.6"
          />
        </pattern>
        <pattern
          id="grid-100cm"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <rect width="100" height="100" fill="url(#grid-10cm)" />
          <path
            d="M 100 0 L 0 0 0 100"
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1.2"
          />
        </pattern>
      </defs>

      {/* Infinite Grid Background */}
      <rect
        data-bg="true"
        x={viewBox.x - 2000}
        y={viewBox.y - 2000}
        width={viewBox.w + 4000}
        height={viewBox.h + 4000}
        fill="url(#grid-100cm)"
      />

      {/* Background Floorplan Image Overlay */}
      {backgroundImage && backgroundImage.visible && (
        <image
          x={backgroundImage.xCm}
          y={backgroundImage.zCm}
          width={backgroundImage.widthCm}
          height={backgroundImage.heightCm}
          opacity={backgroundImage.opacity}
          href={backgroundImage.url}
          preserveAspectRatio="none"
          transform={
            backgroundImage.rotationDeg
              ? `rotate(${backgroundImage.rotationDeg} ${
                  backgroundImage.xCm + backgroundImage.widthCm / 2
                } ${backgroundImage.zCm + backgroundImage.heightCm / 2})`
              : undefined
          }
          style={{
            pointerEvents: backgroundImage.locked ? 'none' : 'auto',
            cursor:
              !backgroundImage.locked && activeTool === 'select'
                ? 'move'
                : undefined,
          }}
          onPointerDown={(e) => {
            if (backgroundImage.locked) return;
            if (activeTool === 'select') {
              e.stopPropagation();
              const pt = clientToWorldCm(e.clientX, e.clientY);
              setDragState({
                type: 'background-image',
                offsetX: pt.x - backgroundImage.xCm,
                offsetZ: pt.z - backgroundImage.zCm,
                hasMoved: false,
              });
            }
          }}
        />
      )}

      {/* Room Floor Polygons & Clickable Area Labels (m²) */}
      {roomPolygons.map((room, idx) => {
        const isRoomSelected =
          selectedType === 'room' && selectedId === room.id;
        return (
          <g key={room.id} data-bg="true" data-room-id={room.id}>
            <polygon
              data-bg="true"
              points={room.corners.map((c) => `${c.x},${c.z}`).join(' ')}
              fill={
                isRoomSelected
                  ? 'rgba(56, 189, 248, 0.24)'
                  : idx % 2 === 0
                  ? 'rgba(30, 41, 59, 0.72)'
                  : 'rgba(15, 118, 110, 0.22)'
              }
              stroke={isRoomSelected ? '#38bdf8' : 'none'}
              strokeWidth={isRoomSelected ? 2 : 0}
            />
            <g
              data-testid={`room-stamp-${room.id}`}
              transform={`translate(${room.centroid.x}, ${room.centroid.z})`}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={(e) => {
                if (activeTool !== 'select') return;
                e.stopPropagation();
                selectEntity(room.id, 'room');
              }}
            >
              {(() => {
                const defaultTitle = language === 'en' ? `Room ${idx + 1}` : `Raum ${idx + 1}`;
                const title = room.name ?? defaultTitle;
                const area = (room.netAreaSqM ?? room.areaSqM).toLocaleString(
                  language === 'en' ? 'en-US' : 'de-DE',
                  {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }
                );
                const label = `${title} · ${area} m²`;
                const width = Math.max(124, label.length * 6.6 + 18);
                return (
                  <>
                    <rect
                      x={-width / 2}
                      y={-12}
                      width={width}
                      height={24}
                      rx={6}
                      fill={
                        isRoomSelected
                          ? 'rgba(3, 105, 161, 0.92)'
                          : 'rgba(15, 23, 42, 0.78)'
                      }
                      stroke={
                        isRoomSelected
                          ? '#38bdf8'
                          : 'rgba(148, 163, 184, 0.25)'
                      }
                      strokeWidth={isRoomSelected ? 1.5 : 0.8}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fill={isRoomSelected ? '#f8fafc' : '#94a3b8'}
                      fontSize={10.5}
                      fontWeight={600}
                    >
                      {label}
                    </text>
                  </>
                );
              })()}
            </g>
          </g>
        );
      })}

      {/* Area Rugs (Teppiche) rendered on floor below walls & furniture */}
      {rugs.map((rug) => {
        const isSelected = selectedType === 'rug' && selectedId === rug.id;
        return (
          <g
            key={rug.id}
            data-rug-id={rug.id}
            transform={`translate(${rug.x}, ${rug.z}) rotate(${-(rug.rotationYDeg ?? 0)})`}
            style={{ cursor: 'move' }}
            onClick={(e) => {
              e.stopPropagation();
              selectEntity(rug.id, 'rug');
            }}
            onPointerDown={(e) => {
              if (activeTool !== 'select') return;
              e.stopPropagation();
              selectEntity(rug.id, 'rug');
              const pt = clientToWorldCm(e.clientX, e.clientY);
              setDragState({
                type: 'rug',
                rugId: rug.id,
                offsetX: pt.x - rug.x,
                offsetZ: pt.z - rug.z,
              });
            }}
          >
            <rect
              x={-rug.widthCm / 2}
              y={-rug.depthCm / 2}
              width={rug.widthCm}
              height={rug.depthCm}
              rx={4}
              fill={rug.color}
              fillOpacity={0.78}
              stroke={isSelected ? '#38bdf8' : 'rgba(248, 250, 252, 0.35)'}
              strokeWidth={isSelected ? 2.8 : 1.2}
              strokeDasharray={isSelected ? undefined : '6 3'}
            />
            <rect
              x={-rug.widthCm / 2 + 6}
              y={-rug.depthCm / 2 + 6}
              width={Math.max(4, rug.widthCm - 12)}
              height={Math.max(4, rug.depthCm - 12)}
              rx={2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.22)"
              strokeWidth={0.8}
              pointerEvents="none"
            />
            {isSelected && (
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize={10}
                fontWeight={600}
                pointerEvents="none"
              >
                {rug.name} ({Math.round(rug.widthCm)}×{Math.round(rug.depthCm)} cm)
              </text>
            )}
          </g>
        );
      })}

      {/* Walls & Exact Centimeter Dimension Labels */}
      {walls.map((wall) => {
        const start = cornerMap.get(wall.startCornerId);
        const end = cornerMap.get(wall.endCornerId);
        if (!start || !end) return null;

        const geom = getWallGeometry(start, end);
        const isSelected = selectedType === 'wall' && selectedId === wall.id;
        const labelX = geom.centerX - geom.normal.x * (wall.thicknessCm + 16);
        const labelZ = geom.centerZ - geom.normal.z * (wall.thicknessCm + 16);

        return (
          <g key={wall.id}>
            <line
              x1={start.x}
              y1={start.z}
              x2={end.x}
              y2={end.z}
              stroke={isSelected ? '#818cf8' : '#cbd5e1'}
              strokeWidth={wall.thicknessCm}
              strokeLinecap="square"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleWallClick(e, wall)}
            />
            {isSelected && (
              <line
                x1={start.x}
                y1={start.z}
                x2={end.x}
                y2={end.z}
                stroke="#6366f1"
                strokeWidth={wall.thicknessCm + 4}
                strokeOpacity={0.4}
                pointerEvents="none"
              />
            )}
            <g
              transform={`translate(${labelX}, ${labelZ})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleWallClick(e, wall)}
            >
              <rect
                x={-28}
                y={-9}
                width={56}
                height={18}
                rx={4}
                fill={isSelected ? '#4f46e5' : '#0f172a'}
                stroke={isSelected ? '#a5b4fc' : '#475569'}
                strokeWidth={1}
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="10"
                fontWeight={600}
              >
                {Math.round(geom.lengthCm)} cm
              </text>
            </g>
          </g>
        );
      })}

      {/* Doors & Windows on Walls */}
      {openings.map((op) => {
        const wall = walls.find((w) => w.id === op.wallId);
        if (!wall) return null;
        const start = cornerMap.get(wall.startCornerId);
        const end = cornerMap.get(wall.endCornerId);
        if (!start || !end) return null;

        const geom = getWallGeometry(start, end);
        const opStartX = start.x + geom.tangent.x * op.offsetFromStartCm;
        const opStartZ = start.z + geom.tangent.z * op.offsetFromStartCm;
        const opEndX =
          start.x + geom.tangent.x * (op.offsetFromStartCm + op.widthCm);
        const opEndZ =
          start.z + geom.tangent.z * (op.offsetFromStartCm + op.widthCm);

        const isSelected = selectedType === 'opening' && selectedId === op.id;

        if (op.type === 'window') {
          return (
            <g
              key={op.id}
              data-opening-id={op.id}
              data-opening-type={op.type}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                selectEntity(op.id, 'opening');
              }}
            >
              <line
                x1={opStartX}
                y1={opStartZ}
                x2={opEndX}
                y2={opEndZ}
                stroke="#0f172a"
                strokeWidth={wall.thicknessCm + 2}
              />
              <line
                x1={opStartX}
                y1={opStartZ}
                x2={opEndX}
                y2={opEndZ}
                stroke={isSelected ? '#38bdf8' : '#7dd3fc'}
                strokeWidth={Math.max(4, wall.thicknessCm * 0.45)}
              />
            </g>
          );
        }

        if (op.type === 'passage') {
          const halfThick = wall.thicknessCm / 2;
          const nx = geom.normal.x * halfThick;
          const nz = geom.normal.z * halfThick;
          return (
            <g
              key={op.id}
              data-opening-id={op.id}
              data-opening-type={op.type}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                selectEntity(op.id, 'opening');
              }}
            >
              <line
                x1={opStartX}
                y1={opStartZ}
                x2={opEndX}
                y2={opEndZ}
                stroke="#0f172a"
                strokeWidth={wall.thicknessCm + 2}
              />
              <line
                x1={opStartX - nx}
                y1={opStartZ - nz}
                x2={opEndX - nx}
                y2={opEndZ - nz}
                stroke={isSelected ? '#38bdf8' : '#94a3b8'}
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
              <line
                x1={opStartX + nx}
                y1={opStartZ + nz}
                x2={opEndX + nx}
                y2={opEndZ + nz}
                stroke={isSelected ? '#38bdf8' : '#94a3b8'}
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
            </g>
          );
        }

        if (op.type === 'sliding-door') {
          const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
          const slideRight = doorHingeOnRight(op.swingDirection);
          const trackOffset = (wall.thicknessCm * 0.42) * swingSign;
          const nx = geom.normal.x * trackOffset;
          const nz = geom.normal.z * trackOffset;
          const leafLen = op.widthCm * 0.65;
          const leafStartX = slideRight
            ? opEndX - geom.tangent.x * leafLen
            : opStartX;
          const leafStartZ = slideRight
            ? opEndZ - geom.tangent.z * leafLen
            : opStartZ;
          const leafEndX = slideRight
            ? opEndX
            : opStartX + geom.tangent.x * leafLen;
          const leafEndZ = slideRight
            ? opEndZ
            : opStartZ + geom.tangent.z * leafLen;

          return (
            <g
              key={op.id}
              data-opening-id={op.id}
              data-opening-type={op.type}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                selectEntity(op.id, 'opening');
              }}
            >
              <line
                x1={opStartX}
                y1={opStartZ}
                x2={opEndX}
                y2={opEndZ}
                stroke="#1e293b"
                strokeWidth={wall.thicknessCm + 2}
              />
              {/* Guide track line */}
              <line
                x1={opStartX + nx}
                y1={opStartZ + nz}
                x2={opEndX + nx}
                y2={opEndZ + nz}
                stroke={isSelected ? '#fbbf24' : 'rgba(245, 158, 11, 0.5)'}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
              {/* Parallel sliding door leaf */}
              <line
                x1={leafStartX + nx}
                y1={leafStartZ + nz}
                x2={leafEndX + nx}
                y2={leafEndZ + nz}
                stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                strokeWidth={4}
                strokeLinecap="round"
              />
            </g>
          );
        }

        const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
        const hingeOnRight = doorHingeOnRight(op.swingDirection);

        const hingeX = hingeOnRight ? opEndX : opStartX;
        const hingeZ = hingeOnRight ? opEndZ : opStartZ;
        const latchClosedX = hingeOnRight ? opStartX : opEndX;
        const latchClosedZ = hingeOnRight ? opStartZ : opEndZ;
        const leafOpenX = hingeX + geom.normal.x * swingSign * op.widthCm;
        const leafOpenZ = hingeZ + geom.normal.z * swingSign * op.widthCm;

        return (
          <g
            key={op.id}
            data-opening-id={op.id}
            data-opening-type={op.type}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              selectEntity(op.id, 'opening');
            }}
          >
            <line
              x1={opStartX}
              y1={opStartZ}
              x2={opEndX}
              y2={opEndZ}
              stroke="#1e293b"
              strokeWidth={wall.thicknessCm + 2}
            />
            {op.type === 'balcony-door' && (
              <line
                x1={opStartX}
                y1={opStartZ}
                x2={opEndX}
                y2={opEndZ}
                stroke={isSelected ? '#38bdf8' : '#7dd3fc'}
                strokeWidth={Math.max(3, wall.thicknessCm * 0.35)}
              />
            )}
            <polygon
              points={doorLeafPlanPoints(
                hingeX,
                hingeZ,
                leafOpenX,
                leafOpenZ,
                geom.tangent.x,
                geom.tangent.z
              )}
              fill={
                op.type === 'balcony-door'
                  ? isSelected
                    ? '#38bdf8'
                    : '#0ea5e9'
                  : isSelected
                  ? '#fbbf24'
                  : '#f59e0b'
              }
              stroke={
                op.type === 'balcony-door'
                  ? '#0284c7'
                  : isSelected
                  ? '#b45309'
                  : '#c2410c'
              }
              strokeWidth={0.6}
            />
            <path
              d={`M ${latchClosedX} ${latchClosedZ} Q ${
                (latchClosedX + leafOpenX) / 2 +
                geom.normal.x * swingSign * (op.widthCm * 0.25)
              } ${
                (latchClosedZ + leafOpenZ) / 2 +
                geom.normal.z * swingSign * (op.widthCm * 0.25)
              } ${leafOpenX} ${leafOpenZ}`}
              fill="none"
              stroke={
                op.type === 'balcony-door'
                  ? isSelected
                    ? '#38bdf8'
                    : 'rgba(56, 189, 248, 0.7)'
                  : isSelected
                  ? '#fbbf24'
                  : 'rgba(245, 158, 11, 0.65)'
              }
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </g>
        );
      })}

      {/* Furniture Items (2D Top-Down with Compound Geometry & Collision Feedback) */}
      {furniture.map((item) => {
        const report = collisionReports[item.id];
        const hasCollision = report?.hasCollision ?? false;
        const hasClearanceBlocked =
          report?.issues.some((i) => i.type === 'clearance-blocked') ?? false;
        const isSelected =
          selectedType === 'furniture' && selectedId === item.id;
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
              selectEntity(item.id, 'furniture');
              const pt = clientToWorldCm(e.clientX, e.clientY);
              setDragState({
                type: 'furniture',
                furnitureId: item.id,
                offsetX: pt.x - item.x,
                offsetZ: pt.z - item.z,
              });
            }}
          >
            {/* Clearance zone footprint (Auszugszone) */}
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

            {/* Compound or specialized 2D furniture footprint */}
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

            {/* Bed headboard & pillows detail */}
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

            {/* Front orientation edge indicator */}
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

      {/* 2D Ergonomie- & Laufwege-Heatmap Overlay */}
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
                  <rect
                    x={-34}
                    y={-10}
                    width={68}
                    height={20}
                    rx={8}
                    fill={color}
                  />
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
        </g>
      )}

      {/* Active Wall Drawing Preview */}
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
              x={(dragState.startX + dragState.currentX) / 2}
              y={(dragState.startZ + dragState.currentZ) / 2 - 14}
              textAnchor="middle"
              fill={isOrtho ? '#34d399' : '#a5b4fc'}
              fontSize="12"
              fontWeight={700}
            >
              {lengthCm} cm{isOrtho ? ` (${orthoCheck.snappedAngleDeg}°)` : ''}
            </text>
          </g>
        );
      })()}

      {/* Active Measure Tool Tape Visualization */}
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

      {/* Active Scale Calibration Graphics */}
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

      {/* Smart Alignment Guides (Paket 3C) */}
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

      {/* Draggable Corner Handles */}
      {corners.map((c) => {
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
}
