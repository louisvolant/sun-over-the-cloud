// src/app/components/PwaZoomController.tsx
'use client';

import { useEffect } from 'react';
import { isPwaMode } from '@/lib/pwa';

/**
 * Client-side controller that completely prevents zooming and unzooming actions
 * (trackpad pinch, Ctrl/Cmd + wheel, keyboard zoom shortcuts, multi-touch gestures,
 * and double-tap zoom) strictly when the application is running in PWA mode.
 */
export default function PwaZoomController() {
  useEffect(() => {
    let cleanups: (() => void)[] = [];

    const configureZoomPrevention = () => {
      // Clean up previous event handlers before re-evaluating
      cleanups.forEach((cleanup) => cleanup());
      cleanups = [];

      const inPwa = isPwaMode();
      if (!inPwa) {
        document.documentElement.classList.remove('pwa-mode');
        return;
      }

      // Mark the document with pwa-mode for CSS touch-action and sizing enforcement
      document.documentElement.classList.add('pwa-mode');

      // 1. Prevent trackpad pinch-to-zoom and Ctrl/Cmd + Mouse Wheel zoom
      const handleWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
        }
      };
      window.addEventListener('wheel', handleWheel, { passive: false });
      cleanups.push(() => window.removeEventListener('wheel', handleWheel));

      // 2. Prevent keyboard zoom shortcuts (Ctrl/Cmd with +, -, 0, =, _, and numpad equivalents)
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
          const isZoomKey =
            event.key === '+' ||
            event.key === '=' ||
            event.key === '-' ||
            event.key === '_' ||
            event.key === '0' ||
            event.code === 'Equal' ||
            event.code === 'Minus' ||
            event.code === 'Digit0' ||
            event.code === 'NumpadAdd' ||
            event.code === 'NumpadSubtract' ||
            event.code === 'Numpad0';

          if (isZoomKey) {
            event.preventDefault();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      cleanups.push(() =>
        window.removeEventListener('keydown', handleKeyDown, { capture: true })
      );

      // 3. Prevent multi-finger pinch-to-zoom on touchscreens
      const handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          event.preventDefault();
        }
      };
      const handleTouchMove = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          event.preventDefault();
        }
      };
      document.addEventListener('touchstart', handleTouchStart, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      cleanups.push(() =>
        document.removeEventListener('touchstart', handleTouchStart)
      );
      cleanups.push(() =>
        document.removeEventListener('touchmove', handleTouchMove)
      );

      // 4. Prevent WebKit iOS Safari native gesture events (pinch and rotation)
      const handleGesture = (event: Event) => {
        event.preventDefault();
      };
      document.addEventListener('gesturestart', handleGesture, { passive: false });
      document.addEventListener('gesturechange', handleGesture, { passive: false });
      document.addEventListener('gestureend', handleGesture, { passive: false });
      cleanups.push(() =>
        document.removeEventListener('gesturestart', handleGesture)
      );
      cleanups.push(() =>
        document.removeEventListener('gesturechange', handleGesture)
      );
      cleanups.push(() =>
        document.removeEventListener('gestureend', handleGesture)
      );

      // 5. Prevent double-tap zoom on mobile while preserving clicks on interactive elements
      let lastTouchEnd = 0;
      const handleTouchEnd = (event: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          const target = event.target;
          const element =
            target instanceof Element
              ? target
              : (target as Node | null)?.parentElement;
          const isInteractive = Boolean(
            element?.closest?.(
              'button, a, input, select, textarea, [role="button"], [tabindex]'
            )
          );
          if (!isInteractive) {
            event.preventDefault();
          }
        }
        lastTouchEnd = now;
      };
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      cleanups.push(() =>
        document.removeEventListener('touchend', handleTouchEnd)
      );
    };

    configureZoomPrevention();

    // Re-evaluate whenever the browser display mode transitions
    const mediaQueries = [
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(display-mode: fullscreen)'),
      window.matchMedia('(display-mode: minimal-ui)'),
    ];

    mediaQueries.forEach((mq) => {
      mq.addEventListener?.('change', configureZoomPrevention);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      mediaQueries.forEach((mq) => {
        mq.removeEventListener?.('change', configureZoomPrevention);
      });
    };
  }, []);

  return null;
}
