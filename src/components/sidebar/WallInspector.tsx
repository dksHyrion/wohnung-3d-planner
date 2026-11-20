import React from 'react';
import {
  DoorOpen,
  AppWindow,
  Sliders,
  Trash2,
  Scissors,
  Paintbrush,
  ArrowLeftRight,
} from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getWallGeometry } from '../../core/wallMath';
import { createDefaultFixture, WALL_FIXTURE_TYPES } from '../../core/mepFixtures';
import { WALL_FINISH_TYPES } from '../../core/materials/wallFinishes';
import type { Wall, WallFinishType } from '../../core/types';

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
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);
  const colorUndoPushedRef = React.useRef(false);
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

      {/* Per-Side Wall Finishes (pos / neg) */}
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
          <span
            className="form-label"
            style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Paintbrush size={12} />
            <span>{t('inspector.wall.finishesTitle')}</span>
          </span>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '2px 7px', fontSize: '0.68rem' }}
            onClick={() =>
              updateWallProps(selectedWall.id, {
                posFinish: selectedWall.negFinish ?? { finish: 'plaster' },
                negFinish: selectedWall.posFinish ?? { finish: 'plaster' },
              })
            }
          >
            <ArrowLeftRight size={11} />
            <span>{t('inspector.wall.swapFinishes')}</span>
          </button>
        </div>

        <div className="form-grid">
          {(['pos', 'neg'] as const).map((side) => {
            const current = side === 'pos' ? selectedWall.posFinish : selectedWall.negFinish;
            const finishType = current?.finish ?? 'plaster';
            const patchKey = side === 'pos' ? 'posFinish' : 'negFinish';
            return (
              <div
                key={side}
                className="form-field"
                data-testid={`wall-finish-${side}`}
              >
                <label className="form-label">
                  {side === 'pos'
                    ? t('inspector.wall.posSide')
                    : t('inspector.wall.negSide')}
                </label>
                <select
                  className="select-input"
                  value={finishType}
                  onChange={(e) => {
                    const nextType = e.target.value as WallFinishType;
                    updateWallProps(selectedWall.id, {
                      [patchKey]:
                        nextType === 'plaster'
                          ? { finish: 'plaster' }
                          : {
                              finish: nextType,
                              color:
                                nextType === 'accent-paint'
                                  ? current?.color ?? '#475569'
                                  : current?.color,
                            },
                    });
                  }}
                >
                  {WALL_FINISH_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {t(`inspector.wall.finishes.${ft}`)}
                    </option>
                  ))}
                </select>
                {finishType !== 'plaster' && (
                  <input
                    type="color"
                    aria-label={`${side}-${t('inspector.wall.finishColor')}`}
                    className="number-input"
                    style={{ height: '26px', padding: '1px 3px', marginTop: '4px' }}
                    value={current?.color ?? (finishType === 'accent-paint' ? '#475569' : '#ffffff')}
                    onPointerDown={() => {
                      if (!colorUndoPushedRef.current) {
                        pushUndoSnapshot();
                        colorUndoPushedRef.current = true;
                      }
                    }}
                    onBlur={() => {
                      colorUndoPushedRef.current = false;
                    }}
                    onChange={(e) => {
                      if (!colorUndoPushedRef.current) {
                        pushUndoSnapshot();
                        colorUndoPushedRef.current = true;
                      }
                      updateWallProps(
                        selectedWall.id,
                        {
                          [patchKey]: {
                            finish: finishType,
                            color: e.target.value,
                          },
                        },
                        { recordHistory: false }
                      );
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
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
