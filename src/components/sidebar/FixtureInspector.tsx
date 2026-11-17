import React from 'react';
import { Trash2, Zap } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { WallFixture, WallFixtureType } from '../../core/types';
import { WALL_FIXTURE_TYPES } from '../../core/mepFixtures';
import { getWallGeometry } from '../../core/wallMath';

export function FixtureInspector({
  selectedFixture,
}: {
  selectedFixture: WallFixture;
}) {
  const { t } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const updateFixture = useFloorplanStore((s) => s.updateFixture);
  const removeFixture = useFloorplanStore((s) => s.removeFixture);

  const idType = React.useId();
  const idOffset = React.useId();
  const idWidth = React.useId();
  const idDepth = React.useId();
  const idHeight = React.useId();
  const idElevation = React.useId();

  const wall = walls.find((w) => w.id === selectedFixture.wallId);
  const start = wall ? corners.find((c) => c.id === wall.startCornerId) : undefined;
  const end = wall ? corners.find((c) => c.id === wall.endCornerId) : undefined;
  const wallLengthCm =
    wall && start && end ? Math.round(getWallGeometry(start, end).lengthCm) : 500;

  return (
    <section className="sidebar-section" data-testid="fixture-inspector">
      <div className="sidebar-title">
        <span>{t('inspector.fixture.title')}</span>
        <Zap size={14} />
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor={idType} className="form-label">
            {t('inspector.fixture.typeLabel')}
          </label>
          <select
            id={idType}
            className="select-input"
            value={selectedFixture.type}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                type: e.target.value as WallFixtureType,
              })
            }
          >
            {WALL_FIXTURE_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`inspector.fixture.types.${ft}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={idOffset} className="form-label">
            {t('inspector.fixture.offset')}
          </label>
          <input
            id={idOffset}
            type="number"
            min={0}
            max={wallLengthCm}
            step={5}
            className="number-input"
            value={Math.round(selectedFixture.offsetFromStartCm)}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                offsetFromStartCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idWidth} className="form-label">
            {t('inspector.fixture.width')}
          </label>
          <input
            id={idWidth}
            type="number"
            min={4}
            max={wallLengthCm}
            step={2}
            className="number-input"
            value={selectedFixture.widthCm}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                widthCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idDepth} className="form-label">
            {t('inspector.fixture.depth')}
          </label>
          <input
            id={idDepth}
            type="number"
            min={1}
            max={200}
            step={1}
            className="number-input"
            value={selectedFixture.depthCm}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                depthCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idHeight} className="form-label">
            {t('inspector.fixture.height')}
          </label>
          <input
            id={idHeight}
            type="number"
            min={4}
            max={350}
            step={5}
            className="number-input"
            value={selectedFixture.heightCm}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                heightCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field full">
          <label htmlFor={idElevation} className="form-label">
            {t('inspector.fixture.elevation')}
          </label>
          <input
            id={idElevation}
            type="number"
            min={0}
            max={280}
            step={5}
            className="number-input"
            value={selectedFixture.elevationCm}
            onChange={(e) =>
              updateFixture(selectedFixture.id, {
                elevationCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field full">
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%' }}
            onClick={() =>
              updateFixture(selectedFixture.id, {
                side: selectedFixture.side === 'neg' ? 'pos' : 'neg',
              })
            }
          >
            {t('inspector.fixture.flipSide')}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-danger"
        style={{ width: '100%', marginTop: '8px' }}
        onClick={() => removeFixture(selectedFixture.id)}
      >
        <Trash2 size={14} />
        <span>{t('inspector.fixture.deleteFixture')}</span>
      </button>
    </section>
  );
}
