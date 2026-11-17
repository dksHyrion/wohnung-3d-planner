import React from 'react';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import type { CanvasViewBox } from '../../../core/canvas2dMath';
import type { RoomPolygon } from '../../../core/types';
import type { CanvasDragState } from '../FloorplanSvg2D';

export const GridAndBackgroundLayer = React.memo(function GridAndBackgroundLayer({
  viewBox,
  setDragState,
  clientToWorldCm,
}: {
  viewBox: CanvasViewBox;
  setDragState: React.Dispatch<React.SetStateAction<CanvasDragState>>;
  clientToWorldCm: (clientX: number, clientY: number) => { x: number; z: number };
}) {
  const backgroundImage = useFloorplanStore((s) => s.backgroundImage);
  const activeTool = useFloorplanStore((s) => s.activeTool);

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
    </>
  );
});

export const RoomsLayer = React.memo(function RoomsLayer({
  roomPolygons,
}: {
  roomPolygons: RoomPolygon[];
}) {
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const language = useFloorplanStore((s) => s.language);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  return (
    <>
      {roomPolygons.map((room, idx) => {
        const isRoomSelected =
          selectedType === 'room' && selectedId === room.id;
        const fill = isRoomSelected
          ? 'rgba(56, 189, 248, 0.24)'
          : idx % 2 === 0
          ? 'rgba(30, 41, 59, 0.72)'
          : 'rgba(15, 118, 110, 0.22)';
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
          <g key={room.id} data-bg="true" data-room-id={room.id}>
            {room.holes && room.holes.length > 0 ? (
              <path
                data-bg="true"
                fillRule="evenodd"
                d={[
                  `M ${room.corners.map((c) => `${c.x},${c.z}`).join(' L ')} Z`,
                  ...room.holes.map(
                    (hole) => `M ${hole.map((c) => `${c.x},${c.z}`).join(' L ')} Z`
                  ),
                ].join(' ')}
                fill={fill}
                stroke={isRoomSelected ? '#38bdf8' : 'none'}
                strokeWidth={isRoomSelected ? 2 : 0}
              />
            ) : (
              <polygon
                data-bg="true"
                points={room.corners.map((c) => `${c.x},${c.z}`).join(' ')}
                fill={fill}
                stroke={isRoomSelected ? '#38bdf8' : 'none'}
                strokeWidth={isRoomSelected ? 2 : 0}
              />
            )}
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
            </g>
          </g>
        );
      })}
    </>
  );
});
