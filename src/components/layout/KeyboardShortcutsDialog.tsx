import React, { useEffect, useId } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutRow[];
}

export const KeyboardShortcutsDialog: React.FC = () => {
  const { t } = useTranslation();
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

  const shortcutSections: ShortcutSection[] = [
    {
      title: t('dialogs.shortcuts.sections.editHistory'),
      items: [
        { keys: [t('dialogs.shortcuts.keys.ctrlOrCmd'), 'Z'], description: t('dialogs.shortcuts.items.undo') },
        { keys: [t('dialogs.shortcuts.keys.ctrlOrCmd'), 'Y'], description: t('dialogs.shortcuts.items.redo') },
        { keys: [t('dialogs.shortcuts.keys.ctrlOrCmd'), t('dialogs.shortcuts.keys.shift'), 'Z'], description: t('dialogs.shortcuts.items.redoAlt') },
        { keys: [t('dialogs.shortcuts.keys.deleteOrBackspace')], description: t('dialogs.shortcuts.items.deleteSelected') },
        { keys: [t('dialogs.shortcuts.keys.esc')], description: t('dialogs.shortcuts.items.cancelOrDeselect') },
      ],
    },
    {
      title: t('dialogs.shortcuts.sections.generalHelp'),
      items: [
        { keys: [t('dialogs.shortcuts.keys.questionMark')], description: t('dialogs.shortcuts.items.toggleShortcuts') },
      ],
    },
    {
      title: t('dialogs.shortcuts.sections.navigation2D'),
      items: [
        { keys: [t('dialogs.shortcuts.keys.mouseWheel')], description: t('dialogs.shortcuts.items.zoom2D') },
        { keys: [t('dialogs.shortcuts.keys.middleClick'), t('dialogs.shortcuts.keys.drag')], description: t('dialogs.shortcuts.items.pan2D') },
      ],
    },
    {
      title: t('dialogs.shortcuts.sections.navigation3D'),
      items: [
        { keys: [t('dialogs.shortcuts.keys.leftClick'), t('dialogs.shortcuts.keys.drag')], description: t('dialogs.shortcuts.items.orbit3D') },
        { keys: [t('dialogs.shortcuts.keys.rightClick'), t('dialogs.shortcuts.keys.drag')], description: t('dialogs.shortcuts.items.pan3D') },
        { keys: [t('dialogs.shortcuts.keys.mouseWheel')], description: t('dialogs.shortcuts.items.zoom3D') },
      ],
    },
  ];

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
            <span>{t('dialogs.shortcuts.title')}</span>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '4px', minWidth: 'auto', borderRadius: '4px' }}
            onClick={() => setShowKeyboardShortcuts(false)}
            aria-label={t('dialogs.shortcuts.closeAriaLabel')}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '4px 0' }}>
          {shortcutSections.map((section) => (
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
