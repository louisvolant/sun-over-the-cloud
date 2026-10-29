// src/lib/origin.ts
import { NextRequest, NextResponse } from 'next/server';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function invalidOrigin() {
  return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

/** Parses a Host / X-Forwarded-Host value into a hostname. */
function hostnameFromHostHeader(value: string): string | null {
  const first = value.split(',')[0]?.trim();
  if (!first) return null;
  try {
    // A dummy scheme lets the WHATWG URL parser handle ports and IPv6 brackets.
    return normalizeHostname(new URL(`http://${first}`).hostname);
  } catch {
    return null;
  }
}

function hostnameFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    try {
      // Allow env vars configured without a scheme (e.g. "example.com").
      return normalizeHostname(new URL(`https://${trimmed}`).hostname);
    } catch {
      return null;
    }
  }
}

function configuredSiteHostnames(): string[] {
  const values = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.FRONTEND_URL,
  ];
  const hostnames: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const hostname = hostnameFromUrl(value);
    if (hostname) hostnames.push(hostname);
  }
  return hostnames;
}

function requestHostnames(request: NextRequest): string[] {
  const hostnames: string[] = [];

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    // Only the first hop is meaningful for the public origin.
    const hostname = hostnameFromHostHeader(forwardedHost);
    if (hostname) hostnames.push(hostname);
  }

  const host = request.headers.get('host');
  if (host) {
    const hostname = hostnameFromHostHeader(host);
    if (hostname) hostnames.push(hostname);
  }

  try {
    const nextHost = normalizeHostname(request.nextUrl.hostname);
    if (nextHost) hostnames.push(nextHost);
  } catch {
    // Ignore an unparsable nextUrl.
  }

  return hostnames;
}

function isLocalHostname(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) return true;
  return hostname.endsWith('.local');
}

function isSameHostOrWwwVariant(originHost: string, allowedHost: string): boolean {
  if (originHost === allowedHost) return true;
  if (allowedHost.startsWith('www.')) return originHost === allowedHost.slice(4);
  return originHost === `www.${allowedHost}`;
}

/**
 * Dev comment:
 * CSRF origin check for custom mutating routes.
 *
 * Returns `null` when the request is allowed, or a 403 JSON response
 * `{ error: "invalid_origin" }` otherwise.
 *
 * Requests without an Origin or Referer header are allowed: curl, server-to-
 * server calls, tests and same-origin navigations do not send one, and their
 * absence is not a CSRF signal. When a header is present, its hostname must
 * match the configured public site, the current request host (Host or the
 * first X-Forwarded-Host hop), the apex/www variant of either, or a local
 * development host.
 */
export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const raw = originHeader ?? refererHeader;

  // No browser-provided origin: not a cross-site browser request.
  if (raw === null) return null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return invalidOrigin();

  let originUrl: URL;
  try {
    originUrl = new URL(trimmed);
  } catch {
    return invalidOrigin();
  }

  const originHost = normalizeHostname(originUrl.hostname);
  if (!originHost) return invalidOrigin();

  if (isLocalHostname(originHost)) return null;

  const allowedHosts = new Set([
    ...requestHostnames(request),
    ...configuredSiteHostnames(),
  ]);

  for (const allowedHost of allowedHosts) {
    if (isSameHostOrWwwVariant(originHost, allowedHost)) return null;
  }

  return invalidOrigin();
}
