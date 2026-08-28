import type { PacketOptions, VaultReceipt } from './types';

const encoder = new TextEncoder();

export function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function safeFileName(value: string): string {
  const cleaned = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 80) || 'receipt';
}

const exportOriginalName = (receipt: VaultReceipt, index: number): string =>
  `originals/${String(index + 1).padStart(3, '0')}-${safeFileName(receipt.fileName)}`;

export function receiptCsv(receipts: VaultReceipt[]): string {
  const header = ['date', 'merchant', 'amount', 'currency', 'category', 'claim_note', 'original_file', 'sha256'];
  const rows = receipts.map((receipt, index) => [
    receipt.date,
    receipt.merchant,
    (receipt.amountCents / 100).toFixed(2),
    receipt.currency,
    receipt.category,
    receipt.note,
    exportOriginalName(receipt, index),
    receipt.hash,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrap(value: string, length: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > length && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function createIndexPdf(receipts: VaultReceipt[], options: PacketOptions): Uint8Array {
  const totals = new Map<string, number>();
  for (const receipt of receipts) totals.set(receipt.currency, (totals.get(receipt.currency) ?? 0) + receipt.amountCents);
  const totalText = [...totals].map(([currency, cents]) => `${currency} ${(cents / 100).toFixed(2)}`).join(' / ');
  const lines: Array<{ text: string; size: number; bold?: boolean }> = [
    { text: options.title || 'Receipt evidence packet', size: 20, bold: true },
    { text: `${options.from || 'All dates'} to ${options.to || 'present'}  |  ${receipts.length} original${receipts.length === 1 ? '' : 's'}`, size: 10 },
    ...(options.preparedBy ? [{ text: `Prepared by ${options.preparedBy}`, size: 10 }] : []),
    { text: totalText || 'No totals', size: 12, bold: true },
    { text: 'Each line below is linked by filename and SHA-256 fingerprint to the unchanged original in this ZIP.', size: 9 },
  ];
  receipts.forEach((receipt, index) => {
    lines.push({ text: `${index + 1}. ${receipt.date} | ${receipt.merchant} | ${receipt.currency} ${(receipt.amountCents / 100).toFixed(2)} | ${receipt.category}`, size: 10, bold: true });
    wrap(`Claim note: ${receipt.note}`, 95).forEach((text) => lines.push({ text, size: 9 }));
    lines.push({ text: `Original: ${exportOriginalName(receipt, index)} | SHA-256: ${receipt.hash}`, size: 7 });
  });

  const pages: typeof lines[] = [];
  for (let index = 0; index < lines.length; index += 34) pages.push(lines.slice(index, index + 34));
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageObjectIds: number[] = [];
  const fontRegular = 3;
  const fontBold = 4;
  objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  let nextId = 5;
  pages.forEach((page, pageIndex) => {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIds.push(pageId);
    let y = 756;
    const commands = ['BT'];
    if (pageIndex > 0) {
      commands.push(`/F2 13 Tf 50 ${y} Td (${pdfText(`${options.title || 'Receipt evidence packet'} - continued`)}) Tj`);
      y -= 24;
    }
    for (const line of page) {
      commands.push(`1 0 0 1 50 ${y} Tm /F${line.bold ? '2' : '1'} ${line.size} Tf (${pdfText(line.text)}) Tj`);
      y -= line.size >= 18 ? 28 : line.size >= 10 ? 18 : 14;
    }
    commands.push('ET');
    const content = commands.join('\n');
    objects[contentId] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = encoder.encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = encoder.encode(output).length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) output += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(output);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDate(date = new Date()): { time: number; day: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const u16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const u32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true);

export async function createZip(files: Array<{ name: string; data: Blob | Uint8Array | string }>): Promise<Blob> {
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  const { time, day } = zipDate();
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data instanceof Blob ? new Uint8Array(await file.data.arrayBuffer()) : file.data;
    const crc = crc32(data);
    const local = new ArrayBuffer(30 + name.length);
    const lv = new DataView(local);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0); u16(lv, 8, 0); u16(lv, 10, time); u16(lv, 12, day);
    u32(lv, 14, crc); u32(lv, 18, data.length); u32(lv, 22, data.length); u16(lv, 26, name.length); u16(lv, 28, 0);
    new Uint8Array(local, 30).set(name);
    localParts.push(local, data.slice().buffer as ArrayBuffer);
    const central = new ArrayBuffer(46 + name.length);
    const cv = new DataView(central);
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0); u16(cv, 10, 0); u16(cv, 12, time); u16(cv, 14, day);
    u32(cv, 16, crc); u32(cv, 20, data.length); u32(cv, 24, data.length); u16(cv, 28, name.length); u16(cv, 30, 0); u16(cv, 32, 0);
    u16(cv, 34, 0); u16(cv, 36, 0); u32(cv, 38, 0); u32(cv, 42, offset);
    new Uint8Array(central, 46).set(name);
    centralParts.push(central);
    offset += local.byteLength + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + (part as ArrayBuffer).byteLength, 0);
  const end = new ArrayBuffer(22);
  const ev = new DataView(end);
  u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0); u16(ev, 8, files.length); u16(ev, 10, files.length);
  u32(ev, 12, centralSize); u32(ev, 16, offset); u16(ev, 20, 0);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

export async function createPacket(receipts: VaultReceipt[], options: PacketOptions): Promise<Blob> {
  const files: Array<{ name: string; data: Blob | Uint8Array | string }> = [
    { name: 'index.pdf', data: createIndexPdf(receipts, options) },
    { name: 'index.csv', data: `\uFEFF${receiptCsv(receipts)}` },
    { name: 'README.txt', data: `Receipt Packet evidence export\nCreated: ${new Date().toISOString()}\nPeriod: ${options.from || 'all'} to ${options.to || 'present'}\n\nEach original is preserved byte-for-byte. Compare a file's SHA-256 fingerprint with index.csv or index.pdf to verify integrity. Categories and claim notes are supplied by the packet owner; this export does not determine tax deductibility.` },
  ];
  receipts.forEach((receipt, index) => {
    files.push({ name: exportOriginalName(receipt, index), data: receipt.image });
  });
  return createZip(files);
}
