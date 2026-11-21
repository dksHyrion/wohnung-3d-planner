import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { TopBar } from '../src/components/layout/TopBar';
import { TopBarMenu } from '../src/components/layout/TopBarMenu';

describe('Sprint 2: Compact TopBar Menus & Lazy-Loading', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('standard-55');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('TopBarMenu renders accessible details/summary popover with optional badge', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <TopBarMenu label="Anzeige" badge={2} align="right">
        <button type="button">Option A</button>
      </TopBarMenu>
    );
    expect(html).toContain('<details class="topbar-menu">');
    expect(html).toContain('Anzeige');
    expect(html).toContain('topbar-menu-badge');
    expect(html).toContain('align-right');
    expect(html).toContain('Option A');
  });

  it('TopBar groups display toggles and file/export actions into compact dropdowns (DE & EN)', () => {
    const deHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
    expect(deHtml).toContain('Anzeige');
    expect(deHtml).toContain('Datei &amp; Export');

    useFloorplanStore.getState().setLanguage('en');
    const enHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
    expect(enHtml).toContain('Display');
    expect(enHtml).toContain('File &amp; Export');
  });
});
