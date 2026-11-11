import React from 'react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatTimeOfDay } from './TopBar';
import { MoodPresetKey } from '../../core/lighting/moodPresets';

export interface LightingControlsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function LightingControls({ isOpen }: LightingControlsProps = {}) {
  const { t } = useTranslation();
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

  const shouldRender = isOpen !== undefined ? isOpen : viewMode !== '2d';

  if (!shouldRender) {
    return null;
  }

  const moodPresets: { key: MoodPresetKey; emoji: string; label: string }[] = [
    { key: 'neutral', emoji: '🌤️', label: t('lighting.presets.neutral') },
    { key: 'morning', emoji: '🌅', label: t('lighting.presets.morning') },
    { key: 'noon', emoji: '☀️', label: t('lighting.presets.noon') },
    { key: 'golden_hour', emoji: '🌇', label: t('lighting.presets.goldenHour') },
    { key: 'blue_hour', emoji: '🌆', label: t('lighting.presets.blueHour') },
    { key: 'night', emoji: '🌙', label: t('lighting.presets.night') },
  ];

  return (
    <div className="topbar-group" role="group" aria-label={t('lighting.title')}>
      {moodPresets.map((preset) => (
        <button
          key={preset.key}
          type="button"
          className={`btn ${activeMoodKey === preset.key ? 'active' : ''}`}
          aria-pressed={activeMoodKey === preset.key}
          onClick={() => setMoodPreset(preset.key)}
          title={`${t('lighting.presetMoodTitle')}: ${preset.label}`}
        >
          <span>{`${preset.emoji} ${preset.label}`}</span>
        </button>
      ))}

      <button
        type="button"
        className={`btn ${roomLightsActive ? 'active' : ''}`}
        onClick={() => setRoomLightsActive(!roomLightsActive)}
        title={t('lighting.options.roomLightsHint')}
      >
        <span>💡 {t('lighting.options.roomLights')}</span>
      </button>
      <button
        type="button"
        className={`btn ${alignSunWithWindows ? 'active' : ''}`}
        onClick={() => setAlignSunWithWindows(!alignSunWithWindows)}
        title={t('lighting.options.windowSunHint')}
      >
        <span>{t('lighting.options.windowSun')}</span>
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
          aria-label={t('lighting.timeOfDay')}
          aria-valuetext={formatTimeOfDay(timeOfDay)}
          title={`${t('lighting.timeOfDay')}: ${formatTimeOfDay(timeOfDay)}`}
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
        aria-label={
          qualityMode === 'beauty'
            ? t('lighting.quality.ariaLabelBeauty')
            : t('lighting.quality.ariaLabelPerformance')
        }
        onClick={() =>
          setQualityMode(qualityMode === 'beauty' ? 'performance' : 'beauty')
        }
        title={
          qualityMode === 'beauty'
            ? t('lighting.quality.titleBeauty')
            : t('lighting.quality.titlePerformance')
        }
      >
        <span>
          {qualityMode === 'beauty'
            ? `✨ ${t('lighting.quality.beautiful')}`
            : `⚡ ${t('lighting.quality.fast')}`}
        </span>
      </button>
    </div>
  );
}
