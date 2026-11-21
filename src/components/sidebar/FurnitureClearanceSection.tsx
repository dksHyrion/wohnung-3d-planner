import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  computeFurnitureClearanceCm,
  computeFurnitureToWallDistanceCm,
} from '../../core/measureMath';
import { getEntityLevelId } from '../../core/levels';
import type { FurnitureCollisionReport, FurnitureItem } from '../../core/types';

export interface FurnitureClearanceSectionProps {
  selectedFurniture: FurnitureItem;
  report?: FurnitureCollisionReport;
}

export const FurnitureClearanceSection: React.FC<
  FurnitureClearanceSectionProps
> = ({ selectedFurniture, report }) => {
  const { t } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const furniture = useFloorplanStore((s) => s.furniture);

  const hasCollision = report?.hasCollision ?? false;
  const itemLevelId = getEntityLevelId(selectedFurniture);
  const levelCorners = corners.filter((c) => getEntityLevelId(c) === itemLevelId);
  const levelWalls = walls.filter((w) => getEntityLevelId(w) === itemLevelId);

  const otherClearances = furniture
    .filter(
      (f) => f.id !== selectedFurniture.id && getEntityLevelId(f) === itemLevelId
    )
    .map((other) => ({
      other,
      ...computeFurnitureClearanceCm(selectedFurniture, other),
    }))
    .sort((a, b) => a.clearanceCm - b.clearanceCm)
    .slice(0, 3);

  const wallDistances = levelWalls
    .map((w) => ({
      wall: w,
      distanceCm: computeFurnitureToWallDistanceCm(
        selectedFurniture,
        w,
        levelCorners
      ),
    }))
    .sort((a, b) => a.distanceCm - b.distanceCm)
    .slice(0, 2);

  return (
    <>
      <div className={`diagnostic-box ${hasCollision ? 'error' : 'ok'}`}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
          }}
        >
          {hasCollision ? (
            <>
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{t('inspector.furniture.collisionDetected')}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{t('inspector.furniture.fitsWithoutConflict')}</span>
            </>
          )}
        </div>

        {report &&
          report.clearancesCm.leftCm !== null &&
          report.clearancesCm.rightCm !== null && (
            <div style={{ fontSize: '0.74rem', opacity: 0.95 }}>
              {t('inspector.furniture.wallClearance', {
                left: report.clearancesCm.leftCm,
                right: report.clearancesCm.rightCm,
              })}
            </div>
          )}

        {hasCollision &&
          report?.issues.map((issue, idx) => (
            <div key={idx} style={{ fontSize: '0.75rem' }}>
              • {issue.message}
            </div>
          ))}
      </div>

      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '8px',
          padding: '8px 10px',
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          fontSize: '0.74rem',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span>{t('inspector.furniture.clearanceDistances')}</span>
        </div>
        {otherClearances.length === 0 && wallDistances.length === 0 && (
          <div style={{ color: '#94a3b8' }}>
            {t('inspector.furniture.noOtherObjects')}
          </div>
        )}
        {otherClearances.map(({ other, clearanceCm, isOverlapping }) => (
          <div
            key={other.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#e2e8f0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '140px',
              }}
            >
              {t('inspector.furniture.distanceTo', { name: other.name })}
            </span>
            <b
              style={{
                color: isOverlapping
                  ? '#ef4444'
                  : clearanceCm < 60
                  ? '#f59e0b'
                  : '#34d399',
              }}
            >
              {isOverlapping
                ? t('inspector.furniture.collisionZero')
                : `${clearanceCm} cm`}
            </b>
          </div>
        ))}
        {wallDistances.map(({ wall, distanceCm }) => (
          <div
            key={wall.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#94a3b8',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{t('inspector.furniture.distanceToWall', { id: wall.id })}</span>
            <b style={{ color: '#cbd5e1' }}>{distanceCm} cm</b>
          </div>
        ))}
      </div>
    </>
  );
};
