import React from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import {
  PASSAGE_SEVERITY_COLORS,
  formatPassageBadgeLabel,
  getPassageBadgeTextColor,
} from '../../core/ergonomicsEngine';

export const PassageClearance3D: React.FC = () => {
  const showPassageHeatmap = useFloorplanStore((s) => s.showPassageHeatmap);
  const passageReport = useFloorplanStore((s) => s.passageReport);

  if (!showPassageHeatmap || !passageReport) {
    return null;
  }

  return (
    <group name="passage-clearance-3d">
      {passageReport.passages.map((p) => {
        const dx = p.point2.x - p.point1.x;
        const dz = p.point2.z - p.point1.z;
        const len = Math.max(1, Math.hypot(dx, dz));
        const angle = Math.atan2(dz, dx);
        const midX = (p.point1.x + p.point2.x) / 2;
        const midZ = (p.point1.z + p.point2.z) / 2;
        const color = PASSAGE_SEVERITY_COLORS[p.severity];
        const label = formatPassageBadgeLabel(p.severity, p.clearanceCm);
        const textColor = getPassageBadgeTextColor(p.severity);

        return (
          <group key={p.id} name={`passage-${p.id}`}>
            <mesh position={[midX, 0.4, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
              <planeGeometry args={[len, 2]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <Html
              position={[midX, 4, midZ]}
              center
              distanceFactor={140}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  background: color,
                  color: textColor,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.4)',
                }}
              >
                {label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
