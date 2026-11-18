// src/lib/cronAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Bearer-token gate for the cron scheduler endpoint.
 *
 * The origin check alone cannot protect this route: schedulers (curl, cron
 * runners, external monitors) never send an Origin header, so any visitor
 * could trigger mass upstream weather fetches at will. The endpoint now
 * requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time.
 *
 * Fail-closed in production when CRON_SECRET is not configured (the scheduler
 * must be fixed before it runs again); dev and test environments stay open so
 * local runs and the unit tests keep working.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 503 });
    }
    return null;
  }

  const header = request.headers.get('authorization') || '';
  const received = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  // Length is compared first: timingSafeEqual throws on mismatched lengths,
  // and the length itself is not secret material.
  if (
    received.length !== secret.length ||
    !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(secret))
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return null;
}
