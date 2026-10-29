import { test, expect } from '@playwright/test';
import {
  isDisallowedEmailDomain,
  isEmailDomainPolicyBypassed,
  normalizeEmailDomain,
} from '@/lib/emailPolicy';

test.describe('registration email domain policy', () => {
  test('normalizes the domain part', () => {
    expect(normalizeEmailDomain('  User@Example.COM ')).toBe('example.com');
    expect(normalizeEmailDomain('not-an-email')).toBe('');
  });

  test('rejects reserved, test-artifact and disposable domains', () => {
    const rejected = [
      'user@example.com',
      'user@sub.example.com',
      'user@foo.example',
      'user@foo.test',
      'user@foo.invalid',
      'user@example-hunt-2602.com',
      'user@teleworm.us',
      'user@dayrep.com',
      'user@mailinator.com',
      'user@guerrillamail.com',
      'user@10minutemail.com',
      'user@temp-mail.org',
      'user@tempmail.com',
      'user@yopmail.com',
      'user@trashmail.com',
      'user@sharklasers.com',
      'user@getnada.com',
      'user@dispostable.com',
      'user@maildrop.cc',
      'user@fakeinbox.com',
      'user@throwawaymail.com',
      'user@localhost',
      'pas-un-email',
    ];
    for (const email of rejected) {
      expect(isDisallowedEmailDomain(email), email).toBe(true);
    }
  });

  test('accepts real and site domains, case-insensitively', () => {
    const accepted = [
      'user@gmail.com',
      'user@googlemail.com',
      'user@outlook.fr',
      'a+film@protonmail.com',
      'user@sunoverthe.cloud',
      'USER@GMAIL.COM',
    ];
    for (const email of accepted) {
      expect(isDisallowedEmailDomain(email), email).toBe(false);
    }
  });

  test('keeps the email policy active in production mode', () => {
    const env = process.env as Record<string, string | undefined>;
    const originalE2E = env.E2E;
    const originalNodeEnv = env.NODE_ENV;
    try {
      delete env.E2E;
      env.NODE_ENV = 'production';

      expect(isEmailDomainPolicyBypassed()).toBe(false);
      expect(isDisallowedEmailDomain('user@example.com')).toBe(true);
      expect(isDisallowedEmailDomain('user@teleworm.us')).toBe(true);
      expect(isDisallowedEmailDomain('user@gmail.com')).toBe(false);
      expect(isDisallowedEmailDomain('user@sunoverthe.cloud')).toBe(false);
    } finally {
      if (originalE2E === undefined) delete env.E2E;
      else env.E2E = originalE2E;
      if (originalNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = originalNodeEnv;
    }
  });

  test('bypasses the policy only in test modes', () => {
    const env = process.env as Record<string, string | undefined>;
    const originalE2E = env.E2E;
    const originalNodeEnv = env.NODE_ENV;
    try {
      delete env.E2E;
      env.NODE_ENV = 'production';
      expect(isEmailDomainPolicyBypassed()).toBe(false);

      env.E2E = '1';
      expect(isEmailDomainPolicyBypassed()).toBe(true);

      delete env.E2E;
      env.NODE_ENV = 'test';
      expect(isEmailDomainPolicyBypassed()).toBe(true);
    } finally {
      if (originalE2E === undefined) delete env.E2E;
      else env.E2E = originalE2E;
      if (originalNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = originalNodeEnv;
    }
  });
});
