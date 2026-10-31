import React, { useEffect, useId } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutRow[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: 'Bearbeiten & Verlauf',
    items: [
      { keys: ['Ctrl / ⌘', 'Z'], description: 'Rückgängig (Undo)' },
      { keys: ['Ctrl / ⌘', 'Y'], description: 'Wiederholen (Redo)' },
      { keys: ['Ctrl / ⌘', 'Shift', 'Z'], description: 'Wiederholen (Alternative)' },
      { keys: ['Entf / Backspace'], description: 'Ausgewähltes Element löschen' },
      { keys: ['Esc'], description: 'Auswahl aufheben / Werkzeug abbrechen' },
    ],
  },
  {
    title: 'Allgemein & Hilfe',
    items: [
      { keys: ['?'], description: 'Tastaturkürzel ein-/ausblenden' },
    ],
  },
  {
    title: '2D-Grundriss-Navigation',
    items: [
      { keys: ['Mausrad'], description: 'Vergrößern / Verkleinern (Zoom)' },
      { keys: ['Mittlere Maustaste', 'Ziehen'], description: 'Arbeitsfläche verschieben (Pan)' },
    ],
  },
  {
    title: '3D-Kamera-Navigation',
    items: [
      { keys: ['Linksklick', 'Ziehen'], description: 'Kamera rotieren (Orbit)' },
      { keys: ['Rechtsklick', 'Ziehen'], description: 'Kamera verschieben (Pan)' },
      { keys: ['Mausrad'], description: 'Heranzoomen / Wegzoomen' },
    ],
  },
];

export const KeyboardShortcutsDialog: React.FC = () => {
  const showKeyboardShortcuts = useFloorplanStore((s) => s.showKeyboardShortcuts);
  const setShowKeyboardShortcuts = useFloorplanStore((s) => s.setShowKeyboardShortcuts);
  const titleId = useId();

  useEffect(() => {
    if (!showKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowKeyboardShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showKeyboardShortcuts, setShowKeyboardShortcuts]);

  if (!showKeyboardShortcuts) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => setShowKeyboardShortcuts(false)}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
          }}
        >
          <div
            id={titleId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              color: 'var(--text-main)',
              fontSize: '0.95rem',
            }}
          >
            <Keyboard size={18} color="#818cf8" />
            <span>Tastaturkürzel &amp; Steuerung</span>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '4px', minWidth: 'auto', borderRadius: '4px' }}
            onClick={() => setShowKeyboardShortcuts(false)}
            aria-label="Schließen"
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '4px 0' }}>
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#818cf8',
                  marginBottom: '6px',
                }}
              >
                {section.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                }}
              >
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ color: 'var(--text-main)' }}>{item.description}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          style={{
                            background: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '4px',
                            padding: '1px 6px',
                            fontSize: '0.75rem',
                            color: '#cbd5e1',
                            fontFamily: 'monospace',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
          <button
            type="button"
            className="btn active"
            onClick={() => setShowKeyboardShortcuts(false)}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
