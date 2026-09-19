// src/lib/forecastGrouping.ts
import { ForecastData } from './types';

export interface GroupForecastOptions {
  forecast: ForecastData;
  timezone: string;
  language: string;
  t: (key: string) => string;
  currentDate?: Date;
}

/**
 * Returns ordinal suffix for a day number in English ('st', 'nd', 'rd', 'th').
 * For non-English languages, returns an empty string.
 */
export const getOrdinalSuffix = (day: number, language: string): string => {
  if (language === 'en') {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }
  return '';
};

/**
 * Formats a calendar date relative to currentDate in the location's timezone.
 * Returns:
 * - "Today" / "Tonight" (or locale equivalent) if date matches currentDate
 * - "Tomorrow" (or locale equivalent) if date matches tomorrow
 * - Capitalized weekday + day of month (+ suffix in EN) for subsequent days
 */
export const formatDateDisplay = (
  date: Date,
  currentDate: Date,
  language: string,
  t: (key: string) => string
): string => {
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const forecastDate = new Date(date);
  forecastDate.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const currentHour = currentDate.getHours();

  if (forecastDate.getTime() === today.getTime()) {
    return currentHour >= 18 ? t('tonight_forecast') : t('today_forecast');
  } else if (forecastDate.getTime() === tomorrow.getTime()) {
    return t('tomorrow_forecast');
  } else {
    const locale = language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'es-ES';
    const dayNameRaw = date.toLocaleDateString(locale, { weekday: 'long' });
    const dayName = dayNameRaw ? dayNameRaw.charAt(0).toUpperCase() + dayNameRaw.slice(1) : '';
    const day = date.getDate();
    return `${dayName} ${day}${getOrdinalSuffix(day, language)}`;
  }
};

/**
 * Formats timestamp to location's timezone in 24-hour format.
 * Uses 'h' separator for French (e.g. 14h00), ':' for other languages (e.g. 14:00).
 */
export const formatForecastTime = (
  timestamp: number,
  timezone: string,
  language: string
): string => {
  let formattedTime: string;
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  try {
    formattedTime = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || 'UTC',
      hour12: false,
    }).format(new Date(timestamp * 1000));
  } catch (error) {
    console.debug('Error in formatForecastTime:', error);
    formattedTime = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }).format(new Date(timestamp * 1000));
  }
  return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
};

/**
 * Groups forecast data into:
 * 1. 'next_24_hours': rolling upcoming 24-hour forecast window starting from the current hour.
 * 2. Daily groups starting from Tomorrow (full calendar days from 00:00 to 24:00).
 *
 * Tomorrow and subsequent days contain all hourly slots of their respective calendar days,
 * ensuring tomorrow is not truncated by the rolling next-hours window.
 */
export const groupForecastByDay = ({
  forecast,
  timezone,
  language,
  t,
  currentDate = new Date(),
}: GroupForecastOptions) => {
  // Adjust current time to the location's timezone
  const currentLocalTime = new Date(
    currentDate.toLocaleString('en-US', { timeZone: timezone || 'UTC' })
  );

  const grouped: {
    [key: string]: {
      dt: number;
      main: { temp: number };
      weather: { description: string; icon: string }[];
    }[];
  } = {};
  const dateLabels: { [key: string]: string } = {};

  // All upcoming future items starting from current time
  const futureItems = forecast.list
    .filter((item) => {
      const date = new Date(item.dt * 1000);
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
      return localDate.getTime() >= currentLocalTime.getTime();
    })
    .sort((a, b) => a.dt - b.dt);

  const nowSec = Math.floor(currentDate.getTime() / 1000);
  const next24Items = futureItems.filter((item) => item.dt - nowSec <= 24 * 3600);

  // Group 1: rolling next 24 hours
  if (next24Items.length > 0) {
    grouped['next_24_hours'] = next24Items;
    dateLabels['next_24_hours'] = t('next_hours_forecast');
  }

  // Calendar days: tomorrow starts at 00:00:00 of the day after today
  const startOfTomorrow = new Date(currentLocalTime);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);

  // When next_24_hours is available, daily groups display upcoming full calendar days
  // starting from tomorrow (00:00 to 24:00).
  // If next_24_hours is not available, fall back to grouping all future items.
  const dailyItems = (next24Items.length > 0
    ? forecast.list.filter((item) => {
        const date = new Date(item.dt * 1000);
        const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
        return localDate.getTime() >= startOfTomorrow.getTime();
      })
    : futureItems
  ).sort((a, b) => a.dt - b.dt);

  dailyItems.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
    const dateKey = localDate.toLocaleDateString();
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
      dateLabels[dateKey] = formatDateDisplay(localDate, currentLocalTime, language, t);
    }
    grouped[dateKey].push(item);
  });

  return { grouped, dateLabels };
};
