import React, { useEffect, useId } from 'react';
import { Download, Ruler } from 'lucide-react';

export function PlanExportDialog({
  planExportModalOpen,
  setPlanExportModalOpen,
  planScale,
  setPlanScale,
  planPaper,
  setPlanPaper,
  planOrientation,
  setPlanOrientation,
  planIncludeFurniture,
  setPlanIncludeFurniture,
  planIncludeDimensions,
  setPlanIncludeDimensions,
  planTitle,
  setPlanTitle,
  handleDownloadPlanSvg,
}: {
  planExportModalOpen: boolean;
  setPlanExportModalOpen: (open: boolean) => void;
  planScale: '1:50' | '1:100';
  setPlanScale: (scale: '1:50' | '1:100') => void;
  planPaper: 'A4' | 'A3';
  setPlanPaper: (paper: 'A4' | 'A3') => void;
  planOrientation: 'landscape' | 'portrait';
  setPlanOrientation: (orientation: 'landscape' | 'portrait') => void;
  planIncludeFurniture: boolean;
  setPlanIncludeFurniture: (include: boolean) => void;
  planIncludeDimensions: boolean;
  setPlanIncludeDimensions: (include: boolean) => void;
  planTitle: string;
  setPlanTitle: (title: string) => void;
  handleDownloadPlanSvg: () => void;
}) {
  const dialogTitleId = useId();
  const scaleId = useId();
  const paperId = useId();
  const orientationId = useId();
  const titleInputId = useId();

  useEffect(() => {
    if (!planExportModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPlanExportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [planExportModalOpen, setPlanExportModalOpen]);

  return (
    <>
      {planExportModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setPlanExportModalOpen(false)}
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
              <span>Maßstabsgetreuer 2D-Plan-Export (Architektur-Vektor)</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
              Generiert druckfertige Vektor-Pläne mit normiertem Plankopf, grafischer Maßstabsleiste, Außen-Bemaßungsketten und Raumstempel mit Netto-Innenfläche.
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
                  Maßstab
                </label>
                <select
                  id={scaleId}
                  className="select-input"
                  value={planScale}
                  onChange={(e) =>
                    setPlanScale(e.target.value as '1:50' | '1:100')
                  }
                >
                  <option value="1:50">1 : 50 (Detailmaßstab / 0,2 mm/cm)</option>
                  <option value="1:100">1 : 100 (Übersichtsmaßstab / 0,1 mm/cm)</option>
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
                  Papierformat
                </label>
                <select
                  id={paperId}
                  className="select-input"
                  value={planPaper}
                  onChange={(e) =>
                    setPlanPaper(e.target.value as 'A4' | 'A3')
                  }
                >
                  <option value="A4">DIN A4 (297 × 210 mm)</option>
                  <option value="A3">DIN A3 (420 × 297 mm)</option>
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
                  Ausrichtung
                </label>
                <select
                  id={orientationId}
                  className="select-input"
                  value={planOrientation}
                  onChange={(e) =>
                    setPlanOrientation(
                      e.target.value as 'landscape' | 'portrait'
                    )
                  }
                >
                  <option value="landscape">Querformat (Landscape)</option>
                  <option value="portrait">Hochformat (Portrait)</option>
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
                  Projektname
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  className="text-input"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="z. B. Wohnungsplanung 1.OG"
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
                  onChange={(e) => setPlanIncludeFurniture(e.target.checked)}
                />
                <span>Möbel & Einbauten im Plan einzeichnen</span>
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
                  onChange={(e) => setPlanIncludeDimensions(e.target.checked)}
                />
                <span>Außen-Bemaßungsketten (Wandlängen in cm) einblenden</span>
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
                onClick={() => setPlanExportModalOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn active"
                onClick={handleDownloadPlanSvg}
              >
                <Download size={14} />
                <span>SVG herunterladen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
