// src/lib/passwordPolicy.ts
//
// Shared password strength policy for every flow that sets a password:
// registration, the authenticated password change and password-reset
// redemption. Centralizing the rule keeps the three endpoints consistent —
// they previously enforced 15, 6 and 0 characters respectively, so the
// change and reset flows could be used to weaken an account below the
// registration bar.

export const MIN_PASSWORD_LENGTH = 15;

/**
 * Returns a human-readable error message, or null when the password
 * satisfies the policy. The message is generic on purpose: it never
 * reflects whether an account exists.
 */
export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || !password) {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}
