import { base64ToBytes, bytesToBase64, decryptBytes, decryptText, deriveKey, encryptBytes, encryptText, randomSalt } from './crypto';
import type { ReceiptMeta, StoredReceipt, VaultConfig, VaultReceipt } from './types';

const DB_NAME = 'receipt-packet-v1';
const DB_VERSION = 1;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error('The local vault could not be opened.'));
  });
}

export async function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('receipts')) db.createObjectStore('receipts', { keyPath: 'id' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error('The local vault could not be opened.'));
  });
}

export async function getConfig(db: IDBDatabase): Promise<VaultConfig | undefined> {
  return request(db.transaction('config', 'readonly').objectStore('config').get('vault'));
}

export async function createVault(db: IDBDatabase, passphrase: string): Promise<CryptoKey> {
  const salt = randomSalt();
  const iterations = 250_000;
  const key = await deriveKey(passphrase, salt, iterations);
  const config: VaultConfig = {
    id: 'vault',
    salt,
    iterations,
    check: await encryptText(key, 'receipt-packet-v1'),
    createdAt: new Date().toISOString(),
  };
  await request(db.transaction('config', 'readwrite').objectStore('config').put(config));
  return key;
}

export async function unlockVault(config: VaultConfig, passphrase: string): Promise<CryptoKey> {
  const key = await deriveKey(passphrase, config.salt, config.iterations);
  if ((await decryptText(key, config.check)) !== 'receipt-packet-v1') throw new Error('Incorrect passphrase.');
  return key;
}

export async function saveReceipt(db: IDBDatabase, key: CryptoKey, receipt: VaultReceipt): Promise<void> {
  const { image, ...meta } = receipt;
  const stored: StoredReceipt = {
    id: receipt.id,
    updatedAt: receipt.updatedAt,
    meta: await encryptText(key, JSON.stringify(meta)),
    original: await encryptBytes(key, await image.arrayBuffer()),
  };
  await request(db.transaction('receipts', 'readwrite').objectStore('receipts').put(stored));
}

export async function listReceipts(db: IDBDatabase, key: CryptoKey): Promise<VaultReceipt[]> {
  const stored = await request<StoredReceipt[]>(db.transaction('receipts', 'readonly').objectStore('receipts').getAll());
  return Promise.all(stored.map(async (row) => {
    const meta = JSON.parse(await decryptText(key, row.meta)) as ReceiptMeta;
    const original = await decryptBytes(key, row.original);
    return { ...meta, image: new Blob([original], { type: meta.fileType }) };
  }));
}

export async function deleteReceipt(db: IDBDatabase, id: string): Promise<void> {
  await request(db.transaction('receipts', 'readwrite').objectStore('receipts').delete(id));
}

type EncodedPayload = { iv: string; cipher: string };
type Backup = {
  format: 'receipt-packet-backup-v1';
  exportedAt: string;
  config: Omit<VaultConfig, 'salt' | 'check'> & { salt: string; check: EncodedPayload };
  receipts: Array<Omit<StoredReceipt, 'meta' | 'original'> & { meta: EncodedPayload; original: EncodedPayload }>;
};

const encodePayload = (payload: { iv: ArrayBuffer; cipher: ArrayBuffer }): EncodedPayload => ({
  iv: bytesToBase64(payload.iv), cipher: bytesToBase64(payload.cipher),
});
const decodePayload = (payload: EncodedPayload) => ({ iv: base64ToBytes(payload.iv), cipher: base64ToBytes(payload.cipher) });

export async function exportBackup(db: IDBDatabase): Promise<string> {
  const config = await getConfig(db);
  if (!config) throw new Error('No vault is available to back up.');
  const receipts = await request<StoredReceipt[]>(db.transaction('receipts', 'readonly').objectStore('receipts').getAll());
  const backup: Backup = {
    format: 'receipt-packet-backup-v1',
    exportedAt: new Date().toISOString(),
    config: { ...config, salt: bytesToBase64(config.salt), check: encodePayload(config.check) },
    receipts: receipts.map((item) => ({ ...item, meta: encodePayload(item.meta), original: encodePayload(item.original) })),
  };
  return JSON.stringify(backup);
}

export async function importBackup(db: IDBDatabase, source: string): Promise<void> {
  const parsed = JSON.parse(source) as Partial<Backup>;
  if (parsed.format !== 'receipt-packet-backup-v1' || !parsed.config || !Array.isArray(parsed.receipts)) {
    throw new Error('This is not a Receipt Packet encrypted backup.');
  }
  const transaction = db.transaction(['config', 'receipts'], 'readwrite');
  const configStore = transaction.objectStore('config');
  const receiptStore = transaction.objectStore('receipts');
  configStore.clear();
  receiptStore.clear();
  const encodedConfig = parsed.config;
  configStore.put({ ...encodedConfig, salt: base64ToBytes(encodedConfig.salt), check: decodePayload(encodedConfig.check) });
  for (const item of parsed.receipts) receiptStore.put({ ...item, meta: decodePayload(item.meta), original: decodePayload(item.original) });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('The backup could not be restored.'));
  });
}
