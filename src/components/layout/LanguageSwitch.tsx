import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

export const LanguageSwitch: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div
      className="topbar-group"
      role="group"
      aria-label={t('topbar.language.switchLanguage')}
      style={{ padding: '2px', gap: '2px' }}
    >
      <button
        type="button"
        className={`btn ${language === 'de' ? 'active' : ''}`}
        aria-pressed={language === 'de'}
        onClick={() => setLanguage('de')}
        title={t('topbar.language.de')}
        style={{ padding: '3px 7px', fontSize: '0.72rem', fontWeight: 600, minWidth: '28px' }}
      >
        <span>DE</span>
      </button>
      <button
        type="button"
        className={`btn ${language === 'en' ? 'active' : ''}`}
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
        title={t('topbar.language.en')}
        style={{ padding: '3px 7px', fontSize: '0.72rem', fontWeight: 600, minWidth: '28px' }}
      >
        <span>EN</span>
      </button>
    </div>
  );
};
