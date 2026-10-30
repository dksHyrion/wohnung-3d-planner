import React from 'react';
import { Trash2, RotateCw } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import type { AreaRug } from '../../core/types';

export const RUG_COLOR_PRESETS: Array<{ label: string; color: string }> = [
  { label: 'Naturleinen', color: '#edece8' },
  { label: 'Warmgrau', color: '#d6d3cd' },
  { label: 'Anthrazit', color: '#475569' },
  { label: 'Salbei', color: '#cbd5c0' },
  { label: 'Terrakotta', color: '#d4a383' },
  { label: 'Mitternachtsblau', color: '#334155' },
];

export function RugInspector({ selectedRug }: { selectedRug: AreaRug }) {
  const updateRug = useFloorplanStore((s) => s.updateRug);
  const removeRug = useFloorplanStore((s) => s.removeRug);

  return (
    <section className="sidebar-section" data-testid="rug-inspector">
      <div className="sidebar-title">
        <span>Teppich-Inspektor</span>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeRug(selectedRug.id)}
          title="Teppich entfernen"
        >
          <Trash2 size={13} />
          <span>Löschen</span>
        </button>
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label">Bezeichnung</label>
          <input
            type="text"
            className="text-input"
            value={selectedRug.name ?? 'Teppich'}
            onChange={(e) =>
              updateRug(selectedRug.id, { name: e.target.value })
            }
          />
        </div>

        <div className="form-field">
          <label className="form-label">Breite (cm)</label>
          <input
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
          <label className="form-label">Tiefe (cm)</label>
          <input
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
          <label className="form-label">Position X (cm)</label>
          <input
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
          <label className="form-label">Position Z (cm)</label>
          <input
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
          <label className="form-label">Drehung (°)</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
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
              title="Um 90° drehen"
            >
              <RotateCw size={13} />
            </button>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Farbton</label>
          <input
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
          <label className="form-label">Architektur-Farbvorlagen</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {RUG_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() =>
                  updateRug(selectedRug.id, { color: preset.color })
                }
                title={preset.label}
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
