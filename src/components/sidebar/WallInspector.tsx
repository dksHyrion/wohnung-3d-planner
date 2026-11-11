import React from 'react';
import { DoorOpen, AppWindow, Sliders, Trash2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getWallGeometry } from '../../core/wallMath';
import type { Wall } from '../../core/types';

export function WallInspector({ selectedWall }: { selectedWall: Wall }) {
  const { t } = useTranslation();
  const idLength = React.useId();
  const idThickness = React.useId();
  const idHeight = React.useId();

  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const updateWallLengthCm = useFloorplanStore((s) => s.updateWallLengthCm);
  const updateWallProps = useFloorplanStore((s) => s.updateWallProps);
  const addOpening = useFloorplanStore((s) => s.addOpening);
  const removeOpening = useFloorplanStore((s) => s.removeOpening);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const start = corners.find((c) => c.id === selectedWall.startCornerId);
  const end = corners.find((c) => c.id === selectedWall.endCornerId);
  const lengthCm =
    start && end ? Math.round(getWallGeometry(start, end).lengthCm) : 100;
  const wallOpenings = openings.filter(
    (o) => o.wallId === selectedWall.id
  );
  const connectedWallIds = walls
    .filter(
      (w) =>
        w.id !== selectedWall.id &&
        (w.startCornerId === selectedWall.endCornerId ||
          w.endCornerId === selectedWall.endCornerId)
    )
    .map((w) => w.id);

  return (
    <section className="sidebar-section">
      <div className="sidebar-title">
        <span>{t('inspector.wall.titleWithId', { id: selectedWall.id })}</span>
        <Sliders size={14} />
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor={idLength} className="form-label">{t('inspector.wall.lengthLabel')}</label>
          <input
            id={idLength}
            type="number"
            min={10}
            step={1}
            className="number-input"
            value={lengthCm}
            onChange={(e) =>
              updateWallLengthCm(selectedWall.id, Number(e.target.value))
            }
          />
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
            {t('inspector.wall.endpointInfo', {
              endCornerId: selectedWall.endCornerId,
              connectedWalls: connectedWallIds.join(', ') || t('inspector.wall.none'),
            })}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={idThickness} className="form-label">{t('inspector.wall.thicknessLabel')}</label>
          <input
            id={idThickness}
            type="number"
            min={5}
            step={1}
            className="number-input"
            value={selectedWall.thicknessCm}
            onChange={(e) =>
              updateWallProps(selectedWall.id, {
                thicknessCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idHeight} className="form-label">{t('inspector.wall.heightLabel')}</label>
          <input
            id={idHeight}
            type="number"
            min={50}
            step={5}
            className="number-input"
            value={selectedWall.heightCm}
            onChange={(e) =>
              updateWallProps(selectedWall.id, {
                heightCm: Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1 }}
          onClick={() =>
            addOpening({
              wallId: selectedWall.id,
              type: 'door',
              offsetFromStartCm: Math.max(10, Math.round(lengthCm / 2 - 43)),
              widthCm: 86,
              heightCm: 200,
              sillHeightCm: 0,
              swingDirection: 'in-left',
            })
          }
        >
          <DoorOpen size={14} />
          <span>{t('inspector.wall.addDoor')}</span>
        </button>

        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1 }}
          onClick={() =>
            addOpening({
              wallId: selectedWall.id,
              type: 'window',
              offsetFromStartCm: Math.max(10, Math.round(lengthCm / 2 - 60)),
              widthCm: 120,
              heightCm: 130,
              sillHeightCm: 90,
            })
          }
        >
          <AppWindow size={14} />
          <span>{t('inspector.wall.addWindow')}</span>
        </button>
      </div>

      {wallOpenings.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            marginTop: '4px',
          }}
        >
          <div className="form-label">
            {t('inspector.wall.openingsOnWall', { count: wallOpenings.length })}
          </div>
          <div className="catalog-grid">
            {wallOpenings.map((op) => (
              <div
                key={op.id}
                className="catalog-item-btn"
                style={{ padding: '6px 8px' }}
              >
                <button
                  type="button"
                  onClick={() => selectEntity(op.id, 'opening')}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                    {t(`inspector.opening.types.${op.type}`)} ({op.widthCm}×
                    {op.heightCm} cm)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {t('inspector.wall.openingOffset', { offset: op.offsetFromStartCm })}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '4px 6px' }}
                  onClick={() => removeOpening(op.id)}
                  title={t('inspector.wall.deleteOpening')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
