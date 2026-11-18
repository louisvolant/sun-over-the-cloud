import { test, expect } from '@playwright/test';
import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from '@/lib/passwordPolicy';

test.describe('Shared password policy', () => {
  test('enforces a 15-character minimum like registration', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(15);
    expect(validatePasswordStrength('Short1!')).toBe('Password must be at least 15 characters');
  });

  test('accepts passwords that clear the registration bar', () => {
    expect(validatePasswordStrength('ValidPassword12345')).toBeNull();
    expect(validatePasswordStrength('A'.repeat(15))).toBeNull();
  });

  test('rejects missing or non-string values without throwing', () => {
    expect(validatePasswordStrength(undefined)).toBe('Password is required');
    expect(validatePasswordStrength(null)).toBe('Password is required');
    expect(validatePasswordStrength('')).toBe('Password is required');
    expect(validatePasswordStrength(123456789012345)).toBe('Password is required');
  });
});
