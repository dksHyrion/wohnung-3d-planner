import React, { useEffect, useId } from 'react';

export function JsonPlanDialog({
  jsonModalMode,
  setJsonModalMode,
  jsonText,
  setJsonText,
  importError,
  handleDownloadJson,
  handleConfirmImport,
}: {
  jsonModalMode: 'export' | 'import' | null;
  setJsonModalMode: (mode: 'export' | 'import' | null) => void;
  jsonText: string;
  setJsonText: (text: string) => void;
  importError: string | null;
  handleDownloadJson: () => void;
  handleConfirmImport: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!jsonModalMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setJsonModalMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonModalMode, setJsonModalMode]);

  return (
    <>
      {jsonModalMode && (
        <div
          className="modal-backdrop"
          onClick={() => setJsonModalMode(null)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-title" id={titleId}>
              <span>
                {jsonModalMode === 'export'
                  ? 'Grundriss JSON exportieren (alle Maße in cm)'
                  : 'Grundriss JSON importieren (alle Maße in cm)'}
              </span>
            </div>

            <textarea
              className="modal-textarea"
              aria-label={
                jsonModalMode === 'export'
                  ? 'Grundriss JSON Export'
                  : 'Grundriss JSON Import'
              }
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              readOnly={jsonModalMode === 'export'}
              placeholder="JSON-Grundriss hier einfügen..."
            />

            {importError && (
              <div className="diagnostic-box error">{importError}</div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              {jsonModalMode === 'export' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => navigator.clipboard?.writeText(jsonText)}
                  >
                    In Zwischenablage kopieren
                  </button>
                  <button
                    type="button"
                    className="btn active"
                    onClick={handleDownloadJson}
                  >
                    Als .json herunterladen
                  </button>
                </>
              )}
              {jsonModalMode === 'import' && (
                <button
                  type="button"
                  className="btn active"
                  onClick={handleConfirmImport}
                >
                  JSON laden
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setJsonModalMode(null)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
