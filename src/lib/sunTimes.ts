// src/lib/sunTimes.ts
import * as SunCalc from 'suncalc';

/**
 * A structural forecast hour slot carrying a Unix timestamp in seconds.
 * Kept minimal so both the API `ForecastData` items and lightweight test
 * fixtures can be used without casts.
 */
export interface HourlyItem {
  dt: number;
}

export type SunEventKind = 'sunrise' | 'sunset';

/** A sunrise or sunset anchored on a Unix timestamp in seconds. */
export interface SunEvent {
  kind: SunEventKind;
  dt: number;
}

/** Sunrise/sunset for one local calendar day; `null` on polar day/night. */
export interface SunTimes {
  sunrise: number | null;
  sunset: number | null;
}

/**
 * A chronologically ordered hourly frieze slot: either a forecast hour or a
 * sunrise/sunset marker interleaved between the hours.
 */
export type TimelineEntry<T extends HourlyItem> =
  | { kind: 'hour'; dt: number; item: T }
  | SunEvent;

/** Converts a SunCalc `Date` (or its `null` polar-day value) to Unix seconds. */
const toUnixSeconds = (date: Date | null | undefined): number | null => {
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
};

/**
 * Returns the timezone offset in milliseconds to add to UTC to get local time
 * in `timezone` at the given instant (positive east of Greenwich).
 */
export const getTimezoneOffsetMs = (timezone: string, date: Date): number => {
  const parts: Record<string, number> = {};
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
};

/**
 * Builds the UTC instant of local noon for the calendar day containing `date`
 * in `timezone`. Anchoring SunCalc on local noon keeps the computed events on
 * the intended calendar day whatever the location's offset from UTC.
 */
export const getLocalNoon = (date: Date, timezone: string): Date => {
  const parts: Record<string, number> = {};
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  // Two passes so a DST transition settles on the correct offset.
  const firstOffset = getTimezoneOffsetMs(timezone, new Date(noonUtc));
  const offset = getTimezoneOffsetMs(timezone, new Date(noonUtc - firstOffset));
  return new Date(noonUtc - offset);
};

/**
 * Computes sunrise and sunset for the local calendar day containing `date` at
 * the given coordinates, returned as Unix timestamps in seconds.
 */
export const getSunTimesForDate = (
  date: Date,
  latitude: number,
  longitude: number,
  timezone: string
): SunTimes => {
  const times = SunCalc.getTimes(getLocalNoon(date, timezone), latitude, longitude);
  return {
    sunrise: toUnixSeconds(times.sunrise),
    sunset: toUnixSeconds(times.sunset),
  };
};

/** Formats a local calendar day key (`YYYY-MM-DD`) in the target timezone. */
const localDayKey = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/**
 * Collects the sunrise/sunset of every local calendar day covered by the
 * given forecast hours. A rolling 24-hour window can span two days, hence the
 * distinct-day deduplication. Events are returned sorted chronologically.
 */
export const getSunEventsForItems = (
  items: HourlyItem[],
  latitude: number,
  longitude: number,
  timezone: string
): SunEvent[] => {
  const seenDays = new Set<string>();
  const events: SunEvent[] = [];
  for (const item of items) {
    const date = new Date(item.dt * 1000);
    const dayKey = localDayKey(date, timezone);
    if (seenDays.has(dayKey)) continue;
    seenDays.add(dayKey);
    const { sunrise, sunset } = getSunTimesForDate(date, latitude, longitude, timezone);
    if (sunrise !== null) events.push({ kind: 'sunrise', dt: sunrise });
    if (sunset !== null) events.push({ kind: 'sunset', dt: sunset });
  }
  return events.sort((a, b) => a.dt - b.dt);
};

/**
 * Keeps only the sun events happening inside the forecast window, so a rolling
 * window starting mid-day never shows an already-passed sunrise or a sunset
 * that belongs to the following day.
 */
export const filterSunEventsToWindow = (
  events: SunEvent[],
  items: HourlyItem[]
): SunEvent[] => {
  if (items.length === 0) return [];
  const start = Math.min(...items.map((item) => item.dt));
  const end = Math.max(...items.map((item) => item.dt));
  return events.filter((event) => event.dt >= start && event.dt <= end);
};

/**
 * Interleaves sun events among chronologically sorted forecast hours so the
 * hourly frieze can render sunrise/sunset markers in their time slot.
 * On a tie the hour comes first, so the marker sits right after it.
 */
export const mergeTimeline = <T extends HourlyItem>(
  items: T[],
  events: SunEvent[]
): TimelineEntry<T>[] => {
  const entries: TimelineEntry<T>[] = [
    ...items.map((item) => ({ kind: 'hour' as const, dt: item.dt, item })),
    ...events,
  ];
  const rank = (entry: TimelineEntry<T>): number => (entry.kind === 'hour' ? 0 : 1);
  return entries.sort((a, b) => a.dt - b.dt || rank(a) - rank(b));
};
