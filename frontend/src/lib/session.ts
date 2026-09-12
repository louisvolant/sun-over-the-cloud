// src/lib/session.ts
import { cookies } from 'next/headers';
import crypto from 'crypto';
import connectToDatabase from './mongoose';

const COOKIE_NAME = 'session';
const SESSION_SECRET = process.env.SESSION_COOKIE_KEY || 'default_secret_key_change_me';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
}

export interface SessionPayload {
  user: SessionUser;
  exp: number;
}

/**
 * Sign a payload string with HMAC-SHA256.
 */
function signPayload(payloadStr: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  const signature = hmac.update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and extract payload from signed token.
 */
function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  if (signature.length !== expectedSig.length) return null;

  try {
    const isMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!isMatch) return null;

    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr) as SessionPayload;
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Retrieve the current authenticated user from request cookies.
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
            return {
              id: parsed.user.id.toString(),
              username: parsed.user.username || '',
            };
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
 * Set the session cookie for a logged-in user.
 */
export async function setSessionUser(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    user: {
      id: user.id.toString(),
      username: user.username,
    },
    exp: Date.now() + ONE_DAY_MS,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signedToken = signPayload(payloadStr);

  cookieStore.set(COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

/**
 * Clear the session cookie on logout.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
