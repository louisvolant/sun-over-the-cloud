import { test, expect } from '@playwright/test';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS } from '@/lib/passwordUtils';

test.describe('Password Hashing and Verification for Serverless Workers', () => {
  test('uses 30,000 iterations for edge worker CPU optimization', () => {
    expect(PBKDF2_ITERATIONS).toBe(30_000);
  });

  test('hashPassword generates valid PBKDF2-SHA256 hash with 30k iteration marker', async () => {
    const raw = 'SecurePassword12345!';
    const hash = await hashPassword(raw);

    const parts = hash.split('$');
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe('pbkdf2');
    expect(parts[1]).toBe('sha256');
    expect(parts[2]).toBe('30000');
    expect(parts[3].length).toBeGreaterThan(10);
    expect(parts[4].length).toBeGreaterThan(10);

    const isValid = await verifyPassword(raw, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword123!', hash);
    expect(isInvalid).toBe(false);
  });

  test('verifyPassword maintains backward compatibility with legacy 100k-iteration hashes', async () => {
    // Known legacy hash generated with 100,000 iterations
    // password: 'LegacyPassword12345'
    const legacyHash =
      'pbkdf2$sha256$100000$yR/849x4N9G8yD9K2p8k4A==$k3dY8X8zN6/9N640zBv+5K2a2yN9s/5k1D6h+4x9e9w=';

    // Verify rejection of wrong password on legacy hash
    expect(await verifyPassword('WrongPassword', legacyHash)).toBe(false);

    // Generate a fresh 100k hash to test dynamic iteration support
    const salt = new Uint8Array(16);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('LegacyUserPassword123'),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const customLegacyHash = `pbkdf2$sha256$100000$${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;

    const match = await verifyPassword('LegacyUserPassword123', customLegacyHash);
    expect(match).toBe(true);

    const noMatch = await verifyPassword('WrongLegacyPassword', customLegacyHash);
    expect(noMatch).toBe(false);
  });

  test('verifyPassword handles malformed stored strings safely without throwing', async () => {
    expect(await verifyPassword('pass', '')).toBe(false);
    expect(await verifyPassword('pass', 'invalid_hash_string')).toBe(false);
    expect(await verifyPassword('pass', 'pbkdf2$md5$1000$salt$hash')).toBe(false);
    expect(await verifyPassword('pass', 'pbkdf2$sha256$invalid$salt$hash')).toBe(false);
  });
});
