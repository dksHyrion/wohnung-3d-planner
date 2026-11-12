import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { t, getTranslation, setGlobalLanguage, getGlobalLanguage, subscribeLanguage } from '../src/i18n/i18n';
import type { TranslationKey } from '../src/i18n/types';
import { useTranslation } from '../src/i18n/useTranslation';
import { de } from '../src/i18n/locales/de';
import { en } from '../src/i18n/locales/en';

describe('i18n core subsystem', () => {
  beforeEach(() => {
    setGlobalLanguage('de');
  });

  it('resolves top-level and nested keys in German (default)', () => {
    expect(getGlobalLanguage()).toBe('de');
    expect(t('common.cancel')).toBe('Abbrechen');
    expect(t('common.save')).toBe('Speichern');
    expect(t('topbar.tools.select')).toBe('Auswählen');
    expect(t('topbar.tools.wall')).toBe('Wand zeichnen');
    expect(t('topbar.tools.door')).toBe('Tür einsetzen');
    expect(t('topbar.tools.window')).toBe('Fenster einsetzen');
    expect(t('topbar.tools.measure')).toBe('Messen');
  });

  it('resolves top-level and nested keys in English', () => {
    setGlobalLanguage('en');
    expect(getGlobalLanguage()).toBe('en');
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('common.save')).toBe('Save');
    expect(t('topbar.tools.select')).toBe('Select');
    expect(t('topbar.tools.wall')).toBe('Draw Wall');
    expect(t('topbar.tools.door')).toBe('Insert Door');
    expect(t('topbar.tools.window')).toBe('Insert Window');
    expect(t('topbar.tools.measure')).toBe('Measure');
  });

  it('interpolates dynamic parameters correctly', () => {
    setGlobalLanguage('de');
    expect(t('export.scaleValue' as TranslationKey, { scale: '1:50' }) /* dialogs alias */).toBe('Maßstab 1:50');
    expect(t('dialogs.export.scaleValue', { scale: '1:50' })).toBe('Maßstab 1:50');
    expect(t('catalog.itemsCount', { count: 42 })).toBe('42 Objekte');
    expect(
      t('ergonomics.passageWarning', { actual: 75, min: 90 })
    ).toBe('Hauptdurchgang zu schmal (75 cm < 90 cm)');

    setGlobalLanguage('en');
    expect(t('export.scaleValue' as TranslationKey, { scale: '1:50' }) /* dialogs alias */).toBe('Scale 1:50');
    expect(t('dialogs.export.scaleValue', { scale: '1:50' })).toBe('Scale 1:50');
    expect(t('catalog.itemsCount', { count: 42 })).toBe('42 items');
    expect(
      t('ergonomics.passageWarning', { actual: 75, min: 90 })
    ).toBe('Passage too narrow (75 cm < 90 cm)');
  });

  it('falls back gracefully to key or German if key is missing in English', () => {
    expect(getTranslation('en', 'common.save')).toBe('Save');
    expect(getTranslation('en', 'nonexistent.key.path' as TranslationKey)).toBe('nonexistent.key.path');
    expect(getTranslation('de', 'nonexistent.key.path' as TranslationKey)).toBe('nonexistent.key.path');
  });

  it('falls back to German when a key exists in German but is missing in English', () => {
    (de as any).temporaryFallbackTestKey = 'Temporärer deutscher Text';
    try {
      expect(getTranslation('en', 'temporaryFallbackTestKey' as TranslationKey)).toBe('Temporärer deutscher Text');
      setGlobalLanguage('en');
      expect(t('temporaryFallbackTestKey' as TranslationKey)).toBe('Temporärer deutscher Text');
    } finally {
      delete (de as any).temporaryFallbackTestKey;
    }
  });


  it('guarantees 100% dictionary key parity between German and English', () => {
    function getKeys(obj: any, prefix = ''): string[] {
      return Object.keys(obj).flatMap((key) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof obj[key] === 'object' && obj[key] !== null
          ? getKeys(obj[key], path)
          : [path];
      });
    }

    const deKeys = getKeys(de).sort();
    const enKeys = getKeys(en).sort();
    expect(enKeys).toEqual(deKeys);
    expect(deKeys.length).toBeGreaterThan(60);
  });

  it('verifies all required sections are comprehensively populated in both locales', () => {
    // common
    expect(de.common.cancel).toBe('Abbrechen');
    expect(en.common.cancel).toBe('Cancel');
    expect(de.common.none).toBe('Keine');
    expect(en.common.none).toBe('None');

    // topbar
    expect(de.topbar.views.mode2d).toBe('2D Grundriss');
    expect(en.topbar.views.mode2d).toBe('2D Floorplan');
    expect(de.topbar.cameraPresets.isometric).toBe('Isometrie');
    expect(en.topbar.cameraPresets.isometric).toBe('Isometric');
    expect(de.topbar.actions.wallSnapping).toBe('Wandsnapping');
    expect(en.topbar.actions.wallSnapping).toBe('Wall Snapping');

    // lighting
    expect(de.lighting.presets.goldenHour).toBe('Golden Hour');
    expect(en.lighting.presets.goldenHour).toBe('Golden Hour');
    expect(de.lighting.presets.night).toBe('Nacht');
    expect(en.lighting.presets.night).toBe('Night');
    expect(de.lighting.options.wallCaps).toBe('Wandabdeckungen');
    expect(en.lighting.options.wallCaps).toBe('Wall Caps');

    // dialogs
    expect(de.dialogs.shortcuts.title).toBe('Tastaturkürzel');
    expect(en.dialogs.shortcuts.title).toBe('Keyboard Shortcuts');
    expect(de.dialogs.json.title).toBe('Grundriss als JSON');
    expect(en.dialogs.json.title).toBe('Floorplan JSON');
    expect(de.dialogs.overlay.title).toBe('Hintergrund-Vorlage (Scan)');
    expect(en.dialogs.overlay.title).toBe('Background Underlay (Scan)');
    expect(de.dialogs.mobile.bannerText).toBe('Optimiert für Desktop mit Maus & Tastatur');
    expect(en.dialogs.mobile.bannerText).toBe('Optimized for desktop with mouse & keyboard');

    // inspector
    expect(de.inspector.wall.title).toBe('Wandeigenschaften');
    expect(en.inspector.wall.title).toBe('Wall Properties');
    expect(de.inspector.room.flooringTypes.parquet).toBe('Parkett');
    expect(en.inspector.room.flooringTypes.parquet).toBe('Parquet');
    expect(de.inspector.furniture.sofaBedUnfolded).toBe('Ausgeklappt (Schlafsofa)');
    expect(en.inspector.furniture.sofaBedUnfolded).toBe('Unfolded (Sofa Bed)');
    expect(de.inspector.rug.pattern).toBe('Muster');
    expect(en.inspector.rug.pattern).toBe('Pattern');

    // catalog
    expect(de.catalog.categories.living).toBe('Wohnen');
    expect(en.catalog.categories.living).toBe('Living');
    expect(de.catalog.categories.storage).toBe('Aufbewahrung');
    expect(en.catalog.categories.storage).toBe('Storage');

    // ergonomics
    expect(de.ergonomics.wheelchairCircleNotice).toBe('Rollstuhl-Wendekreis (Ø 150 cm)');
    expect(en.ergonomics.wheelchairCircleNotice).toBe('Wheelchair turning circle (Ø 150 cm)');
  });

  it('notifies subscribers when language changes and ignores identical assignments', () => {
    let callCount = 0;
    const unsubscribe = subscribeLanguage(() => {
      callCount++;
    });

    // Setting same language (currently 'de') should not fire
    setGlobalLanguage('de');
    expect(callCount).toBe(0);

    setGlobalLanguage('en');
    expect(callCount).toBe(1);
    expect(getGlobalLanguage()).toBe('en');

    // Setting 'en' again should not fire
    setGlobalLanguage('en');
    expect(callCount).toBe(1);

    setGlobalLanguage('de');
    expect(callCount).toBe(2);
    expect(getGlobalLanguage()).toBe('de');

    unsubscribe();
    setGlobalLanguage('en');
    expect(callCount).toBe(2);
  });

  it('renders localized content via useTranslation hook', () => {
    setGlobalLanguage('de');

    const TestComponent: React.FC = () => {
      const { t, language } = useTranslation();
      return React.createElement(
        'div',
        { 'data-lang': language },
        React.createElement('span', null, t('common.save')),
        React.createElement('span', null, t('dialogs.export.scaleValue', { scale: '1:100' }))
      );
    };

    const htmlDe = ReactDOMServer.renderToStaticMarkup(React.createElement(TestComponent));
    expect(htmlDe).toContain('data-lang="de"');
    expect(htmlDe).toContain('Speichern');
    expect(htmlDe).toContain('Maßstab 1:100');

    setGlobalLanguage('en');
    const htmlEn = ReactDOMServer.renderToStaticMarkup(React.createElement(TestComponent));
    expect(htmlEn).toContain('data-lang="en"');
    expect(htmlEn).toContain('Save');
    expect(htmlEn).toContain('Scale 1:100');
  });
});
