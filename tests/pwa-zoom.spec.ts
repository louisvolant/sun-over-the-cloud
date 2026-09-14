import { test, expect } from '@playwright/test';

test.describe('PWA Zoom and Unzoom Prevention', () => {
  test('PWA mode activates pwa-mode class on document root', async ({ page }) => {
    await page.goto('/?source=pwa');
    const html = page.locator('html');
    await expect(html).toHaveClass(/pwa-mode/);
  });

  test('PWA mode prevents trackpad pinch-to-zoom and Ctrl+Wheel zoom', async ({ page }) => {
    await page.goto('/?source=pwa');

    const result = await page.evaluate(() => {
      const wheelEvent = new WheelEvent('wheel', {
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(wheelEvent);
      return { defaultPrevented: wheelEvent.defaultPrevented };
    });

    expect(result.defaultPrevented).toBe(true);
  });

  test('PWA mode prevents keyboard zoom shortcuts (Ctrl/Cmd +, -, 0)', async ({ page }) => {
    await page.goto('/?source=pwa');

    const results = await page.evaluate(() => {
      const zoomInEvent = new KeyboardEvent('keydown', {
        key: '+',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(zoomInEvent);

      const zoomOutEvent = new KeyboardEvent('keydown', {
        key: '-',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(zoomOutEvent);

      const resetZoomEvent = new KeyboardEvent('keydown', {
        key: '0',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(resetZoomEvent);

      const equalEvent = new KeyboardEvent('keydown', {
        key: '=',
        metaKey: true,
        code: 'Equal',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(equalEvent);

      return {
        zoomInPrevented: zoomInEvent.defaultPrevented,
        zoomOutPrevented: zoomOutEvent.defaultPrevented,
        resetZoomPrevented: resetZoomEvent.defaultPrevented,
        equalPrevented: equalEvent.defaultPrevented,
      };
    });

    expect(results.zoomInPrevented).toBe(true);
    expect(results.zoomOutPrevented).toBe(true);
    expect(results.resetZoomPrevented).toBe(true);
    expect(results.equalPrevented).toBe(true);
  });

  test('PWA mode prevents multi-touch pinch gestures', async ({ page }) => {
    await page.goto('/?source=pwa');

    const results = await page.evaluate(() => {
      // Mock Touch objects for multi-touch testing
      const touch1 = new Touch({
        identifier: 1,
        target: document.body,
        clientX: 100,
        clientY: 100,
      });
      const touch2 = new Touch({
        identifier: 2,
        target: document.body,
        clientX: 200,
        clientY: 200,
      });

      const multiTouchStart = new TouchEvent('touchstart', {
        touches: [touch1, touch2],
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(multiTouchStart);

      const multiTouchMove = new TouchEvent('touchmove', {
        touches: [touch1, touch2],
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(multiTouchMove);

      const singleTouch = new TouchEvent('touchstart', {
        touches: [touch1],
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(singleTouch);

      return {
        startPrevented: multiTouchStart.defaultPrevented,
        movePrevented: multiTouchMove.defaultPrevented,
        singleTouchPrevented: singleTouch.defaultPrevented,
      };
    });

    expect(results.startPrevented).toBe(true);
    expect(results.movePrevented).toBe(true);
    expect(results.singleTouchPrevented).toBe(false);
  });

  test('PWA mode prevents WebKit gesturestart, gesturechange, and gestureend', async ({ page }) => {
    await page.goto('/?source=pwa');

    const results = await page.evaluate(() => {
      const gStart = new Event('gesturestart', { bubbles: true, cancelable: true });
      document.dispatchEvent(gStart);

      const gChange = new Event('gesturechange', { bubbles: true, cancelable: true });
      document.dispatchEvent(gChange);

      const gEnd = new Event('gestureend', { bubbles: true, cancelable: true });
      document.dispatchEvent(gEnd);

      return {
        startPrevented: gStart.defaultPrevented,
        changePrevented: gChange.defaultPrevented,
        endPrevented: gEnd.defaultPrevented,
      };
    });

    expect(results.startPrevented).toBe(true);
    expect(results.changePrevented).toBe(true);
    expect(results.endPrevented).toBe(true);
  });

  test('PWA mode prevents double-tap zoom on non-interactive body', async ({ page }) => {
    await page.goto('/?source=pwa');

    const results = await page.evaluate(async () => {
      const touch1 = new Touch({
        identifier: 1,
        target: document.body,
        clientX: 50,
        clientY: 50,
      });

      const firstTap = new TouchEvent('touchend', {
        touches: [],
        changedTouches: [touch1],
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(firstTap);

      // Rapid second tap within 100ms
      const secondTap = new TouchEvent('touchend', {
        touches: [],
        changedTouches: [touch1],
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(secondTap);

      return {
        firstPrevented: firstTap.defaultPrevented,
        secondPrevented: secondTap.defaultPrevented,
      };
    });

    expect(results.firstPrevented).toBe(false);
    expect(results.secondPrevented).toBe(true);
  });

  test('Regular browser mode preserves zoom shortcuts and mouse wheel for accessibility', async ({ page }) => {
    // Navigate without PWA flags
    await page.goto('/');

    const results = await page.evaluate(() => {
      const wheelEvent = new WheelEvent('wheel', {
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(wheelEvent);

      const zoomInEvent = new KeyboardEvent('keydown', {
        key: '+',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(zoomInEvent);

      return {
        isPwaModeActive: document.documentElement.classList.contains('pwa-mode'),
        wheelPrevented: wheelEvent.defaultPrevented,
        zoomInPrevented: zoomInEvent.defaultPrevented,
      };
    });

    expect(results.isPwaModeActive).toBe(false);
    expect(results.wheelPrevented).toBe(false);
    expect(results.zoomInPrevented).toBe(false);
  });

  test('PWA mode touch-action is configured for pan-x pan-y', async ({ page }) => {
    await page.goto('/?source=pwa');

    const touchAction = await page.evaluate(() => {
      return window.getComputedStyle(document.body).touchAction;
    });

    expect(touchAction).toContain('pan');
  });
});
