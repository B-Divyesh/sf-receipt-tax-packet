import type { CipherPayload } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const bytesToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): ArrayBuffer => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
};

export async function deriveKey(passphrase: string, salt: ArrayBuffer, iterations = 250_000): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<CipherPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: iv.buffer, cipher };
}

export async function decryptBytes(key: CryptoKey, payload: CipherPayload): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.iv }, key, payload.cipher);
}

export const encryptText = (key: CryptoKey, value: string): Promise<CipherPayload> =>
  encryptBytes(key, encoder.encode(value).buffer);

export async function decryptText(key: CryptoKey, payload: CipherPayload): Promise<string> {
  return decoder.decode(await decryptBytes(key, payload));
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const randomSalt = (): ArrayBuffer => crypto.getRandomValues(new Uint8Array(16)).buffer;
