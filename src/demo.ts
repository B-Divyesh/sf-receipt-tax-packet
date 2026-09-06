import { sha256 } from './crypto';
import type { VaultReceipt } from './types';

type SampleReceipt = Omit<VaultReceipt, 'hash' | 'image'> & { lines: Array<[string, string]> };

const samples: SampleReceipt[] = [
  {
    id: 'demo-civic-print-post', date: '2026-08-03', merchant: 'Civic Print & Post', amountCents: 18450,
    currency: 'USD', category: 'Supplies', note: 'Postage and printed client handouts for the August project delivery.',
    fileName: 'civic-print-post-receipt.svg', fileType: 'image/svg+xml', fileSize: 0,
    createdAt: '2026-08-03T09:20:00.000Z', updatedAt: '2026-08-03T09:20:00.000Z',
    lines: [['A4 handouts', '$96.00'], ['Tracked postage', '$88.50']],
  },
  {
    id: 'demo-harbor-rail', date: '2026-08-14', merchant: 'Harbor Rail', amountCents: 4280,
    currency: 'USD', category: 'Travel', note: 'Return train to an accountant meeting about the quarterly handoff.',
    fileName: 'harbor-rail-receipt.svg', fileType: 'image/svg+xml', fileSize: 0,
    createdAt: '2026-08-14T16:35:00.000Z', updatedAt: '2026-08-14T16:35:00.000Z',
    lines: [['Off-peak return', '$42.80']],
  },
  {
    id: 'demo-fieldwork-software', date: '2026-08-26', merchant: 'Fieldwork Software', amountCents: 2900,
    currency: 'USD', category: 'Software', note: 'Monthly image-editing subscription used for client work in August.',
    fileName: 'fieldwork-software-receipt.svg', fileType: 'image/svg+xml', fileSize: 0,
    createdAt: '2026-08-26T07:05:00.000Z', updatedAt: '2026-08-26T07:05:00.000Z',
    lines: [['August subscription', '$29.00']],
  },
];

const receiptSvg = (receipt: SampleReceipt): string => {
  const rows = receipt.lines.map(([label, amount], index) => `<text x="34" y="${174 + index * 28}" class="copy">${label}</text><text x="286" y="${174 + index * 28}" text-anchor="end" class="copy">${amount}</text>`).join('');
  const ruleY = 190 + receipt.lines.length * 28;
  const total = (receipt.amountCents / 100).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="310" viewBox="0 0 320 310">
    <style>.copy{font:14px Arial,sans-serif;fill:#171812}.small{font:11px Arial,sans-serif;fill:#55564e}.title{font:700 19px Arial,sans-serif;fill:#171812}</style>
    <rect width="320" height="310" fill="#fffdf5"/><rect x="13" y="13" width="294" height="284" fill="none" stroke="#171812" stroke-width="3"/>
    <rect x="27" y="27" width="100" height="25" fill="#ddf746"/><text x="34" y="45" class="small">PAYMENT RECEIPT</text>
    <text x="34" y="86" class="title">${receipt.merchant}</text><text x="34" y="109" class="small">${receipt.date} · SAMPLE ORIGINAL</text>
    <line x1="34" x2="286" y1="132" y2="132" stroke="#171812" stroke-width="2"/>${rows}
    <line x1="34" x2="286" y1="${ruleY}" y2="${ruleY}" stroke="#171812" stroke-width="2"/>
    <text x="34" y="${ruleY + 34}" class="title">TOTAL</text><text x="286" y="${ruleY + 34}" text-anchor="end" class="title">$${total}</text>
    <text x="34" y="${ruleY + 62}" class="small">Saved as an unchanged sample original</text>
  </svg>`;
};

/** Creates deterministic, realistic demo records entirely in memory. */
export async function createDemoReceipts(): Promise<VaultReceipt[]> {
  return Promise.all(samples.map(async (sample) => {
    const { lines: _lines, ...receipt } = sample;
    const image = new Blob([receiptSvg(sample)], { type: receipt.fileType });
    const buffer = await image.arrayBuffer();
    return { ...receipt, fileSize: buffer.byteLength, hash: await sha256(buffer), image };
  }));
}
