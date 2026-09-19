// src/lib/session.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';
import connectToDatabase from './mongoose';

const COOKIE_NAME = 'session';
export const SESSION_DURATION_DAYS = 30;
export const SESSION_DURATION_SEC = SESSION_DURATION_DAYS * 24 * 60 * 60; // 30 days = 2,592,000s
export const SESSION_DURATION_MS = SESSION_DURATION_SEC * 1000;
export const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // Auto-refresh if active and > 1 day elapsed

export interface SessionUser {
  id: string;
  username: string;
}

export interface SessionPayload {
  user: SessionUser;
  exp: number;
}

/**
 * Retrieve secret key dynamically from environment.
 * Evaluated on each invocation to ensure runtime secrets (e.g. Cloudflare Workers bindings)
 * are always current.
 */
export function getSessionSecret(): string {
  return process.env.SESSION_COOKIE_KEY || 'default_secret_key_change_me';
}

/**
 * Sign a payload string with HMAC-SHA256.
 */
export function signPayload(payloadStr: string): string {
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  const signature = hmac.update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and extract payload from signed token.
 */
export function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payloadStr).digest('base64url');
  if (signature.length !== expectedSig.length) return null;

  try {
    const isMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!isMatch) return null;

    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr) as SessionPayload;
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Retrieve the current authenticated user from request cookies.
 * If the session is valid and older than REFRESH_THRESHOLD_MS (1 day),
 * it automatically refreshes the session cookie for another 30 days (rolling session).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    // Decode URL-encoded cookie if necessary
    const decodedValue = decodeURIComponent(sessionCookie);

    // 1. Try verifying our signed token
    const tokenData = verifyToken(decodedValue);
    if (tokenData && tokenData.user) {
      // Rolling session: extend cookie if more than REFRESH_THRESHOLD_MS has elapsed
      if (tokenData.exp && tokenData.exp - Date.now() < SESSION_DURATION_MS - REFRESH_THRESHOLD_MS) {
        try {
          await setSessionUser(tokenData.user);
        } catch {
          // Ignore cookie write failure in read-only contexts
        }
      }
      return tokenData.user;
    }

    // 2. Fallback: check legacy connect-mongo express session cookie (s:<sessionId>.<sig>)
    if (decodedValue.startsWith('s:')) {
      const dotIndex = decodedValue.indexOf('.');
      const sessionId = decodedValue.substring(2, dotIndex !== -1 ? dotIndex : undefined);
      if (sessionId) {
        const mongoose = await connectToDatabase();
        const sessionDoc = await mongoose.connection.collection('sessions').findOne({ _id: sessionId as any });
        if (sessionDoc && sessionDoc.session) {
          const parsed = JSON.parse(sessionDoc.session as string);
          if (parsed.user && parsed.user.id) {
            const legacyUser: SessionUser = {
              id: parsed.user.id.toString(),
              username: parsed.user.username || '',
            };
            // Upgrade legacy session to signed token with 30 days
            try {
              await setSessionUser(legacyUser);
            } catch {}
            return legacyUser;
          }
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Error in getSessionUser:', err);
    return null;
  }
}

/**
 * Set or refresh the session cookie for a logged-in user with a 30-day lifetime.
 */
export async function setSessionUser(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    user: {
      id: user.id.toString(),
      username: user.username,
    },
    exp: Date.now() + SESSION_DURATION_MS,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signedToken = signPayload(payloadStr);

  cookieStore.set(COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SEC,
  });
}

/**
 * Clear the session cookie on logout.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
