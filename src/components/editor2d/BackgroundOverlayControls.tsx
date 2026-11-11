import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';

export const BackgroundOverlayControls: React.FC = () => {
  const { t } = useTranslation();
  const backgroundImage = useFloorplanStore((s) => s.backgroundImage);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const updateBackgroundImage = useFloorplanStore((s) => s.updateBackgroundImage);
  const removeBackgroundImage = useFloorplanStore((s) => s.removeBackgroundImage);
  const startCalibration = useFloorplanStore((s) => s.startCalibration);
  const cancelCalibration = useFloorplanStore((s) => s.cancelCalibration);

  if (!backgroundImage) {
    return null;
  }

  const { filename, opacity, locked, visible } = backgroundImage;
  const opacityPercent = Math.round(opacity * 100);

  return (
    <div
      className="background-overlay-controls"
      role="toolbar"
      aria-label={t('dialogs.overlay.toolbarAria')}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.2))',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        fontSize: '0.8rem',
        color: 'var(--text-main, #f8fafc)',
      }}
    >
      {/* Filename badge */}
      <span
        title={filename}
        style={{
          maxWidth: 130,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
          color: '#cbd5e1',
          fontSize: '0.75rem',
        }}
      >
        📄 {filename}
      </span>

      {/* Opacity slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) =>
            updateBackgroundImage({ opacity: parseFloat(e.target.value) })
          }
          aria-label={t('dialogs.overlay.opacityAria')}
          aria-valuetext={`${opacityPercent}%`}
          title={t('dialogs.overlay.opacityTooltip', { percent: opacityPercent })}
          style={{ width: 65, cursor: 'pointer' }}
        />
        <span
          style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            minWidth: 32,
            textAlign: 'right',
          }}
        >
          {opacityPercent}%
        </span>
      </div>

      {/* Lock / Unlock button */}
      <button
        type="button"
        className={`btn btn-outline ${locked ? 'active' : ''}`}
        onClick={() => updateBackgroundImage({ locked: !locked })}
        aria-label={locked ? t('dialogs.overlay.unlockAria') : t('dialogs.overlay.lockAria')}
        title={locked ? t('dialogs.overlay.unlockAria') : t('dialogs.overlay.lockAria')}
        style={{ padding: '4px 6px', display: 'flex', alignItems: 'center' }}
      >
        {locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} />}
      </button>

      {/* Visibility toggle button */}
      <button
        type="button"
        className={`btn btn-outline ${!visible ? 'active' : ''}`}
        onClick={() => updateBackgroundImage({ visible: !visible })}
        aria-label={visible ? t('dialogs.overlay.hideAria') : t('dialogs.overlay.showAria')}
        title={visible ? t('dialogs.overlay.hideAria') : t('dialogs.overlay.showAria')}
        style={{ padding: '4px 6px', display: 'flex', alignItems: 'center' }}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} color="#94a3b8" />}
      </button>

      {/* Calibration button */}
      <button
        type="button"
        className={`btn btn-outline ${activeTool === 'calibrate-scale' ? 'active' : ''}`}
        onClick={() =>
          activeTool === 'calibrate-scale'
            ? cancelCalibration()
            : startCalibration()
        }
        aria-label={t('dialogs.overlay.calibrateAria')}
        title={t('dialogs.overlay.calibrateTooltip')}
        style={{
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
        }}
      >
        <span>📏 {t('dialogs.overlay.calibrate')}</span>
      </button>

      {/* Delete button */}
      <button
        type="button"
        className="btn btn-outline"
        onClick={removeBackgroundImage}
        aria-label={t('dialogs.overlay.removeAria')}
        title={t('dialogs.overlay.removeAria')}
        style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', color: '#ef4444' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};
