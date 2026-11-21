import React, { useEffect, useId } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';

export interface JsonPlanDialogProps {
  jsonModalMode?: 'export' | 'import' | null;
  setJsonModalMode?: (mode: 'export' | 'import' | null) => void;
  jsonText?: string;
  setJsonText?: (text: string) => void;
  importError?: string | null;
  handleDownloadJson?: () => void;
  handleConfirmImport?: () => void;
  handleCopyShareLink?: () => Promise<'copied' | 'too-large' | 'error'>;
  isOpen?: boolean;
  mode?: 'export' | 'import' | null;
  onClose?: () => void;
}

export function JsonPlanDialog({
  jsonModalMode,
  setJsonModalMode,
  jsonText = '',
  setJsonText,
  importError = null,
  handleDownloadJson,
  handleConfirmImport,
  handleCopyShareLink,
  isOpen,
  mode,
  onClose,
}: JsonPlanDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [copied, setCopied] = React.useState(false);
  const [shareFeedback, setShareFeedback] = React.useState<'copied' | 'too-large' | null>(null);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const activeMode = jsonModalMode ?? mode ?? (isOpen ? 'export' : null);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(Boolean(activeMode));

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(jsonText);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures in restricted sandboxes
    }
  };

  const handleShare = async () => {
    if (!handleCopyShareLink) return;
    const status = await handleCopyShareLink();
    if (status === 'copied' || status === 'too-large') {
      setShareFeedback(status);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setShareFeedback(null), 2600);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (setJsonModalMode) setJsonModalMode(null);
  };

  useEffect(() => {
    if (!activeMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, onClose, setJsonModalMode]);

  return (
    <>
      {activeMode && (
        <div
          className="modal-backdrop"
          onClick={handleClose}
        >
          <div
            ref={dialogRef}
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-title" id={titleId}>
              <span>
                {activeMode === 'export'
                  ? t('dialogs.json.exportTitle')
                  : t('dialogs.json.importTitle')}
              </span>
            </div>

            <textarea
              className="modal-textarea"
              aria-label={
                activeMode === 'export'
                  ? t('dialogs.json.exportAriaLabel')
                  : t('dialogs.json.importAriaLabel')
              }
              value={jsonText}
              onChange={(e) => setJsonText?.(e.target.value)}
              readOnly={activeMode === 'export'}
              placeholder={t('dialogs.json.placeholder')}
            />

            {importError && (
              <div className="diagnostic-box error" role="alert">{importError}</div>
            )}
            {shareFeedback === 'too-large' && (
              <div className="diagnostic-box error" role="alert">{t('dialogs.json.shareTooLarge')}</div>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              {activeMode === 'export' && (
                <>
                  {handleCopyShareLink && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => void handleShare()}
                    >
                      {shareFeedback === 'copied'
                        ? t('dialogs.json.shareCopied')
                        : t('dialogs.json.copyShareLink')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleCopy}
                  >
                    {copied ? t('dialogs.json.copied') : t('dialogs.json.copy')}
                  </button>
                  <button
                    type="button"
                    className="btn active"
                    onClick={handleDownloadJson}
                  >
                    {t('dialogs.json.download')}
                  </button>
                </>
              )}
              {activeMode === 'import' && (
                <button
                  type="button"
                  className="btn active"
                  onClick={handleConfirmImport}
                >
                  {t('dialogs.json.load')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClose}
              >
                {t('dialogs.json.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
