import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MobileNoticeBanner, isMobileOrSmallScreen } from '../src/components/layout/MobileNoticeBanner';

describe('MobileNoticeBanner Component', () => {
  beforeEach(() => {
    // Clear sessionStorage mock
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  it('detects screen width < 850 as small screen', () => {
    expect(isMobileOrSmallScreen(800)).toBe(true);
    expect(isMobileOrSmallScreen(400)).toBe(true);
    expect(isMobileOrSmallScreen(1200)).toBe(false);
  });

  it('renders notice banner with desktop advice and dismiss button when forced active', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MobileNoticeBanner, { forceVisible: true })
    );

    expect(html).toContain('mobile-notice-banner');
    expect(html).toContain('Großer Bildschirm empfohlen');
    expect(html).toContain('Desktop');
    expect(html).toContain('Smartphones');
    expect(html).toContain('Verstanden');
  });

  it('renders nothing when dismissed in sessionStorage', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MobileNoticeBanner, { initialDismissed: true })
    );

    expect(html).toBe('');
  });
});
