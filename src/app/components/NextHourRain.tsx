// src/app/components/NextHourRain.tsx
'use client';

import { useEffect, useState } from 'react';
import { CloudRain } from 'lucide-react';
import { MinutelyCastSlot } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from './ThemeProvider';

/**
 * Selects the 4 upcoming 15-minute slots whose window has not ended yet.
 *
 * The current time is kept out of the render phase (React purity rule) and
 * refreshed every minute so the four slots keep rolling forward. Before the
 * first client effect the selection is empty, which also avoids hydration
 * drift between the server render and the browser clock.
 */
export function useNextHourRain(slots?: MinutelyCastSlot[]) {
  const [nowSec, setNowSec] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNowSec(Math.floor(Date.now() / 1000));
    updateNow();
    const timer = setInterval(updateNow, 60_000);
    return () => clearInterval(timer);
  }, []);

  const nextFourSlots =
    nowSec === null
      ? []
      : (Array.isArray(slots) ? slots : []).filter((slot) => slot.dt + 900 > nowSec).slice(0, 4);

  const hasUpcomingRain =
    nextFourSlots.length > 0 &&
    nextFourSlots.some(
      (slot) => (slot.precipitation ?? 0) > 0 || (slot.rain ?? 0) > 0 || (slot.snowfall ?? 0) > 0
    );

  const nextHourTotal = nextFourSlots.reduce(
    (total, slot) => total + (slot.precipitation ?? slot.rain ?? 0),
    0
  );

  return { nextFourSlots, hasUpcomingRain, nextHourTotal };
}

interface NextHourRainProps {
  nextFourSlots: MinutelyCastSlot[];
  nextHourTotal: number;
  timezone: string;
  /**
   * `full`: the card used inside the current-conditions box (mobile + desktop).
   * `compact`: a one-line, desktop-oriented summary used in collapsed favorite
   * cards so the next-hour rain stays visible without expanding the card.
   */
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * Dev comment:
 * Shared next-hour precipitation forecast rendering (4 quarter-hour slots).
 *
 *  - `full` is used by `WeatherDisplay` (the current-conditions card).
 *  - `compact` is used by collapsed desktop favorite cards: desktop favorites
 *    are collapsed by default, so the full weather card — and therefore the
 *    next-hour rain block — used to stay hidden until a card was expanded.
 */
export default function NextHourRain({
  nextFourSlots,
  nextHourTotal,
  timezone,
  variant = 'full',
  className = '',
}: NextHourRainProps) {
  const { t, language } = useLanguage();
  const { darkMode } = useTheme();

  if (nextFourSlots.length === 0) return null;

  const formatTime = (timestamp: number) => {
    let formattedTime: string;
    try {
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC',
        hour12: false,
      }).format(new Date(timestamp * 1000));
    } catch {
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date(timestamp * 1000));
    }
    return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
  };

  const getSlotData = (slot: MinutelyCastSlot) => {
    const amount = slot.precipitation ?? slot.rain ?? 0;
    const isRainingSlot = amount > 0;
    return {
      amount,
      isRainingSlot,
      intensityPct: isRainingSlot
        ? Math.min(100, Math.max(20, Math.round((amount / 2.0) * 100)))
        : 0,
      slotStart: formatTime(slot.dt),
      slotRange: t('rain_slot_time_range', {
        start: formatTime(slot.dt),
        end: formatTime(slot.dt + 900),
      }),
    };
  };

  if (variant === 'compact') {
    return (
      <div
        data-testid="next-hour-precipitation-compact"
        className={`hidden md:flex items-center justify-between gap-3 border-t border-gray-200/80 dark:border-gray-700/80 px-3.5 sm:px-4 py-2 ${className}`}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
          <CloudRain className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>{t('rain_next_hour_title')}</span>
          <span className="opacity-60" aria-hidden="true">·</span>
          <span className="font-semibold" title={t('rain_next_hour_total_hint')}>
            {nextHourTotal.toFixed(1)} {t('rain_unit')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {nextFourSlots.map((slot) => {
            const { amount, isRainingSlot, intensityPct, slotStart, slotRange } = getSlotData(slot);
            return (
              <div
                key={slot.dt}
                data-testid="next-hour-rain-slot-compact"
                title={`${slotRange} · ${amount.toFixed(1)} ${t('rain_unit')}`}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] whitespace-nowrap ${
                  isRainingSlot
                    ? darkMode
                      ? 'bg-blue-950/40 border-blue-800/70 text-blue-200'
                      : 'bg-blue-100/70 border-blue-200 text-blue-900'
                    : darkMode
                      ? 'bg-gray-900/50 border-gray-700/70 text-gray-400'
                      : 'bg-white/70 border-gray-200/70 text-gray-500'
                }`}
              >
                <span className="font-medium tabular-nums">{slotStart}</span>
                <div className="w-9 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  {isRainingSlot && (
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                      style={{ width: `${intensityPct}%` }}
                    />
                  )}
                </div>
                <span className="font-semibold tabular-nums">
                  {amount.toFixed(1)} {t('rain_unit')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="next-hour-precipitation"
      className={`mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700/80 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
        <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
        <span>{t('rain_next_hour_title')}</span>
        <span className="opacity-60" aria-hidden="true">·</span>
        <span
          className="font-semibold"
          data-testid="next-hour-rain-total"
          title={t('rain_next_hour_total_hint')}
        >
          {nextHourTotal.toFixed(1)} {t('rain_unit')}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {nextFourSlots.map((slot) => {
          const { amount, isRainingSlot, intensityPct, slotStart, slotRange } = getSlotData(slot);
          return (
            <div
              key={slot.dt}
              data-testid="next-hour-rain-slot"
              title={`${slotRange} · ${amount.toFixed(1)} ${t('rain_unit')}`}
              className={`flex flex-col items-center rounded-lg px-2 py-1.5 border text-xs transition-colors ${
                isRainingSlot
                  ? darkMode
                    ? 'bg-blue-950/40 border-blue-800/70 text-blue-200'
                    : 'bg-blue-100/70 border-blue-200 text-blue-900'
                  : darkMode
                    ? 'bg-gray-900/50 border-gray-700/70 text-gray-400'
                    : 'bg-white/70 border-gray-200/70 text-gray-500'
              }`}
            >
              <span className="font-medium">{slotStart}</span>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden my-1">
                {isRainingSlot && (
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                    style={{ width: `${intensityPct}%` }}
                  />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-semibold">
                {amount.toFixed(1)} {t('rain_unit')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
