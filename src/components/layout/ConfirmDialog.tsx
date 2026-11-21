import React, { useEffect, useId } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import { useTranslation } from '../../i18n/useTranslation';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useModalFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sidebar-title" id={titleId}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {destructive && (
              <AlertTriangle size={16} color="#f87171" aria-hidden="true" />
            )}
            <span>{title}</span>
          </span>
        </div>

        <p id={descId} className="modal-description">
          {message}
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'active'}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
