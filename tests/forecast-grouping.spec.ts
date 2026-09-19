import { test, expect } from '@playwright/test';
import {
  groupForecastByDay,
  formatDateDisplay,
  formatForecastTime,
  getOrdinalSuffix,
} from '@/lib/forecastGrouping';
import { ForecastData } from '@/lib/types';
import frTranslations from '@/locales/fr.json';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';

const getTranslator = (translations: Record<string, string>) => (key: string) =>
  translations[key] || key;

describeForecastGrouping();

function describeForecastGrouping() {
  test.describe('Forecast Grouping Logic', () => {
    test('at 22:00, Tomorrow includes all 24 hours of tomorrow (00:00 to 23:00)', () => {
      // 2026-09-18 20:00:00 UTC = 2026-09-18 22:00:00 in Europe/Paris (UTC+2)
      const baseDate = new Date('2026-09-18T20:00:00Z');
      const baseSec = Math.floor(baseDate.getTime() / 1000);
      const timezone = 'Europe/Paris';
      const t = getTranslator(frTranslations);

      // Hourly forecast items covering today, tomorrow, and subsequent days
      const list: ForecastData['list'] = [];
      for (let h = -2; h < 72; h++) {
        list.push({
          dt: baseSec + h * 3600,
          main: { temp: 18 + Math.sin(h / 4) * 4 },
          weather: [{ id: 800, main: 'Clear', description: 'ciel dégagé', icon: '01d' }],
        });
      }

      const { grouped, dateLabels } = groupForecastByDay({
        forecast: { list },
        timezone,
        language: 'fr',
        t,
        currentDate: baseDate,
      });

      const groupKeys = Object.keys(grouped);

      // 1. First block is 'next_24_hours' with translated label "Les prochaines heures"
      expect(groupKeys[0]).toBe('next_24_hours');
      expect(dateLabels['next_24_hours']).toBe('Les prochaines heures');
      expect(grouped['next_24_hours'].length).toBe(25); // 22h today to 22h tomorrow inclusive

      // 2. The block directly beneath 'next_24_hours' is Tomorrow ("Demain")
      const tomorrowKey = groupKeys[1];
      expect(dateLabels[tomorrowKey]).toBe('Demain');

      // 3. Tomorrow MUST contain all 24 hours of tomorrow (00:00 to 23:00)
      const tomorrowItems = grouped[tomorrowKey];
      expect(tomorrowItems.length).toBe(24);

      // Verify the first hour of tomorrow is 00:00 Paris time
      const firstHourTomorrow = formatForecastTime(tomorrowItems[0].dt, timezone, 'fr');
      expect(firstHourTomorrow).toBe('00h00');

      // Verify the last hour of tomorrow is 23:00 Paris time
      const lastHourTomorrow = formatForecastTime(
        tomorrowItems[tomorrowItems.length - 1].dt,
        timezone,
        'fr'
      );
      expect(lastHourTomorrow).toBe('23h00');

      // 4. Day after tomorrow (Day+2) also has all 24 hours
      const day2Key = groupKeys[2];
      const day2Items = grouped[day2Key];
      expect(day2Items.length).toBe(24);
      expect(formatForecastTime(day2Items[0].dt, timezone, 'fr')).toBe('00h00');
      expect(formatForecastTime(day2Items[day2Items.length - 1].dt, timezone, 'fr')).toBe('23h00');
    });

    test('at 10:00 AM, Tomorrow includes all 24 hours and is not truncated', () => {
      // 2026-09-19 08:00:00 UTC = 2026-09-19 10:00:00 in Europe/Paris (UTC+2)
      const baseDate = new Date('2026-09-19T08:00:00Z');
      const baseSec = Math.floor(baseDate.getTime() / 1000);
      const timezone = 'Europe/Paris';
      const t = getTranslator(enTranslations);

      const list: ForecastData['list'] = [];
      for (let h = 0; h < 60; h++) {
        list.push({
          dt: baseSec + h * 3600,
          main: { temp: 20 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        });
      }

      const { grouped, dateLabels } = groupForecastByDay({
        forecast: { list },
        timezone,
        language: 'en',
        t,
        currentDate: baseDate,
      });

      const groupKeys = Object.keys(grouped);
      expect(groupKeys[0]).toBe('next_24_hours');
      expect(dateLabels['next_24_hours']).toBe('Next hours');

      // Tomorrow block contains all 24 hours
      const tomorrowKey = groupKeys[1];
      expect(dateLabels[tomorrowKey]).toBe('Tomorrow');
      expect(grouped[tomorrowKey].length).toBe(24);
      expect(formatForecastTime(grouped[tomorrowKey][0].dt, timezone, 'en')).toBe('00:00');
      expect(formatForecastTime(grouped[tomorrowKey][23].dt, timezone, 'en')).toBe('23:00');
    });

    test('handles timezones correctly (America/New_York)', () => {
      // 2026-09-19 03:00:00 UTC = 2026-09-18 23:00:00 in America/New_York (UTC-4)
      const baseDate = new Date('2026-09-19T03:00:00Z');
      const baseSec = Math.floor(baseDate.getTime() / 1000);
      const timezone = 'America/New_York';
      const t = getTranslator(enTranslations);

      const list: ForecastData['list'] = [];
      for (let h = -5; h < 50; h++) {
        list.push({
          dt: baseSec + h * 3600,
          main: { temp: 22 },
          weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
        });
      }

      const { grouped, dateLabels } = groupForecastByDay({
        forecast: { list },
        timezone,
        language: 'en',
        t,
        currentDate: baseDate,
      });

      const groupKeys = Object.keys(grouped);
      const tomorrowKey = groupKeys[1];
      expect(dateLabels[tomorrowKey]).toBe('Tomorrow');
      expect(grouped[tomorrowKey].length).toBe(24);
      expect(formatForecastTime(grouped[tomorrowKey][0].dt, timezone, 'en')).toBe('00:00');
      expect(formatForecastTime(grouped[tomorrowKey][23].dt, timezone, 'en')).toBe('23:00');
    });

    test('formatDateDisplay supports French, English, and Spanish translations', () => {
      const today = new Date('2026-09-19T10:00:00Z');
      const tomorrow = new Date('2026-09-20T10:00:00Z');
      const day2 = new Date('2026-09-21T10:00:00Z');

      const tFr = getTranslator(frTranslations);
      const tEn = getTranslator(enTranslations);
      const tEs = getTranslator(esTranslations);

      expect(formatDateDisplay(tomorrow, today, 'fr', tFr)).toBe('Demain');
      expect(formatDateDisplay(tomorrow, today, 'en', tEn)).toBe('Tomorrow');
      expect(formatDateDisplay(tomorrow, today, 'es', tEs)).toBe('Mañana');

      expect(formatDateDisplay(day2, today, 'fr', tFr)).toBe('Lundi 21');
      expect(formatDateDisplay(day2, today, 'en', tEn)).toBe('Monday 21st');
      expect(formatDateDisplay(day2, today, 'es', tEs)).toBe('Lunes 21');
    });

    test('formatForecastTime formats hours with h in French and : in others', () => {
      // 14:30 UTC
      const timestamp = new Date('2026-09-19T14:30:00Z').getTime() / 1000;
      expect(formatForecastTime(timestamp, 'UTC', 'fr')).toBe('14h30');
      expect(formatForecastTime(timestamp, 'UTC', 'en')).toBe('14:30');
      expect(formatForecastTime(timestamp, 'UTC', 'es')).toBe('14:30');
    });

    test('getOrdinalSuffix handles numbers properly', () => {
      expect(getOrdinalSuffix(1, 'en')).toBe('st');
      expect(getOrdinalSuffix(2, 'en')).toBe('nd');
      expect(getOrdinalSuffix(3, 'en')).toBe('rd');
      expect(getOrdinalSuffix(4, 'en')).toBe('th');
      expect(getOrdinalSuffix(11, 'en')).toBe('th');
      expect(getOrdinalSuffix(12, 'en')).toBe('th');
      expect(getOrdinalSuffix(13, 'en')).toBe('th');
      expect(getOrdinalSuffix(21, 'en')).toBe('st');
      expect(getOrdinalSuffix(22, 'en')).toBe('nd');
      expect(getOrdinalSuffix(23, 'en')).toBe('rd');
      expect(getOrdinalSuffix(1, 'fr')).toBe('');
      expect(getOrdinalSuffix(1, 'es')).toBe('');
    });

    test('falls back gracefully when next_24_hours has no future items', () => {
      const now = new Date('2026-09-19T10:00:00Z');
      const t = getTranslator(frTranslations);

      const { grouped } = groupForecastByDay({
        forecast: { list: [] },
        timezone: 'UTC',
        language: 'fr',
        t,
        currentDate: now,
      });

      expect(grouped['next_24_hours']).toBeUndefined();
      expect(Object.keys(grouped).length).toBe(0);
    });
  });
}
