// src/lib/emailPolicy.ts

// Domains reserved by RFC 2606 (plus their subdomains).
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];
// Reserved / non-routable TLDs.
const RESERVED_TLDS = new Set(['example', 'test', 'invalid', 'localhost']);
// Common disposable / temporary mailbox providers.
const DISPOSABLE_DOMAINS = new Set([
  'teleworm.us',
  'dayrep.com',
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'throwawaymail.com',
]);

/**
 * Returns the normalized domain part of an email address (trim + lowercase,
 * everything after the last `@`), or an empty string when there is none.
 */
export function normalizeEmailDomain(email: string): string {
  if (typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return '';
  return trimmed.slice(atIndex + 1).trim();
}

/**
 * Dev comment:
 * Pure anti-spam policy for registration email domains.
 *
 * Rejects addresses that can never receive real mail (RFC 2606 reserved names,
 * `.example` / `.test` / `.invalid` / `.localhost` TLDs), obvious test artifacts
 * (`example-*.com`) and a list of disposable mailbox providers. Existing
 * accounts are unaffected: the policy is only applied on registration, never on
 * login.
 */
export function isDisallowedEmailDomain(email: string): boolean {
  const domain = normalizeEmailDomain(email);

  // No domain, or no dot (e.g. "localhost", "pas-un-email").
  if (!domain || !domain.includes('.')) return true;

  if (domain.startsWith('example-')) return true;

  if (RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`))) {
    return true;
  }

  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (RESERVED_TLDS.has(tld)) return true;

  for (const disposable of DISPOSABLE_DOMAINS) {
    if (domain === disposable || domain.endsWith(`.${disposable}`)) return true;
  }

  return false;
}

/**
 * Test-only bypass. `E2E=1` and `NODE_ENV=test` are never set by a real
 * production deployment; the production build used by the Playwright server may
 * set `E2E=1` explicitly, but that remains a deliberate test-only flag.
 */
export function isEmailDomainPolicyBypassed(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  const isE2E = process.env.E2E === '1';

  if (isProduction) {
    // A production deployment must not bypass unless the explicit e2e flag was
    // deliberately injected by the test runner.
    return isE2E;
  }

  return isE2E || process.env.NODE_ENV === 'test';
}
