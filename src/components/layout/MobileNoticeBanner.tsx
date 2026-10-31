import React, { useState, useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

export const MOBILE_NOTICE_STORAGE_KEY = 'wohnung_mobile_notice_dismissed';

export function isMobileOrSmallScreen(viewportWidth?: number): boolean {
  if (typeof viewportWidth === 'number') {
    return viewportWidth < 850;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  const isNarrow = window.innerWidth < 850;
  const isTouchDevice =
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(max-width: 850px)').matches;
  return Boolean(isNarrow || isTouchDevice);
}

export interface MobileNoticeBannerProps {
  forceVisible?: boolean;
  initialDismissed?: boolean;
}

export const MobileNoticeBanner: React.FC<MobileNoticeBannerProps> = ({
  forceVisible = false,
  initialDismissed,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (initialDismissed !== undefined) return initialDismissed;
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    try {
      return sessionStorage.getItem(MOBILE_NOTICE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() => {
    if (forceVisible) return true;
    return isMobileOrSmallScreen();
  });

  useEffect(() => {
    if (forceVisible) return;

    const checkViewport = () => {
      setIsSmallScreen(isMobileOrSmallScreen());
    };

    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [forceVisible]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(MOBILE_NOTICE_STORAGE_KEY, '1');
      }
    } catch {
      // Ignore storage errors in private mode
    }
  };

  if (isDismissed || (!isSmallScreen && !forceVisible)) {
    return null;
  }

  return (
    <div
      data-testid="mobile-notice-banner"
      className="mobile-notice-banner"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 560px)',
        zIndex: 100,
        backgroundColor: '#1e1b4b',
        border: '1px solid #6366f1',
        borderRadius: '10px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        padding: '12px 16px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#c7d2fe' }}>
          <Monitor size={18} color="#818cf8" />
          <span>Großer Bildschirm empfohlen</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Hinweis schließen"
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.35', color: '#cbd5e1' }}>
        Wohnung-3D-Planner ist für präzise 2D/3D-Raumplanung mit Maus und Tastatur an Desktop-Monitoren konzipiert. Auf Smartphones und kleinen Bildschirmen ist die Bedienung nur sehr eingeschränkt möglich.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
        <button
          type="button"
          className="btn active"
          onClick={handleDismiss}
          style={{
            fontSize: '0.8rem',
            padding: '5px 12px',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Verstanden
        </button>
      </div>
    </div>
  );
};
