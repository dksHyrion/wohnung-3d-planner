import React, { useEffect, useId } from 'react';
import { Download, Ruler } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export interface PlanExportDialogProps {
  planExportModalOpen?: boolean;
  setPlanExportModalOpen?: (open: boolean) => void;
  planScale?: '1:50' | '1:100';
  setPlanScale?: (scale: '1:50' | '1:100') => void;
  planPaper?: 'A4' | 'A3';
  setPlanPaper?: (paper: 'A4' | 'A3') => void;
  planOrientation?: 'landscape' | 'portrait';
  setPlanOrientation?: (orientation: 'landscape' | 'portrait') => void;
  planIncludeFurniture?: boolean;
  setPlanIncludeFurniture?: (include: boolean) => void;
  planIncludeDimensions?: boolean;
  setPlanIncludeDimensions?: (include: boolean) => void;
  planTitle?: string;
  setPlanTitle?: (title: string) => void;
  handleDownloadPlanSvg?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function PlanExportDialog({
  planExportModalOpen = false,
  setPlanExportModalOpen,
  planScale = '1:50',
  setPlanScale,
  planPaper = 'A4',
  setPlanPaper,
  planOrientation = 'landscape',
  setPlanOrientation,
  planIncludeFurniture = true,
  setPlanIncludeFurniture,
  planIncludeDimensions = true,
  setPlanIncludeDimensions,
  planTitle = '',
  setPlanTitle,
  handleDownloadPlanSvg,
  isOpen,
  onClose,
}: PlanExportDialogProps) {
  const { t } = useTranslation();
  const dialogTitleId = useId();
  const scaleId = useId();
  const paperId = useId();
  const orientationId = useId();
  const titleInputId = useId();

  const isModalOpen = isOpen ?? planExportModalOpen;
  const handleClose = () => {
    if (onClose) onClose();
    if (setPlanExportModalOpen) setPlanExportModalOpen(false);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, onClose, setPlanExportModalOpen]);

  return (
    <>
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onClick={handleClose}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sidebar-title"
              id={dialogTitleId}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Ruler size={18} color="#818cf8" />
              <span>{t('dialogs.export.title')}</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
              {t('dialogs.export.description')}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '6px',
              }}
            >
              <div>
                <label
                  htmlFor={scaleId}
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {t('dialogs.export.scale')}
                </label>
                <select
                  id={scaleId}
                  className="select-input"
                  value={planScale}
                  onChange={(e) =>
                    setPlanScale?.(e.target.value as '1:50' | '1:100')
                  }
                >
                  <option value="1:50">{t('dialogs.export.scale50')}</option>
                  <option value="1:100">{t('dialogs.export.scale100')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor={paperId}
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {t('dialogs.export.paperFormat')}
                </label>
                <select
                  id={paperId}
                  className="select-input"
                  value={planPaper}
                  onChange={(e) =>
                    setPlanPaper?.(e.target.value as 'A4' | 'A3')
                  }
                >
                  <option value="A4">{t('dialogs.export.paperA4')}</option>
                  <option value="A3">{t('dialogs.export.paperA3')}</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div>
                <label
                  htmlFor={orientationId}
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {t('dialogs.export.orientation')}
                </label>
                <select
                  id={orientationId}
                  className="select-input"
                  value={planOrientation}
                  onChange={(e) =>
                    setPlanOrientation?.(
                      e.target.value as 'landscape' | 'portrait'
                    )
                  }
                >
                  <option value="landscape">{t('dialogs.export.orientationLandscape')}</option>
                  <option value="portrait">{t('dialogs.export.orientationPortrait')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor={titleInputId}
                  style={{
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {t('dialogs.export.projectName')}
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  className="text-input"
                  value={planTitle}
                  onChange={(e) => setPlanTitle?.(e.target.value)}
                  placeholder={t('dialogs.export.projectPlaceholder')}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px 10px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <input
                  type="checkbox"
                  checked={planIncludeFurniture}
                  onChange={(e) => setPlanIncludeFurniture?.(e.target.checked)}
                />
                <span>{t('dialogs.export.includeFurniture')}</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <input
                  type="checkbox"
                  checked={planIncludeDimensions}
                  onChange={(e) => setPlanIncludeDimensions?.(e.target.checked)}
                />
                <span>{t('dialogs.export.includeDimensions')}</span>
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClose}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn active"
                onClick={handleDownloadPlanSvg}
              >
                <Download size={14} />
                <span>{t('dialogs.export.downloadSvg')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
