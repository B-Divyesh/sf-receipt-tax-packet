import { describe, expect, it } from 'vitest';
import { decryptText, deriveKey, encryptText, randomSalt, sha256 } from '../src/crypto';

describe('vault cryptography', () => {
  it('round-trips encrypted text and rejects a different key', async () => {
    const salt = randomSalt();
    const key = await deriveKey('correct horse battery staple', salt, 1_000);
    const wrong = await deriveKey('this is the wrong passphrase', salt, 1_000);
    const payload = await encryptText(key, 'original receipt');
    await expect(decryptText(key, payload)).resolves.toBe('original receipt');
    await expect(decryptText(wrong, payload)).rejects.toThrow();
  });

  it('produces a stable SHA-256 fingerprint', async () => {
    await expect(sha256(new TextEncoder().encode('abc').buffer)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
