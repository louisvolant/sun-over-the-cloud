// src/lib/logger.ts

declare global {
  interface Window {
    DEBUG?: boolean | string | number;
    TRUE?: boolean;
    FALSE?: boolean;
  }
}

// Expose TRUE and FALSE globals on window so developers can type `DEBUG=TRUE`
// or `DEBUG=FALSE` directly in the browser DevTools console without quotes.
if (typeof window !== 'undefined') {
  if (typeof window.TRUE === 'undefined') {
    window.TRUE = true;
  }
  if (typeof window.FALSE === 'undefined') {
    window.FALSE = false;
  }
}

function isTruthyDebugFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized === 'TRUE' || normalized === '1';
  }
  return false;
}

/**
 * Returns true only when debug logging has been explicitly enabled in the browser
 * (e.g. by running `DEBUG=TRUE` or `localStorage.setItem('DEBUG', 'TRUE')` in the console).
 */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return isTruthyDebugFlag(process.env.DEBUG);
  }
  if (isTruthyDebugFlag(window.DEBUG)) {
    return true;
  }
  try {
    return isTruthyDebugFlag(window.localStorage?.getItem('DEBUG'));
  } catch {
    return false;
  }
}

/**
 * Conditional debug logger that stays silent by default and outputs to the console
 * only when `DEBUG=TRUE` is enabled.
 */
export function debugLog(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  console.debug(...args);
}
