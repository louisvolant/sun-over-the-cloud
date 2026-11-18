// src/lib/resetToken.ts
import crypto from 'crypto';

/**
 * Generates the secret emailed to the user. 256 random bits: infeasible to
 * guess even with unlimited unauthenticated attempts against the verify
 * endpoint.
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hex digest of a reset token. Hashing is not about brute force
 * (the token is 256 random bits) — it guarantees that a copy of the database
 * alone can never redeem a reset link, because only the emailed raw token
 * hashes to the stored value.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
