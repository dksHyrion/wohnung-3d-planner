import React from 'react';
import { Trash2, RotateCw } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { AreaRug } from '../../core/types';

export const RUG_COLOR_PRESETS: Array<{
  label: string;
  color: string;
  presetKey: 'linen' | 'warmGray' | 'anthracite' | 'sage' | 'terracotta' | 'midnightBlue';
}> = [
  { label: 'Naturleinen', color: '#edece8', presetKey: 'linen' },
  { label: 'Warmgrau', color: '#d6d3cd', presetKey: 'warmGray' },
  { label: 'Anthrazit', color: '#475569', presetKey: 'anthracite' },
  { label: 'Salbei', color: '#cbd5c0', presetKey: 'sage' },
  { label: 'Terrakotta', color: '#d4a383', presetKey: 'terracotta' },
  { label: 'Mitternachtsblau', color: '#334155', presetKey: 'midnightBlue' },
];

export function RugInspector({ selectedRug }: { selectedRug: AreaRug }) {
  const { t } = useTranslation();
  const updateRug = useFloorplanStore((s) => s.updateRug);
  const removeRug = useFloorplanStore((s) => s.removeRug);

  const idName = React.useId();
  const idWidth = React.useId();
  const idDepth = React.useId();
  const idX = React.useId();
  const idZ = React.useId();
  const idRotation = React.useId();
  const idColor = React.useId();

  return (
    <section className="sidebar-section" data-testid="rug-inspector">
      <div className="sidebar-title">
        <span>{t('inspector.rug.title')}</span>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeRug(selectedRug.id)}
          title={t('inspector.rug.deleteRug')}
        >
          <Trash2 size={13} />
          <span>{t('inspector.rug.delete')}</span>
        </button>
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor={idName} className="form-label">{t('inspector.rug.name')}</label>
          <input
            id={idName}
            type="text"
            className="text-input"
            value={selectedRug.name ?? t('inspector.rug.defaultName')}
            onChange={(e) =>
              updateRug(selectedRug.id, { name: e.target.value })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idWidth} className="form-label">{t('inspector.rug.width')}</label>
          <input
            id={idWidth}
            type="number"
            min={20}
            step={10}
            className="number-input"
            value={selectedRug.widthCm}
            onChange={(e) =>
              updateRug(selectedRug.id, { widthCm: Number(e.target.value) })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idDepth} className="form-label">{t('inspector.rug.depth')}</label>
          <input
            id={idDepth}
            type="number"
            min={20}
            step={10}
            className="number-input"
            value={selectedRug.depthCm}
            onChange={(e) =>
              updateRug(selectedRug.id, { depthCm: Number(e.target.value) })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idX} className="form-label">{t('inspector.rug.posX')}</label>
          <input
            id={idX}
            type="number"
            step={5}
            className="number-input"
            value={selectedRug.x}
            onChange={(e) =>
              updateRug(selectedRug.id, { x: Number(e.target.value) })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idZ} className="form-label">{t('inspector.rug.posZ')}</label>
          <input
            id={idZ}
            type="number"
            step={5}
            className="number-input"
            value={selectedRug.z}
            onChange={(e) =>
              updateRug(selectedRug.id, { z: Number(e.target.value) })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idRotation} className="form-label">{t('inspector.rug.rotation')}</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              id={idRotation}
              type="number"
              step={15}
              className="number-input"
              style={{ flex: 1 }}
              value={selectedRug.rotationYDeg ?? 0}
              onChange={(e) =>
                updateRug(selectedRug.id, {
                  rotationYDeg: Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                updateRug(selectedRug.id, {
                  rotationYDeg: ((selectedRug.rotationYDeg ?? 0) + 90) % 360,
                })
              }
              title={t('inspector.rug.rotate90')}
            >
              <RotateCw size={13} />
            </button>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor={idColor} className="form-label">{t('inspector.rug.color')}</label>
          <input
            id={idColor}
            type="color"
            className="number-input"
            style={{ height: '31px', padding: '2px 4px' }}
            value={selectedRug.color ?? '#edece8'}
            onChange={(e) =>
              updateRug(selectedRug.id, { color: e.target.value })
            }
          />
        </div>

        <div className="form-field full">
          <label className="form-label">{t('inspector.rug.colorPresets')}</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {RUG_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() =>
                  updateRug(selectedRug.id, { color: preset.color })
                }
                title={t(`inspector.rug.presets.${preset.presetKey}`)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: preset.color,
                  border:
                    (selectedRug.color ?? '#edece8').toLowerCase() ===
                    preset.color.toLowerCase()
                      ? '2px solid #38bdf8'
                      : '1px solid #475569',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
