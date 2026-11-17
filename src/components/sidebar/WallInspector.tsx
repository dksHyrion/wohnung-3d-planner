import React from 'react';
import { DoorOpen, AppWindow, Sliders, Trash2, Scissors } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getWallGeometry } from '../../core/wallMath';
import { createDefaultFixture, WALL_FIXTURE_TYPES } from '../../core/mepFixtures';
import type { Wall } from '../../core/types';

export function WallInspector({ selectedWall }: { selectedWall: Wall }) {
  const { t } = useTranslation();
  const idLength = React.useId();
  const idThickness = React.useId();
  const idHeight = React.useId();

  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const updateWallLengthCm = useFloorplanStore((s) => s.updateWallLengthCm);
  const updateWallProps = useFloorplanStore((s) => s.updateWallProps);
  const splitWallAt = useFloorplanStore((s) => s.splitWallAt);
  const addOpening = useFloorplanStore((s) => s.addOpening);
  const removeOpening = useFloorplanStore((s) => s.removeOpening);
  const addRoofSlope = useFloorplanStore((s) => s.addRoofSlope);
  const updateRoofSlope = useFloorplanStore((s) => s.updateRoofSlope);
  const removeRoofSlope = useFloorplanStore((s) => s.removeRoofSlope);
  const addFixture = useFloorplanStore((s) => s.addFixture);
  const removeFixture = useFloorplanStore((s) => s.removeFixture);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);
  const idKnee = React.useId();
  const idPitch = React.useId();
  const wallRoofSlope = roofSlopes.find((s) => s.wallId === selectedWall.id) ?? null;
  const wallFixtures = fixtures.filter((fx) => fx.wallId === selectedWall.id);

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

        <button
          type="button"
          className="btn btn-outline"
          disabled={lengthCm < 20}
          title={t('inspector.wall.splitWallTitle')}
          onClick={() => splitWallAt(selectedWall.id)}
        >
          <Scissors size={14} />
          <span>{t('inspector.wall.splitWall')}</span>
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
      <div
        style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="form-label" style={{ margin: 0 }}>
            {t('inspector.wall.roofSlopeTitle')}
          </span>
          {wallRoofSlope ? (
            <button
              type="button"
              className="btn btn-danger"
              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
              onClick={() => removeRoofSlope(wallRoofSlope.id)}
            >
              {t('inspector.wall.removeRoofSlope')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
              onClick={() =>
                addRoofSlope({
                  wallId: selectedWall.id,
                  kneeWallHeightCm: 100,
                  pitchDeg: 40,
                })
              }
            >
              {t('inspector.wall.addRoofSlope')}
            </button>
          )}
        </div>

        {wallRoofSlope && (
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={idKnee} className="form-label">
                {t('inspector.wall.kneeWallHeight')}
              </label>
              <input
                id={idKnee}
                type="number"
                min={0}
                max={250}
                step={5}
                className="number-input"
                value={wallRoofSlope.kneeWallHeightCm}
                onChange={(e) =>
                  updateRoofSlope(wallRoofSlope.id, {
                    kneeWallHeightCm: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor={idPitch} className="form-label">
                {t('inspector.wall.pitchDeg')}
              </label>
              <input
                id={idPitch}
                type="number"
                min={5}
                max={75}
                step={1}
                className="number-input"
                value={wallRoofSlope.pitchDeg}
                onChange={(e) =>
                  updateRoofSlope(wallRoofSlope.id, {
                    pitchDeg: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field full">
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.72rem' }}
                onClick={() =>
                  updateRoofSlope(wallRoofSlope.id, {
                    side: wallRoofSlope.side === 'neg' ? 'pos' : 'neg',
                  })
                }
              >
                {t('inspector.wall.flipRoofSide')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Haustechnik / MEP Fixtures on this Wall */}
      <div
        style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <span className="form-label" style={{ margin: 0 }}>
          {t('inspector.wall.mepTitle')}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {WALL_FIXTURE_TYPES.map((ft) => (
            <button
              key={ft}
              type="button"
              className="btn btn-outline"
              style={{ padding: '2px 6px', fontSize: '0.68rem' }}
              onClick={() =>
                addFixture(createDefaultFixture(ft, selectedWall.id, lengthCm))
              }
            >
              + {t(`inspector.fixture.types.${ft}`)}
            </button>
          ))}
        </div>

        {wallFixtures.length > 0 && (
          <div className="catalog-grid">
            {wallFixtures.map((fx) => (
              <div
                key={fx.id}
                className="catalog-item-btn"
                style={{ padding: '4px 8px' }}
              >
                <button
                  type="button"
                  onClick={() => selectEntity(fx.id, 'fixture')}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {t(`inspector.fixture.types.${fx.type}`)} ({fx.widthCm}×{fx.depthCm} cm)
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '3px 6px' }}
                  onClick={() => removeFixture(fx.id)}
                  title={t('inspector.fixture.deleteFixture')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
