import { test, expect } from '@playwright/test';
import {
  getSunTimesForDate,
  getSunEventsForItems,
  filterSunEventsToWindow,
  mergeTimeline,
} from '@/lib/sunTimes';

test.describe('Sun times helpers', () => {
  test('computes sunrise before sunset for Paris on the summer solstice', () => {
    const date = new Date('2026-06-21T12:00:00Z');
    const { sunrise, sunset } = getSunTimesForDate(date, 48.8566, 2.3522, 'Europe/Paris');

    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    expect(sunrise as number).toBeLessThan(sunset as number);

    // Paris sunrise on 2026-06-21 is around 03:48 UTC (05:48 CEST).
    const sunriseUtcHour = new Date((sunrise as number) * 1000).getUTCHours();
    expect(sunriseUtcHour).toBeGreaterThanOrEqual(2);
    expect(sunriseUtcHour).toBeLessThanOrEqual(4);
  });

  test('anchors events on the requested local day for far-east timezones', () => {
    // 11:00 on 2026-06-21 in Pacific/Auckland (UTC+12).
    const date = new Date('2026-06-20T23:00:00Z');
    const { sunrise } = getSunTimesForDate(date, -36.8485, 174.7633, 'Pacific/Auckland');

    expect(sunrise).not.toBeNull();
    const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(
      new Date((sunrise as number) * 1000)
    );
    expect(localDay).toBe('2026-06-21');
  });

  test('returns null sunrise and sunset during polar day', () => {
    // Svalbard in midsummer: the sun never sets.
    const date = new Date('2026-06-21T12:00:00Z');
    const { sunrise, sunset } = getSunTimesForDate(date, 78.2232, 15.6267, 'Arctic/Longyearbyen');

    expect(sunrise).toBeNull();
    expect(sunset).toBeNull();
  });

  test('collects one sunrise and one sunset per local day, sorted', () => {
    // 2026-06-21 00:00 Paris (CEST, UTC+2) = 2026-06-20T22:00Z; 48 hourly slots
    // cover exactly two local calendar days (21st and 22nd).
    const start = Math.floor(Date.UTC(2026, 5, 20, 22, 0, 0) / 1000);
    const items = Array.from({ length: 48 }, (_, h) => ({ dt: start + h * 3600 }));

    const events = getSunEventsForItems(items, 48.8566, 2.3522, 'Europe/Paris');

    expect(events.filter((event) => event.kind === 'sunrise')).toHaveLength(2);
    expect(events.filter((event) => event.kind === 'sunset')).toHaveLength(2);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].dt).toBeGreaterThanOrEqual(events[i - 1].dt);
    }
  });

  test('filters out sun events that fall outside the rolling window', () => {
    const items = [{ dt: 1000 }, { dt: 2000 }];
    const events = [
      { kind: 'sunrise' as const, dt: 500 },
      { kind: 'sunset' as const, dt: 1500 },
      { kind: 'sunset' as const, dt: 9000 },
    ];

    expect(filterSunEventsToWindow(events, items)).toEqual([{ kind: 'sunset', dt: 1500 }]);
  });

  test('interleaves sun events among forecast hours by timestamp', () => {
    const items = [{ dt: 100 }, { dt: 200 }, { dt: 300 }];
    const events = [
      { kind: 'sunrise' as const, dt: 150 },
      { kind: 'sunset' as const, dt: 250 },
    ];

    const timeline = mergeTimeline(items, events);

    expect(timeline.map((entry) => entry.kind)).toEqual(['hour', 'sunrise', 'hour', 'sunset', 'hour']);
    expect(timeline.map((entry) => entry.dt)).toEqual([100, 150, 200, 250, 300]);
  });

  test('places the forecast hour before a marker sharing the same timestamp', () => {
    const items = [{ dt: 100 }];
    const events = [{ kind: 'sunrise' as const, dt: 100 }];

    expect(mergeTimeline(items, events).map((entry) => entry.kind)).toEqual(['hour', 'sunrise']);
  });
});
