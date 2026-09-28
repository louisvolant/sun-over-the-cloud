// src/lib/cloudflare.ts
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Minimal D1 typings. We declare only the surface this app uses so we do not
 * depend on `@cloudflare/workers-types` (they are not installed). The runtime
 * binding implements the full API.
 */
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; [key: string]: unknown };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

/** Minimal KV typings (the subset used for the caches). */
export interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AppEnv {
  DB: D1Database;
  CACHE: KVNamespace;
}

/**
 * Returns the Cloudflare bindings for the current request.
 *
 * Bindings exist only when the app runs on Workers (production or the OpenNext
 * dev/preview proxy). Under a plain `next start` they are absent, so callers get
 * a clear error and can degrade gracefully instead of throwing an opaque one.
 */
export function getEnv(): AppEnv {
  let context;
  try {
    context = getCloudflareContext();
  } catch (err) {
    throw new Error(
      `Cloudflare bindings unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const env = context.env as unknown as Partial<AppEnv>;
  if (!env.DB || !env.CACHE) {
    throw new Error('Cloudflare D1/KV bindings are not configured (missing DB or CACHE binding)');
  }

  return env as AppEnv;
}
