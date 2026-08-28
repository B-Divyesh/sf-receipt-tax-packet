export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'INR' | 'NZD' | 'JPY';

export interface ReceiptMeta {
  id: string;
  date: string;
  merchant: string;
  amountCents: number;
  currency: Currency;
  category: string;
  note: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultReceipt extends ReceiptMeta {
  image: Blob;
}

export interface CipherPayload {
  iv: ArrayBuffer;
  cipher: ArrayBuffer;
}

export interface StoredReceipt {
  id: string;
  updatedAt: string;
  meta: CipherPayload;
  original: CipherPayload;
}

export interface VaultConfig {
  id: 'vault';
  salt: ArrayBuffer;
  check: CipherPayload;
  iterations: number;
  createdAt: string;
}

export interface PacketOptions {
  from: string;
  to: string;
  title: string;
  preparedBy: string;
}
