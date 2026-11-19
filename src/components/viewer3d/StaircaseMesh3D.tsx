import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { computeStairGeometry } from '../../core/stairsMath';
import type { BuildingLevel, Staircase } from '../../core/types';

export const StaircaseMesh3D: React.FC<{
  stair: Staircase;
  fromLevel?: BuildingLevel;
  toLevel?: BuildingLevel;
  isSelected: boolean;
  onStartDrag: (stair: Staircase, hitPoint: THREE.Vector3) => void;
}> = React.memo(function StaircaseMesh3D({
  stair,
  fromLevel,
  toLevel,
  isSelected,
  onStartDrag,
}) {
  const geom = useMemo(
    () => computeStairGeometry(stair, fromLevel, toLevel),
    [stair, fromLevel, toLevel]
  );

  const treadColor = isSelected ? '#38bdf8' : stair.color ?? '#cbd5e1';
  const riserColor = isSelected ? '#0284c7' : '#94a3b8';

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onStartDrag(stair, e.point);
  };

  return (
    <group name={`staircase-${stair.id}`} onPointerDown={handlePointerDown}>
      {geom.steps.map((step, idx) => {
        const h = Math.max(2, step.yTopCm - step.yBottomCm);
        const treadThickness = 4;
        const riserH = Math.max(2, step.yTopCm - treadThickness);
        return (
          <group
            key={`step-${idx}`}
            position={[step.x, 0, step.z]}
            rotation={[0, (step.rotationYDeg * Math.PI) / 180, 0]}
          >
            {/* Support stringer/riser volume */}
            <mesh
              position={[0, Math.max(1, step.yBottomCm + (h - treadThickness) / 2), 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[
                  Math.max(4, step.widthCm - 2),
                  Math.max(2, h - treadThickness),
                  Math.max(4, step.depthCm - 1),
                ]}
              />
              <meshStandardMaterial color={riserColor} roughness={0.6} />
            </mesh>
            {/* Tread cap */}
            <mesh
              position={[0, step.yTopCm - treadThickness / 2, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[step.widthCm, treadThickness, step.depthCm + 2]} />
              <meshStandardMaterial color={treadColor} roughness={0.42} metalness={0.05} />
            </mesh>
            {/* Lower step base block only if bottom */}
            {idx === 0 && riserH < 0 && null}
          </group>
        );
      })}

      {geom.landings.map((landing, idx) => {
        const thickness = 18;
        return (
          <mesh
            key={`landing-${idx}`}
            position={[landing.x, landing.yTopCm - thickness / 2, landing.z]}
            rotation={[0, (landing.rotationYDeg * Math.PI) / 180, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[landing.widthCm, thickness, landing.depthCm]} />
            <meshStandardMaterial color={treadColor} roughness={0.5} />
          </mesh>
        );
      })}

      {geom.railingPosts.map((post, idx) => (
        <mesh
          key={`post-${idx}`}
          position={[post.x, post.yBottomCm + post.heightCm / 2, post.z]}
          castShadow
        >
          <cylinderGeometry args={[1.6, 1.6, post.heightCm, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
});
