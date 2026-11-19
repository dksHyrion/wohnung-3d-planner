import React from 'react';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import { getWallGeometry, applyRoomLabels, computeFloorPolygons } from '../../../core/wallMath';
import { doorHingeOnRight, doorLeafPlanPoints, doorSwingsInward } from '../../../core/doorLeaf';
import { computeWallFixtureBoxes } from '../../../core/mepFixtures';
import { getEntityLevelId } from '../../../core/levels';
import type { Corner, Wall } from '../../../core/types';
import type { CanvasDragState } from '../FloorplanSvg2D';

export const RugsLayer = React.memo(function RugsLayer({
  setDragState,
  clientToWorldCm,
}: {
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
}) {
  const rugs = useFloorplanStore((s) => s.rugs);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const levelRugs = React.useMemo(
    () => rugs.filter((r) => getEntityLevelId(r) === activeLevelId),
    [rugs, activeLevelId]
  );

  return (
    <>
      {levelRugs.map((rug) => {
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
    </>
  );
});

export const WallsAndOpeningsLayer = React.memo(function WallsAndOpeningsLayer({
  cornerMap,
  handleWallClick,
}: {
  cornerMap: Map<string, Corner>;
  handleWallClick: (event: React.MouseEvent, wall: Wall) => void;
}) {
  const allWalls = useFloorplanStore((s) => s.walls);
  const allCorners = useFloorplanStore((s) => s.corners);
  const allRoomLabels = useFloorplanStore((s) => s.roomLabels);
  const allOpenings = useFloorplanStore((s) => s.openings);
  const allFixtures = useFloorplanStore((s) => s.fixtures);
  const levels = useFloorplanStore((s) => s.levels);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const showGhostBelow2D = useFloorplanStore((s) => s.showGhostBelow2D);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const corners = React.useMemo(
    () => allCorners.filter((c) => getEntityLevelId(c) === activeLevelId),
    [allCorners, activeLevelId]
  );
  const walls = React.useMemo(
    () => allWalls.filter((w) => getEntityLevelId(w) === activeLevelId),
    [allWalls, activeLevelId]
  );
  const roomLabels = React.useMemo(
    () => allRoomLabels.filter((l) => getEntityLevelId(l) === activeLevelId),
    [allRoomLabels, activeLevelId]
  );
  const openings = React.useMemo(
    () => allOpenings.filter((o) => getEntityLevelId(o) === activeLevelId),
    [allOpenings, activeLevelId]
  );
  const fixtures = React.useMemo(
    () => allFixtures.filter((fx) => getEntityLevelId(fx) === activeLevelId),
    [allFixtures, activeLevelId]
  );

  const ghostBelowWalls = React.useMemo(() => {
    if (!showGhostBelow2D) return [];
    const active = levels.find((l) => l.id === activeLevelId);
    if (!active) return [];
    const below = levels.find((l) => l.index === active.index - 1);
    if (!below) return [];
    const belowCorners = new Map(
      allCorners.filter((c) => getEntityLevelId(c) === below.id).map((c) => [c.id, c])
    );
    return allWalls
      .filter((w) => getEntityLevelId(w) === below.id)
      .map((w) => {
        const s = belowCorners.get(w.startCornerId);
        const e = belowCorners.get(w.endCornerId);
        return s && e ? { wall: w, start: s, end: e } : null;
      })
      .filter((entry): entry is { wall: Wall; start: Corner; end: Corner } => entry !== null);
  }, [showGhostBelow2D, levels, activeLevelId, allCorners, allWalls]);

  const fixtureBoxes = React.useMemo(() => {
    if (!fixtures || fixtures.length === 0) return [];
    const rooms = applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels);
    return computeWallFixtureBoxes(corners, walls, fixtures, rooms);
  }, [corners, walls, fixtures, roomLabels]);

  return (
    <>
      {ghostBelowWalls.length > 0 && (
        <g data-testid="ghost-below-walls-2d" pointerEvents="none" opacity={0.28}>
          {ghostBelowWalls.map(({ wall, start, end }) => (
            <line
              key={`ghost-below-${wall.id}`}
              x1={start.x}
              y1={start.z}
              x2={end.x}
              y2={end.z}
              stroke="#94a3b8"
              strokeWidth={wall.thicknessCm}
              strokeDasharray="10 6"
              strokeLinecap="square"
            />
          ))}
        </g>
      )}
      {walls.map((wall) => {
        const start = cornerMap.get(wall.startCornerId);
        const end = cornerMap.get(wall.endCornerId);
        if (!start || !end) return null;

        const geom = getWallGeometry(start, end);
        const isSelected = selectedType === 'wall' && selectedId === wall.id;
        const labelX = geom.centerX - geom.normal.x * (wall.thicknessCm + 16);
        const labelZ = geom.centerZ - geom.normal.z * (wall.thicknessCm + 16);

        return (
          <g key={wall.id} data-wall-id={wall.id}>
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
          const trackOffset = wall.thicknessCm * 0.42 * swingSign;
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
              <line
                x1={opStartX + nx}
                y1={opStartZ + nz}
                x2={opEndX + nx}
                y2={opEndZ + nz}
                stroke={isSelected ? '#fbbf24' : 'rgba(245, 158, 11, 0.5)'}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
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

      {/* Wall-Mounted MEP Fixtures & Utility Shafts */}
      {fixtureBoxes.map((fx) => {
        const isSelected = selectedType === 'fixture' && selectedId === fx.fixtureId;
        const rotDeg = (fx.angleRad * 180) / Math.PI;
        const strokeCol = isSelected
          ? '#38bdf8'
          : fx.type === 'water-outlet'
          ? '#0284c7'
          : fx.type === 'switch'
          ? '#f59e0b'
          : fx.type === 'data-outlet'
          ? '#06b6d4'
          : '#e2e8f0';

        return (
          <g
            key={fx.fixtureId}
            data-fixture-id={fx.fixtureId}
            data-fixture-type={fx.type}
            transform={`translate(${fx.center.x}, ${fx.center.z}) rotate(${rotDeg})`}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              selectEntity(fx.fixtureId, 'fixture');
            }}
          >
            {fx.type === 'shaft' && (
              <g>
                <rect
                  x={-fx.widthCm / 2}
                  y={-fx.depthCm / 2}
                  width={fx.widthCm}
                  height={fx.depthCm}
                  fill={isSelected ? 'rgba(56, 189, 248, 0.35)' : '#475569'}
                  stroke={strokeCol}
                  strokeWidth={1.8}
                />
                <line
                  x1={-fx.widthCm / 2}
                  y1={-fx.depthCm / 2}
                  x2={fx.widthCm / 2}
                  y2={fx.depthCm / 2}
                  stroke={strokeCol}
                  strokeWidth={1.2}
                />
                <line
                  x1={fx.widthCm / 2}
                  y1={-fx.depthCm / 2}
                  x2={-fx.widthCm / 2}
                  y2={fx.depthCm / 2}
                  stroke={strokeCol}
                  strokeWidth={1.2}
                />
              </g>
            )}
            {fx.type === 'radiator' && (
              <g>
                <rect
                  x={-fx.widthCm / 2}
                  y={-fx.depthCm / 2}
                  width={fx.widthCm}
                  height={fx.depthCm}
                  rx={2}
                  fill={isSelected ? 'rgba(56, 189, 248, 0.28)' : 'rgba(226, 232, 240, 0.22)'}
                  stroke={strokeCol}
                  strokeWidth={1.5}
                />
                {[-0.35, -0.17, 0, 0.17, 0.35].map((ratio, idx) => (
                  <line
                    key={`rad-fin-${idx}`}
                    x1={fx.widthCm * ratio}
                    y1={-fx.depthCm / 2}
                    x2={fx.widthCm * ratio}
                    y2={fx.depthCm / 2}
                    stroke={strokeCol}
                    strokeWidth={1.1}
                  />
                ))}
              </g>
            )}
            {fx.type !== 'shaft' && fx.type !== 'radiator' && (
              <g>
                <rect
                  x={-Math.max(8, fx.widthCm / 2)}
                  y={-Math.max(4, fx.depthCm / 2)}
                  width={Math.max(16, fx.widthCm)}
                  height={Math.max(8, fx.depthCm)}
                  rx={2}
                  fill="#0f172a"
                  stroke={strokeCol}
                  strokeWidth={1.5}
                />
                <circle cx={0} cy={0} r={3.5} fill={strokeCol} />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
});
