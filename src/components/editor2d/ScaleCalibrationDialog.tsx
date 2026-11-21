import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';

export interface ScaleCalibrationDialogProps {
  isOpen: boolean;
  valueCm: string;
  onChangeCm: (value: string) => void;
  onApply: (distCm: number) => void;
  onCancel: () => void;
}

export const ScaleCalibrationDialog: React.FC<ScaleCalibrationDialogProps> = ({
  isOpen,
  valueCm,
  onChangeCm,
  onApply,
  onCancel,
}) => {
  const { t } = useTranslation();
  const dialogRef = useModalFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const parsed = parseFloat(valueCm);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div
      ref={dialogRef}
      className="calibration-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t('editor2d.calibrationTitle')}
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 30,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #06b6d4',
        borderRadius: 10,
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 260,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#38bdf8' }}>
        {t('editor2d.calibrationHeader')}
      </div>
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: '0.85rem',
        }}
      >
        <span>{t('editor2d.calibrationPrompt')}</span>
        <input
          type="number"
          min={1}
          step={1}
          value={valueCm}
          onChange={(e) => onChangeCm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (isValid) onApply(parsed);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          aria-label={t('editor2d.calibrationPrompt')}
          className="number-input"
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #475569',
            borderRadius: 6,
            padding: '6px 10px',
            color: '#ffffff',
            fontSize: '0.9rem',
          }}
        />
      </label>
      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={onCancel}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          {t('editor2d.calibrationCancel')}
        </button>
        <button
          type="button"
          className="btn active"
          disabled={!isValid}
          onClick={() => {
            if (isValid) onApply(parsed);
          }}
          style={{
            fontSize: '0.8rem',
            padding: '5px 12px',
            background: '#0284c7',
            opacity: !isValid ? 0.5 : 1,
            cursor: !isValid ? 'not-allowed' : 'pointer',
          }}
        >
          {t('editor2d.calibrationApply')}
        </button>
      </div>
    </div>
  );
};
