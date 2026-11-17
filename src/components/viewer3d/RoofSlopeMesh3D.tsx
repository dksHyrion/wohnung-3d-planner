import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { computeRoofSlopeQuad3D, type RoofSlopePlane } from '../../core/roofSlopeMath';

export const RoofSlopeMesh3D: React.FC<{
  plane: RoofSlopePlane;
  maxCeilingCm: number;
  theme: 'studio' | 'blueprint';
}> = ({ plane, maxCeilingCm, theme }) => {
  const quad = useMemo(
    () => computeRoofSlopeQuad3D(plane, maxCeilingCm),
    [plane, maxCeilingCm]
  );

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const [a, b, c, d] = quad.corners;
    const vertices = new Float32Array([
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      a.x, a.y, a.z,
      c.x, c.y, c.z,
      d.x, d.y, d.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, [quad]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const outlinePoints = useMemo<[number, number, number][]>(
    () => [
      [quad.corners[0].x, quad.corners[0].y, quad.corners[0].z],
      [quad.corners[1].x, quad.corners[1].y, quad.corners[1].z],
      [quad.corners[2].x, quad.corners[2].y, quad.corners[2].z],
      [quad.corners[3].x, quad.corners[3].y, quad.corners[3].z],
      [quad.corners[0].x, quad.corners[0].y, quad.corners[0].z],
    ],
    [quad]
  );

  return (
    <group name={`roof-slope-${plane.slopeId}`}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={theme === 'studio' ? '#e2e8f0' : '#38bdf8'}
          transparent
          opacity={theme === 'studio' ? 0.24 : 0.18}
          roughness={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Line
        points={outlinePoints}
        color={theme === 'studio' ? '#64748b' : '#38bdf8'}
        lineWidth={1.5}
        dashed
        dashSize={12}
        gapSize={6}
      />
    </group>
  );
};
