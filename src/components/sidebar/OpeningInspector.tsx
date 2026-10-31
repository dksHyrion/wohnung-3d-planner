import React from 'react';
import { Trash2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { OPENING_TYPE_LABELS, openingHasSwingArc } from '../../core/doorLeaf';
import type { OpeningType, WallOpening } from '../../core/types';

export function OpeningInspector({ selectedOpening }: { selectedOpening: WallOpening }) {
  const updateOpening = useFloorplanStore((s) => s.updateOpening);
  const removeOpening = useFloorplanStore((s) => s.removeOpening);

  const idType = React.useId();
  const idOffset = React.useId();
  const idWidth = React.useId();
  const idHeight = React.useId();
  const idSill = React.useId();
  const idSwing = React.useId();

  const handleTypeChange = (nextType: OpeningType) => {
    const patch: Partial<Omit<WallOpening, 'id'>> = { type: nextType };
    if (nextType === 'window' && selectedOpening.sillHeightCm === 0) {
      patch.sillHeightCm = 90;
      patch.heightCm = 130;
    } else if (nextType !== 'window' && selectedOpening.type === 'window') {
      patch.sillHeightCm = 0;
      patch.heightCm = 200;
      if (openingHasSwingArc(nextType) && !selectedOpening.swingDirection) {
        patch.swingDirection = 'in-left';
      }
    }
    updateOpening(selectedOpening.id, patch);
  };

  const titleLabel =
    selectedOpening.type === 'window'
      ? 'Fenster-Inspektor'
      : selectedOpening.type === 'passage'
      ? 'Durchbruch-Inspektor'
      : 'Tür-Inspektor';

  return (
    <section className="sidebar-section">
      <div className="sidebar-title">
        <span>{titleLabel}</span>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => removeOpening(selectedOpening.id)}
          title="Öffnung entfernen"
        >
          <Trash2 size={13} />
          <span>Löschen</span>
        </button>
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label htmlFor={idType} className="form-label">Bauart / Öffnungstyp</label>
          <select
            id={idType}
            className="select-input"
            aria-label="Bauart / Öffnungstyp"
            value={selectedOpening.type}
            onChange={(e) => handleTypeChange(e.target.value as OpeningType)}
          >
            {(Object.keys(OPENING_TYPE_LABELS) as OpeningType[]).map((t) => (
              <option key={t} value={t}>
                {OPENING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={idOffset} className="form-label">Abstand ab Ecke (cm)</label>
          <input
            id={idOffset}
            type="number"
            min={0}
            step={5}
            className="number-input"
            value={selectedOpening.offsetFromStartCm}
            onChange={(e) =>
              updateOpening(selectedOpening.id, {
                offsetFromStartCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idWidth} className="form-label">Breite (cm)</label>
          <input
            id={idWidth}
            type="number"
            min={20}
            step={5}
            className="number-input"
            value={selectedOpening.widthCm}
            onChange={(e) =>
              updateOpening(selectedOpening.id, {
                widthCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idHeight} className="form-label">Höhe (cm)</label>
          <input
            id={idHeight}
            type="number"
            min={20}
            step={5}
            className="number-input"
            value={selectedOpening.heightCm}
            onChange={(e) =>
              updateOpening(selectedOpening.id, {
                heightCm: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="form-field">
          <label htmlFor={idSill} className="form-label">Brüstungshöhe (cm)</label>
          <input
            id={idSill}
            type="number"
            min={0}
            step={5}
            className="number-input"
            value={selectedOpening.sillHeightCm}
            onChange={(e) =>
              updateOpening(selectedOpening.id, {
                sillHeightCm: Number(e.target.value),
              })
            }
          />
        </div>

        {(openingHasSwingArc(selectedOpening.type) ||
          selectedOpening.type === 'sliding-door') && (
          <div className="form-field full">
            <label htmlFor={idSwing} className="form-label">
              {selectedOpening.type === 'sliding-door'
                ? 'Laufrichtung / Wandseite'
                : 'Anschlagrichtung'}
            </label>
            <select
              id={idSwing}
              className="select-input"
              value={selectedOpening.swingDirection ?? 'in-left'}
              onChange={(e) =>
                updateOpening(selectedOpening.id, {
                  swingDirection: e.target
                    .value as WallOpening['swingDirection'],
                })
              }
            >
              <option value="in-left">Innen Links</option>
              <option value="in-right">Innen Rechts</option>
              <option value="out-left">Außen Links</option>
              <option value="out-right">Außen Rechts</option>
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
