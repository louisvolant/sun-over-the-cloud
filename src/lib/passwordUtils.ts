// src/lib/passwordUtils.ts
import { argon2id, argon2Verify } from 'hash-wasm';

export const hashPasswordArgon2 = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
};
