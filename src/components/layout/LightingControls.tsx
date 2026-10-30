import React from 'react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { formatTimeOfDay, MOOD_PRESET_BUTTONS } from './TopBar';

export function LightingControls() {
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const activeMoodKey = useFloorplanStore((s) => s.activeMoodKey);
  const qualityMode = useFloorplanStore((s) => s.qualityMode);
  const alignSunWithWindows = useFloorplanStore((s) => s.alignSunWithWindows);
  const roomLightsActive = useFloorplanStore((s) => s.roomLightsActive);
  const setTimeOfDay = useFloorplanStore((s) => s.setTimeOfDay);
  const setMoodPreset = useFloorplanStore((s) => s.setMoodPreset);
  const setQualityMode = useFloorplanStore((s) => s.setQualityMode);
  const setAlignSunWithWindows = useFloorplanStore((s) => s.setAlignSunWithWindows);
  const setRoomLightsActive = useFloorplanStore((s) => s.setRoomLightsActive);

  return (
    <>
        {viewMode !== '2d' && (
          <div className="topbar-group" role="group" aria-label="Licht & Atmosphäre">
            {MOOD_PRESET_BUTTONS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`btn ${activeMoodKey === preset.key ? 'active' : ''}`}
                aria-pressed={activeMoodKey === preset.key}
                onClick={() => setMoodPreset(preset.key)}
                title={`Lichtstimmung: ${preset.label}`}
              >
                <span>{preset.label}</span>
              </button>
            ))}

            <button
              type="button"
              className={`btn ${roomLightsActive ? 'active' : ''}`}
              onClick={() => setRoomLightsActive(!roomLightsActive)}
              title="Raumleuchten (z. B. Artemide Tolomeo) manuell ein-/ausschalten"
            >
              <span>💡 Raumlicht</span>
            </button>
            <button
              type="button"
              className={`btn ${alignSunWithWindows ? 'active' : ''}`}
              onClick={() => setAlignSunWithWindows(!alignSunWithWindows)}
              title="Sonnen-Lichteinfall an den Fenstern des Grundrisses ausrichten"
            >
              <span>Fenster-Licht</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 4px' }}>
              <input
                type="range"
                min="6"
                max="22"
                step="0.25"
                value={timeOfDay}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (Number.isFinite(val)) setTimeOfDay(val);
                }}
                aria-label="Tageszeit"
                aria-valuetext={formatTimeOfDay(timeOfDay)}
                title={`Tageszeit: ${formatTimeOfDay(timeOfDay)}`}
                style={{ width: '90px', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: '64px',
                }}
              >
                {formatTimeOfDay(timeOfDay)}
              </span>
            </div>

            <button
              type="button"
              className={`btn ${qualityMode === 'beauty' ? 'active' : ''}`}
              aria-pressed={qualityMode === 'beauty'}
              aria-label={`Grafikqualität: ${
                qualityMode === 'beauty' ? 'Schön (mit N8AO & Bloom)' : 'Performance'
              }`}
              onClick={() =>
                setQualityMode(qualityMode === 'beauty' ? 'performance' : 'beauty')
              }
              title={
                qualityMode === 'beauty'
                  ? 'Klicken für Performance-Modus (ohne N8AO/Bloom)'
                  : 'Klicken für Schön-Modus (mit N8AO, Bloom, SoftShadows)'
              }
            >
              <span>{qualityMode === 'beauty' ? '✨ Schön' : '⚡ Performance'}</span>
            </button>
          </div>
        )}
    </>
  );
}
