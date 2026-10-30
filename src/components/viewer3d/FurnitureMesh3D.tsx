import React from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Html, Edges } from '@react-three/drei';
import { FurnitureItem, FurnitureCollisionReport } from '../../core/types';
import { ArchitecturalFurniture3D } from './furniture/ArchitecturalFurniture3D';

export interface FurnitureMesh3DProps {
  item: FurnitureItem;
  report?: FurnitureCollisionReport;
  isSelected: boolean;
  onStartDrag: (
    item: FurnitureItem,
    hitPoint: THREE.Vector3,
    e: ThreeEvent<PointerEvent>
  ) => void;
}

export const FurnitureMesh3D: React.FC<FurnitureMesh3DProps> = ({
  item,
  report,
  isSelected,
  onStartDrag,
}) => {
  const hasCollision = report?.hasCollision ?? false;
  const hasClearanceBlocked =
    report?.issues.some((i) => i.type === 'clearance-blocked') ?? false;
  const showClearanceZone = Boolean(
    item.clearanceZoneCm &&
      item.clearanceZoneCm > 0 &&
      (isSelected || hasClearanceBlocked)
  );
  const centerY = item.elevationCm + item.heightCm / 2;
  const rotY = THREE.MathUtils.degToRad(item.rotationYDeg);

  return (
    <group
      position={[item.x, centerY, item.z]}
      rotation={[0, rotY, 0]}
    >
      <ArchitecturalFurniture3D
        item={item}
        hasCollision={hasCollision}
        isSelected={isSelected}
      />

      {/* 3D Clearance zone ground plane rectangle and outline */}
      {showClearanceZone && (
        <mesh
          position={[
            0,
            -item.heightCm / 2 + 0.1,
            item.depthCm / 2 + item.clearanceZoneCm! / 2,
          ]}
          raycast={() => null}
        >
          <boxGeometry args={[item.widthCm, 0.2, item.clearanceZoneCm!]} />
          <meshBasicMaterial
            color={hasClearanceBlocked ? '#ef4444' : '#38bdf8'}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
          <Edges
            scale={1.002}
            threshold={15}
            color={hasClearanceBlocked ? '#ef4444' : '#38bdf8'}
          />
        </mesh>
      )}

      {/* Invisible bounding hit mesh for ultra-fast 12-triangle pointer raycasting (no child recursion) */}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartDrag(item, e.point, e);
        }}
      >
        <boxGeometry
          args={[
            item.widthCm,
            Math.max(item.heightCm, 12),
            Math.max(item.depthCm, 6),
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Floating 3D HTML badge for selected or colliding furniture */}
      {(isSelected || hasCollision) && (
        <Html
          position={[0, item.heightCm / 2 + 18, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: hasCollision
                ? 'rgba(127, 29, 29, 0.94)'
                : 'rgba(15, 23, 42, 0.92)',
              border: `1px solid ${hasCollision ? '#ef4444' : '#38bdf8'}`,
              color: '#f8fafc',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontWeight: 700 }}>{item.name}</div>
            <div style={{ color: '#cbd5e1', fontSize: '10px' }}>
              {item.widthCm} × {item.heightCm} × {item.depthCm} cm (B×H×T)
            </div>
            {report &&
              report.clearancesCm.leftCm !== null &&
              report.clearancesCm.rightCm !== null && (
                <div style={{ color: '#93c5fd', fontSize: '10px' }}>
                  Wandabstand L: {report.clearancesCm.leftCm} cm | R:{' '}
                  {report.clearancesCm.rightCm} cm
                </div>
              )}
            {hasCollision && report?.issues[0] && (
              <div
                style={{
                  color: '#fecaca',
                  fontWeight: 600,
                  marginTop: '2px',
                  fontSize: '10px',
                }}
              >
                ⚠ {report.issues[0].message}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};
