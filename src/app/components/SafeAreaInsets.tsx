// src/app/components/SafeAreaInsets.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isPwaMode } from '@/lib/pwa';

const STORAGE_KEY = 'sotc_safe_area_insets_v1';

type InsetSide = 'top' | 'bottom';
type Orientation = 'portrait' | 'landscape';
type InsetPair = { top: number; bottom: number };
type StoredInsets = Partial<Record<Orientation, InsetPair>>;

function getOrientation(): Orientation {
  try {
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  } catch {
    return 'portrait';
  }
}

/**
 * Reads one resolved safe-area inset from the browser.
 *
 * `env(safe-area-inset-*)` can only be read through a styled element, so a
 * throwaway probe is appended to the document, measured, then removed.
 */
function measureInset(side: InsetSide): number {
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.top = '0';
  probe.style.left = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.paddingTop = `env(safe-area-inset-${side}, 0px)`;
  document.documentElement.appendChild(probe);
  const value = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return value;
}

function readStoredInsets(): StoredInsets {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as StoredInsets) : {};
  } catch {
    return {};
  }
}

function writeStoredInsets(value: StoredInsets) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

/**
 * Next.js client-side navigation (and some iOS WebKit versions) can make
 * `env(safe-area-inset-*)` resolve to 0 even in standalone PWA mode. Because
 * the layout reads those values from the `--safe-top` / `--safe-bottom` custom
 * properties, the header would slide under the Dynamic Island and the mobile
 * carousel height (which subtracts the insets) would change, leaving a larger
 * gap above the page dots.
 *
 * This controller measures the insets and pins them into those two custom
 * properties. When the browser reports 0 but a previous value is known for the
 * current orientation, the last known value is restored. Measured non-zero
 * values always win, so devices/OS versions where `env()` works normally are
 * unaffected. The viewport meta tag is also repaired if a navigation dropped
 * `viewport-fit=cover`.
 */
export default function SafeAreaInsets() {
  const pathname = usePathname();

  useEffect(() => {
    const applyInsets = () => {
      const root = document.documentElement;

      // Always make sure the viewport is allowed to extend under the notch:
      // without `viewport-fit=cover`, every env(safe-area-inset-*) is 0.
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta instanceof HTMLMetaElement) {
        const content = viewportMeta.getAttribute('content') || '';
        if (content && !content.includes('viewport-fit=cover')) {
          viewportMeta.setAttribute('content', `${content}, viewport-fit=cover`);
        }
      }

      if (!isPwaMode()) {
        // In a normal browser tab, let the native env() values drive the CSS.
        root.style.removeProperty('--safe-top');
        root.style.removeProperty('--safe-bottom');
        return;
      }

      const orientation = getOrientation();
      const measured = {
        top: measureInset('top'),
        bottom: measureInset('bottom'),
      };

      const stored = readStoredInsets();
      const previous = stored[orientation];
      const next = {
        top: measured.top > 0 ? measured.top : previous?.top ?? 0,
        bottom: measured.bottom > 0 ? measured.bottom : previous?.bottom ?? 0,
      };

      if (next.top !== previous?.top || next.bottom !== previous?.bottom) {
        writeStoredInsets({ ...stored, [orientation]: next });
      }

      root.style.setProperty('--safe-top', `${next.top}px`);
      root.style.setProperty('--safe-bottom', `${next.bottom}px`);
    };

    // Run immediately, then again after the navigation layout settles: the
    // first pass keeps the current values, the deferred one picks up the
    // values of the newly rendered page.
    applyInsets();
    const frame = window.requestAnimationFrame(applyInsets);
    const timer = window.setTimeout(applyInsets, 150);

    const handleResize = () => applyInsets();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') applyInsets();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('pageshow', applyInsets);
    window.addEventListener('focus', applyInsets);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('pageshow', applyInsets);
      window.removeEventListener('focus', applyInsets);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pathname]);

  return null;
}
