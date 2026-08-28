import { describe, expect, it } from 'vitest';
import { createIndexPdf, createZip, escapeCsv, receiptCsv, safeFileName } from '../src/export';
import type { VaultReceipt } from '../src/types';

const sample: VaultReceipt = {
  id: 'one', date: '2026-08-28', merchant: 'Rail, Ltd', amountCents: 1250, currency: 'USD',
  category: 'Travel', note: 'Client site train fare', fileName: 'ticket.png', fileType: 'image/png',
  fileSize: 3, hash: 'a'.repeat(64), createdAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z',
  image: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
};

describe('packet export', () => {
  it('quotes CSV values and preserves the fingerprint', () => {
    expect(escapeCsv('Rail, Ltd')).toBe('"Rail, Ltd"');
    expect(receiptCsv([sample])).toContain('a'.repeat(64));
  });

  it('sanitises unsafe original names', () => {
    expect(safeFileName('../../tax receipt?.png')).toBe('..-..-tax-receipt-.png');
  });

  it('builds a PDF and a standards-shaped ZIP', async () => {
    const pdf = createIndexPdf([sample], { from: '2026-01-01', to: '2026-12-31', title: 'Evidence', preparedBy: '' });
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toBe('%PDF-1.4');
    const zip = await createZip([{ name: 'index.pdf', data: pdf }, { name: 'receipt.png', data: sample.image }]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...bytes.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});
