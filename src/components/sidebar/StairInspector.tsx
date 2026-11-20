import React, { useMemo } from 'react';
import { Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { computeStairGeometry } from '../../core/stairsMath';
import type { Staircase, StaircaseType } from '../../core/types';

export const StairInspector: React.FC<{ selectedStair: Staircase }> = ({
  selectedStair,
}) => {
  const { t } = useTranslation();
  const levels = useFloorplanStore((s) => s.levels);
  const updateStair = useFloorplanStore((s) => s.updateStair);
  const removeStair = useFloorplanStore((s) => s.removeStair);

  const fromLevel = levels.find((l) => l.id === selectedStair.fromLevelId);
  const toLevel = levels.find((l) => l.id === selectedStair.toLevelId);

  const geom = useMemo(
    () => computeStairGeometry(selectedStair, fromLevel, toLevel),
    [selectedStair, fromLevel, toLevel]
  );

  return (
    <section className="sidebar-section" data-testid="stair-inspector-section">
      <div className="sidebar-title">
        <span>{t('stairs.inspectorTitle')}</span>
      </div>

      {/* DIN 18065 live check */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 6,
          marginBottom: 8,
          background: geom.din18065Ok
            ? 'rgba(16, 185, 129, 0.14)'
            : 'rgba(245, 158, 11, 0.14)',
          border: `1px solid ${geom.din18065Ok ? '#10b981' : '#f59e0b'}`,
          fontSize: '0.72rem',
          color: geom.din18065Ok ? '#6ee7b7' : '#fcd34d',
        }}
      >
        {geom.din18065Ok ? (
          <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        ) : (
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        )}
        <div>
          <div style={{ fontWeight: 700 }}>
            {geom.din18065Ok ? t('stairs.dinOk') : t('stairs.dinWarn')}
          </div>
          <div style={{ fontSize: '0.68rem', opacity: 0.9 }}>
            {t('stairs.dinDetails', {
              s: geom.riserHeightCm.toFixed(1),
              a: geom.treadDepthCm,
              stride: geom.strideMeasureCm.toFixed(1),
            })}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor={`stair-type-${selectedStair.id}`} className="form-label">{t('stairs.type')}</label>
          <select
            id={`stair-type-${selectedStair.id}`}
            className="text-input"
            value={selectedStair.type}
            onChange={(e) =>
              updateStair(selectedStair.id, {
                type: e.target.value as StaircaseType,
              })
            }
          >
            <option value="straight">{t('stairs.typeStraight')}</option>
            <option value="l-shaped">{t('stairs.typeLShaped')}</option>
            <option value="u-shaped">{t('stairs.typeUShaped')}</option>
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={`stair-from-${selectedStair.id}`} className="form-label">{t('stairs.fromLevel')}</label>
          <select
            id={`stair-from-${selectedStair.id}`}
            className="text-input"
            value={selectedStair.fromLevelId}
            onChange={(e) =>
              updateStair(selectedStair.id, { fromLevelId: e.target.value })
            }
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === selectedStair.toLevelId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={`stair-to-${selectedStair.id}`} className="form-label">{t('stairs.toLevel')}</label>
          <select
            id={`stair-to-${selectedStair.id}`}
            className="text-input"
            value={selectedStair.toLevelId}
            onChange={(e) =>
              updateStair(selectedStair.id, { toLevelId: e.target.value })
            }
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === selectedStair.fromLevelId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={`stair-width-${selectedStair.id}`} className="form-label">{t('stairs.widthCm')}</label>
          <input
            id={`stair-width-${selectedStair.id}`}
            type="number"
            min={60}
            max={250}
            step={5}
            className="number-input"
            value={selectedStair.widthCm}
            onChange={(e) =>
              updateStair(selectedStair.id, {
                widthCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label className="form-label">{t('stairs.treadDepthCm')}</label>
          <input
            type="number"
            min={18}
            max={40}
            step={1}
            className="number-input"
            value={selectedStair.treadDepthCm}
            onChange={(e) =>
              updateStair(selectedStair.id, {
                treadDepthCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label className="form-label">{t('stairs.riserCount')}</label>
          <input
            type="number"
            min={3}
            max={40}
            step={1}
            placeholder={String(geom.riserCount)}
            className="number-input"
            value={selectedStair.riserCount ?? ''}
            onChange={(e) =>
              updateStair(selectedStair.id, {
                riserCount: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="form-field">
          <label className="form-label">{t('stairs.rotationDeg')}</label>
          <input
            type="number"
            step={15}
            className="number-input"
            value={selectedStair.rotationYDeg}
            onChange={(e) =>
              updateStair(selectedStair.id, {
                rotationYDeg: Number(e.target.value),
              })
            }
          />
        </div>

        {selectedStair.type !== 'straight' && (
          <>
            <div className="form-field">
              <label className="form-label">{t('stairs.turnDirection')}</label>
              <select
                className="text-input"
                value={selectedStair.turnDirection ?? 'right'}
                onChange={(e) =>
                  updateStair(selectedStair.id, {
                    turnDirection: e.target.value as 'left' | 'right',
                  })
                }
              >
                <option value="right">{t('stairs.turnRight')}</option>
                <option value="left">{t('stairs.turnLeft')}</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">{t('stairs.landingLengthCm')}</label>
              <input
                type="number"
                min={60}
                max={250}
                step={5}
                className="number-input"
                value={selectedStair.landingLengthCm ?? selectedStair.widthCm}
                onChange={(e) =>
                  updateStair(selectedStair.id, {
                    landingLengthCm: Number(e.target.value),
                  })
                }
              />
            </div>
          </>
        )}

        <div className="form-field full">
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.76rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedStair.hasRailing !== false}
              onChange={(e) =>
                updateStair(selectedStair.id, { hasRailing: e.target.checked })
              }
            />
            <span>{t('stairs.hasRailing')}</span>
          </label>
        </div>

        <div className="form-field full">
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: '100%' }}
            onClick={() => removeStair(selectedStair.id)}
          >
            <Trash2 size={14} />
            <span>{t('stairs.deleteStair')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
