import type { Language } from '../../i18n/types';

export function formatTimeOfDay(hour: number, lang?: Language): string {
  const activeLang = lang ?? 'de';
  if (!Number.isFinite(hour)) {
    return activeLang === 'en' ? '12:00' : '12:00 Uhr';
  }
  const clamped = Math.max(0, Math.min(24, hour));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  const normalizedH = m === 60 ? (h + 1) % 24 : h;
  const normalizedM = m === 60 ? 0 : m;
  const time = `${String(normalizedH).padStart(2, '0')}:${String(normalizedM).padStart(2, '0')}`;
  return activeLang === 'en' ? time : `${time} Uhr`;
}
