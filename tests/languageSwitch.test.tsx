import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { LanguageSwitch } from '../src/components/layout/LanguageSwitch';
import { TopBar } from '../src/components/layout/TopBar';

describe('LanguageSwitch and TopBar localization', () => {
  beforeEach(() => {
    useFloorplanStore.getState().setLanguage('de');
    useFloorplanStore.setState({
      viewMode: '3d-persp',
      cameraPreset: 'axonometric',
    });
  });

  describe('LanguageSwitch component', () => {
    it('renders DE as pressed when language is "de"', () => {
      useFloorplanStore.getState().setLanguage('de');
      const html = ReactDOMServer.renderToStaticMarkup(<LanguageSwitch />);

      expect(html).toContain('DE');
      expect(html).toContain('EN');
      expect(html).toContain('role="group"');
      expect(html).toContain('aria-label="Sprache wechseln"');

      // DE button has aria-pressed="true", EN has aria-pressed="false"
      expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?DE[\s\S]*?<\/button>/);
      expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?EN[\s\S]*?<\/button>/);
    });

    it('renders EN as pressed when language is "en"', () => {
      useFloorplanStore.getState().setLanguage('en');
      const html = ReactDOMServer.renderToStaticMarkup(<LanguageSwitch />);

      expect(html).toContain('DE');
      expect(html).toContain('EN');
      expect(html).toContain('aria-label="Switch Language"');

      // EN button has aria-pressed="true", DE has aria-pressed="false"
      expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?EN[\s\S]*?<\/button>/);
      expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[\s\S]*?DE[\s\S]*?<\/button>/);
    });
  });

  describe('TopBar localization', () => {
    it('renders localized tools, views, and actions in German by default', () => {
      useFloorplanStore.getState().setLanguage('de');
      useFloorplanStore.setState({ viewMode: '3d-persp' });

      const html = ReactDOMServer.renderToStaticMarkup(<TopBar />);

      // Tools
      expect(html).toContain('Auswählen');
      expect(html).toContain('Wand zeichnen');

      // Views
      expect(html).toContain('2D Grundriss');

      // Lighting & Atmosphere (in 3D mode)
      expect(html).toMatch(/Licht &(?:amp;)? Atmosphäre/);

      // Actions
      expect(html).toContain('Rückgängig');
      expect(html).toContain('Wiederholen');
      expect(html).toContain('Cutaway-Wände');
      expect(html).toContain('0 Konflikte');

      // Groups
      expect(html).toContain('aria-label="Ansichtsmodus"');
      expect(html).toContain('aria-label="Editor-Werkzeuge"');
      expect(html).toContain('aria-label="Verlauf (Undo/Redo)"');
      expect(html).toContain('aria-label="Kamera-Perspektive"');
    });

    it('renders localized tools, views, and actions in English when language is "en"', () => {
      useFloorplanStore.getState().setLanguage('en');
      useFloorplanStore.setState({ viewMode: '3d-persp' });

      const html = ReactDOMServer.renderToStaticMarkup(<TopBar />);

      // Tools
      expect(html).toContain('Select');
      expect(html).toContain('Draw Wall');

      // Views
      expect(html).toContain('2D Floorplan');

      // Lighting & Atmosphere (in 3D mode)
      expect(html).toMatch(/Lighting &(?:amp;)? Atmosphere/);

      // Actions
      expect(html).toContain('Undo');
      expect(html).toContain('Redo');
      expect(html).toContain('Cutaway Walls');
      expect(html).toContain('0 Conflicts');

      // Groups
      expect(html).toContain('aria-label="View Mode"');
      expect(html).toContain('aria-label="Editor Tools"');
      expect(html).toContain('aria-label="History (Undo/Redo)"');
      expect(html).toContain('aria-label="Camera Perspective"');
    });
  });
});
