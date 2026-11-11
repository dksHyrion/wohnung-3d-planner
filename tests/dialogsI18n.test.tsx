import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { KeyboardShortcutsDialog } from '../src/components/layout/KeyboardShortcutsDialog';
import { PlanExportDialog } from '../src/components/layout/PlanExportDialog';
import { JsonPlanDialog } from '../src/components/layout/JsonPlanDialog';
import { LightingControls } from '../src/components/layout/LightingControls';
import { MobileNoticeBanner } from '../src/components/layout/MobileNoticeBanner';

describe('Dialogs Localization (DE / EN)', () => {
  describe('English (EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().setLanguage('en');
      useFloorplanStore.setState({
        showKeyboardShortcuts: true,
        viewMode: '3d-persp',
      });
    });

    it('renders KeyboardShortcutsDialog in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KeyboardShortcutsDialog)
      );
      expect(html).toContain('Keyboard Shortcuts');
      expect(html).toContain('Undo');
      expect(html).toContain('Redo');
      expect(html).toContain('Delete selected element');
      expect(html).toContain('2D Floorplan Navigation');
      expect(html).toContain('3D Camera Navigation');
    });

    it('renders PlanExportDialog in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlanExportDialog, {
          planExportModalOpen: true,
          setPlanExportModalOpen: () => {},
          planScale: '1:50',
          setPlanScale: () => {},
          planPaper: 'A4',
          setPlanPaper: () => {},
          planOrientation: 'landscape',
          setPlanOrientation: () => {},
          planIncludeFurniture: true,
          setPlanIncludeFurniture: () => {},
          planIncludeDimensions: true,
          setPlanIncludeDimensions: () => {},
          planTitle: 'Test Project',
          setPlanTitle: () => {},
          handleDownloadPlanSvg: () => {},
        })
      );
      expect(html).toContain('Export Floorplan');
      expect(html).toContain('Scale');
      expect(html).toContain('Download SVG');
      expect(html).toContain('Paper Format');
      expect(html).toContain('Orientation');
    });

    it('renders JsonPlanDialog in English', () => {
      const exportHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(JsonPlanDialog, {
          jsonModalMode: 'export',
          setJsonModalMode: () => {},
          jsonText: '{}',
          setJsonText: () => {},
          importError: null,
          handleDownloadJson: () => {},
          handleConfirmImport: () => {},
        })
      );
      expect(exportHtml).toContain('Export floorplan JSON');
      expect(exportHtml).toContain('Copy to clipboard');
      expect(exportHtml).toContain('Download as .json');
      expect(exportHtml).toContain('Close');

      const importHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(JsonPlanDialog, {
          jsonModalMode: 'import',
          setJsonModalMode: () => {},
          jsonText: '',
          setJsonText: () => {},
          importError: null,
          handleDownloadJson: () => {},
          handleConfirmImport: () => {},
        })
      );
      expect(importHtml).toContain('Import floorplan JSON');
      expect(importHtml).toContain('Load JSON');
    });

    it('renders LightingControls in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(LightingControls)
      );
      expect(html).toContain('Lighting &amp; Atmosphere');
      expect(html).toContain('Golden Hour');
      expect(html).toContain('Night');
      expect(html).toContain('Room Lights');
      expect(html).toContain('Window Sun');
      expect(html).toContain('Time of Day');
    });

    it('renders MobileNoticeBanner in English', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(MobileNoticeBanner, { forceVisible: true })
      );
      expect(html).toContain('Large screen recommended');
      expect(html).toContain('desktop');
      expect(html).toContain('smartphones');
      expect(html).toContain('Understood');
    });
  });

  describe('German (DE)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().setLanguage('de');
      useFloorplanStore.setState({
        showKeyboardShortcuts: true,
        viewMode: '3d-persp',
      });
    });

    it('renders KeyboardShortcutsDialog in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KeyboardShortcutsDialog)
      );
      expect(html).toContain('Tastaturkürzel');
      expect(html).toContain('Rückgängig (Undo)');
      expect(html).toContain('Wiederholen (Redo)');
      expect(html).toContain('Ausgewähltes Element löschen');
      expect(html).toContain('2D-Grundriss-Navigation');
      expect(html).toContain('3D-Kamera-Navigation');
    });

    it('renders PlanExportDialog in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlanExportDialog, {
          planExportModalOpen: true,
          setPlanExportModalOpen: () => {},
          planScale: '1:50',
          setPlanScale: () => {},
          planPaper: 'A4',
          setPlanPaper: () => {},
          planOrientation: 'landscape',
          setPlanOrientation: () => {},
          planIncludeFurniture: true,
          setPlanIncludeFurniture: () => {},
          planIncludeDimensions: true,
          setPlanIncludeDimensions: () => {},
          planTitle: 'Test Projekt',
          setPlanTitle: () => {},
          handleDownloadPlanSvg: () => {},
        })
      );
      expect(html).toContain('2D-Plan-Export');
      expect(html).toContain('Maßstab');
      expect(html).toContain('SVG herunterladen');
      expect(html).toContain('Papierformat');
      expect(html).toContain('Ausrichtung');
    });

    it('renders JsonPlanDialog in German', () => {
      const exportHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(JsonPlanDialog, {
          jsonModalMode: 'export',
          setJsonModalMode: () => {},
          jsonText: '{}',
          setJsonText: () => {},
          importError: null,
          handleDownloadJson: () => {},
          handleConfirmImport: () => {},
        })
      );
      expect(exportHtml).toContain('Grundriss JSON exportieren');
      expect(exportHtml).toContain('In Zwischenablage kopieren');
      expect(exportHtml).toContain('Als .json herunterladen');
      expect(exportHtml).toContain('Schließen');

      const importHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(JsonPlanDialog, {
          jsonModalMode: 'import',
          setJsonModalMode: () => {},
          jsonText: '',
          setJsonText: () => {},
          importError: null,
          handleDownloadJson: () => {},
          handleConfirmImport: () => {},
        })
      );
      expect(importHtml).toContain('Grundriss JSON importieren');
      expect(importHtml).toContain('JSON laden');
    });

    it('renders LightingControls in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(LightingControls)
      );
      expect(html).toContain('Licht &amp; Atmosphäre');
      expect(html).toContain('Golden Hour');
      expect(html).toContain('Nacht');
      expect(html).toContain('Raumlicht');
      expect(html).toContain('Fenster-Licht');
      expect(html).toContain('Tageszeit');
    });

    it('renders MobileNoticeBanner in German', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(MobileNoticeBanner, { forceVisible: true })
      );
      expect(html).toContain('Großer Bildschirm empfohlen');
      expect(html).toContain('Desktop');
      expect(html).toContain('Smartphones');
      expect(html).toContain('Verstanden');
    });
  });
});
