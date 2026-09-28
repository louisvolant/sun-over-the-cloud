// src/lib/passwordUtils.ts
//
// Password hashing with PBKDF2-HMAC-SHA256 through the Web Crypto API.
//
// The previous implementation used the WASM-based `hash-wasm` Argon2id, but
// Cloudflare workerd refuses to compile WebAssembly at runtime
// ("Wasm code generation disallowed by embedder"), so every registration failed
// with a 500. PBKDF2 is implemented natively by `crypto.subtle`, needs no WASM,
// and works identically on Workers and in Node.
//
// Stored format: `pbkdf2$sha256$<iterations>$<salt-b64>$<hash-b64>`.
// workerd caps PBKDF2 at 100,000 iterations, so that is the highest we can use.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  try {
    const [scheme, algorithm, iterationsStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2' || algorithm !== 'sha256' || !iterationsStr || !saltB64 || !hashB64) {
      return false;
    }

    const iterations = Number(iterationsStr);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;

    const expected = fromBase64(hashB64);
    const actual = await derive(password, fromBase64(saltB64), iterations);

    // Constant-time comparison.
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
};
