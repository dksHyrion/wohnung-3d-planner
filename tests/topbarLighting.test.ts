import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { formatTimeOfDay, TopBar } from '../src/components/layout/TopBar';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { MoodPresetKey } from '../src/core/lighting/moodPresets';

describe('TopBar Atmosphere Controls', () => {
  beforeEach(() => {
    useFloorplanStore.setState({
      timeOfDay: 18.0,
      activeMoodKey: 'golden_hour',
      qualityMode: 'beauty',
      viewMode: '3d-persp',
    });
  });

  describe('formatTimeOfDay', () => {
    it('formats round hours correctly', () => {
      expect(formatTimeOfDay(8.0)).toBe('08:00 Uhr');
      expect(formatTimeOfDay(18.0)).toBe('18:00 Uhr');
      expect(formatTimeOfDay(22.0)).toBe('22:00 Uhr');
    });

    it('formats fractional hours correctly', () => {
      expect(formatTimeOfDay(8.25)).toBe('08:15 Uhr');
      expect(formatTimeOfDay(12.5)).toBe('12:30 Uhr');
      expect(formatTimeOfDay(20.75)).toBe('20:45 Uhr');
    });

    it('guards against non-finite inputs gracefully', () => {
      expect(formatTimeOfDay(NaN)).toBe('12:00 Uhr');
      expect(formatTimeOfDay(Infinity)).toBe('12:00 Uhr');
      expect(formatTimeOfDay(-Infinity)).toBe('12:00 Uhr');
    });
  });

  describe('Store synchronization on preset selection and quality toggles', () => {
    it('synchronizes timeOfDay and activeMoodKey on preset selection', () => {
      const { setMoodPreset, setTimeOfDay } = useFloorplanStore.getState();

      const presets: { key: MoodPresetKey; expectedHour: number }[] = [
        { key: 'neutral', expectedHour: 12.0 },
        { key: 'morning', expectedHour: 8.0 },
        { key: 'noon', expectedHour: 12.5 },
        { key: 'golden_hour', expectedHour: 18.0 },
        { key: 'blue_hour', expectedHour: 20.5 },
        { key: 'night', expectedHour: 22.0 },
      ];

      for (const { key, expectedHour } of presets) {
        setMoodPreset(key);
        expect(useFloorplanStore.getState().activeMoodKey).toBe(key);
        expect(useFloorplanStore.getState().timeOfDay).toBe(expectedHour);
      }

      // Manual time of day change sets activeMoodKey to 'custom'
      setTimeOfDay(15.25);
      expect(useFloorplanStore.getState().timeOfDay).toBe(15.25);
      expect(useFloorplanStore.getState().activeMoodKey).toBe('custom');
    });

    it('toggles qualityMode correctly between performance and beauty', () => {
      const { setQualityMode } = useFloorplanStore.getState();

      setQualityMode('performance');
      expect(useFloorplanStore.getState().qualityMode).toBe('performance');

      setQualityMode('beauty');
      expect(useFloorplanStore.getState().qualityMode).toBe('beauty');
    });
  });

  describe('TopBar rendering', () => {
    it('renders atmosphere controls in 3D perspective mode with accessibility attributes', () => {
      useFloorplanStore.setState({
        viewMode: '3d-persp',
        activeMoodKey: 'golden_hour',
        qualityMode: 'beauty',
        timeOfDay: 18.0,
      });

      const html = renderToString(React.createElement(TopBar));

      // Atmosphere group present
      expect(html).toContain('aria-label="Licht &amp; Atmosphäre"');

      // Slider present with min=6, max=22, step=0.25, and a11y labels
      expect(html).toContain('type="range"');
      expect(html).toContain('min="6"');
      expect(html).toContain('max="22"');
      expect(html).toContain('step="0.25"');
      expect(html).toContain('aria-label="Tageszeit"');
      expect(html).toContain('aria-valuetext="18:00 Uhr"');

      // Clock readout present
      expect(html).toContain('18:00 Uhr');

      // 6 preset buttons present with aria-pressed on active mood
      expect(html).toContain('Neutral');
      expect(html).toContain('Morgen');
      expect(html).toContain('Mittag');
      expect(html).toContain('Golden Hour');
      expect(html).toContain('Blaue Std.');
      expect(html).toContain('Nacht');
      expect(html).toContain('aria-pressed="true"');

      // Quality mode toggle button present with a11y attributes
      expect(html).toContain('Schön');
      expect(html).toContain('aria-label="Grafikqualität: Schön (mit N8AO &amp; Bloom)"');
    });

    it('hides atmosphere toolbar when in 2D mode to reduce clutter', () => {
      useFloorplanStore.setState({
        viewMode: '2d',
      });

      const html = renderToString(React.createElement(TopBar));

      // Atmosphere group should not be rendered
      expect(html).not.toContain('aria-label="Licht &amp; Atmosphäre"');
      expect(html).not.toContain('aria-label="Tageszeit"');
    });
  });
});
