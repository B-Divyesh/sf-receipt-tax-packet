import { expect, test, type Download } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('creates an encrypted vault, links a receipt, and exports a packet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Organize receipts for your tax handoff');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
  await expect(page).toHaveURL(/#main$/);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

  await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
  await page.getByLabel('Confirm passphrase').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your receipt packet');
  await expect(page.getByText('No evidence filed yet')).toBeVisible();

  await page.getByRole('button', { name: '+ Add receipt' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Original receipt image')).toBeFocused();
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'rail-ticket.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByLabel('Receipt date').fill('2026-08-20');
  await page.getByLabel('Merchant').fill('Metro Rail');
  await page.getByLabel('Amount').fill('18.40');
  await page.getByLabel('Category').selectOption('Travel');
  await page.getByLabel('Claim explanation').fill('Train to client site for project meeting.');
  await page.getByRole('button', { name: 'Save receipt' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Metro Rail')).toBeVisible();
  await expect(page.getByText('100% linked')).toBeVisible();

  await page.getByLabel('Find a receipt').fill('no matching receipt');
  await expect(page.getByRole('heading', { name: 'No matching receipts' })).toBeVisible();
  await expect(page.getByText('No evidence filed yet')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByText('Metro Rail')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).focus();
  await page.keyboard.press('Enter');
  const packet = await download;
  expect(packet.suggestedFilename()).toMatch(/^receipt-packet-.*\.zip$/);
});

test('sets route titles and keeps legal and 404 pages free of serious accessibility failures', async ({ page }) => {
  const pages = [
    ['/privacy/', 'Privacy — Receipt Packet'],
    ['/terms/', 'Terms — Receipt Packet'],
    ['/404.html', 'Page not found — Receipt Packet'],
  ] as const;
  for (const [route, title] of pages) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  }
});

function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compression = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    expect(compression).toBe(0);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataOffset = offset + 30 + nameLength + extraLength;
    files.set(name, bytes.slice(dataOffset, dataOffset + size));
    offset = dataOffset + size;
  }
  return files;
}

async function downloadBytes(download: Download): Promise<Uint8Array> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('The download stream was unavailable.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return new Uint8Array(Buffer.concat(chunks));
}

test('@claim:demo-sample opens a populated sample packet from the first screen and direct demo URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByText('Civic Print & Post')).toBeVisible();
  await expect(page.getByText('Harbor Rail')).toBeVisible();
  await expect(page.getByText('Fieldwork Software')).toBeVisible();

  await page.goto('/?demo=1');
  await expect(page).toHaveTitle('Demo — Receipt Packet');
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
});

test('@claim:demo-isolation resets sample edits and leaves the real vault empty', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: '+ Add receipt' }).click();
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'demo-only.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByLabel('Receipt date').fill('2026-08-30');
  await page.getByLabel('Merchant').fill('Demo-only office supply');
  await page.getByLabel('Amount').fill('12.00');
  await page.getByLabel('Claim explanation').fill('A change made only to the sample packet.');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await expect(page.locator('.receipt-row')).toHaveCount(4);

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByText('Demo-only office supply')).toHaveCount(0);

  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Create encrypted vault' })).toBeVisible();
  await expect(page.getByText('Harbor Rail')).toHaveCount(0);
  await context.close();
});

test('@claim:encrypted-local-storage keeps sample merchant names out of IndexedDB records', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo');
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  const stored = await page.evaluate(async () => new Promise<string>((resolve, reject) => {
    const opening = indexedDB.open('receipt-packet-demo-v1');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const get = opening.result.transaction('receipts', 'readonly').objectStore('receipts').getAll();
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(JSON.stringify(get.result));
    };
  }));
  expect(stored).not.toContain('Harbor Rail');
  expect(stored).not.toContain('quarterly handoff');
  expect(stored).toContain('cipher');
  await context.close();
});

test('@claim:packet-export builds a ZIP with a PDF index, CSV, and all sample originals', async ({ page }) => {
  await page.goto('/demo');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).click();
  const files = readStoredZip(await downloadBytes(await downloadPromise));
  expect(files.has('index.pdf')).toBe(true);
  expect(files.has('index.csv')).toBe(true);
  expect(files.has('README.txt')).toBe(true);
  const originals = [...files.keys()].filter((name) => name.startsWith('originals/'));
  expect(originals).toHaveLength(3);
  const csv = new TextDecoder().decode(files.get('index.csv'));
  expect(csv).toContain('date,merchant,amount,currency,category,claim_note,original_file,sha256');
  expect(csv).toContain('Civic Print & Post');
  expect(csv).toContain('Harbor Rail');
  expect(csv).toContain('Fieldwork Software');
});

test('@claim:original-links puts every sample original filename and SHA-256 fingerprint in the exported index', async ({ page }) => {
  await page.goto('/demo');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).click();
  const files = readStoredZip(await downloadBytes(await downloadPromise));
  const csv = new TextDecoder().decode(files.get('index.csv'));
  const rows = csv.trim().split(/\r?\n/).slice(1);
  expect(rows).toHaveLength(3);
  expect(rows.every((row) => /originals\/\d{3}-[\w.-]+\.svg/.test(row))).toBe(true);
  expect(rows.every((row) => /[a-f0-9]{64}/.test(row))).toBe(true);
});

test('@claim:local-only makes no external request while using the sample packet', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'View original from Harbor Rail' }).click();
  await expect(page.getByRole('heading', { name: 'Original receipt' })).toBeVisible();
  await page.getByRole('button', { name: 'Close original viewer' }).click();
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => /^https?:/.test(url)).every((url) => new URL(url).origin === origin)).toBe(true);
});

test('@claim:supporter-cover-fields puts active-license cover fields into the exported PDF', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:receipt-tax-packet:verdict', JSON.stringify({ valid: true, checkedAt: Date.now() }));
  });
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
  await page.getByLabel('Confirm passphrase').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.getByRole('button', { name: '+ Add receipt' }).click();
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'cover-test.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByLabel('Receipt date').fill('2026-08-30');
  await page.getByLabel('Merchant').fill('Cover field test');
  await page.getByLabel('Amount').fill('20.00');
  await page.getByLabel('Claim explanation').fill('A record used to confirm the licensed cover fields.');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await expect(page.getByText('Cover field test')).toBeVisible();
  await expect(page.getByLabel('Cover title')).toBeEnabled();
  await page.getByLabel('Cover title').fill('August client packet');
  await page.getByLabel('Prepared by').fill('Jordan Lee');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).click();
  const files = readStoredZip(await downloadBytes(await downloadPromise));
  const pdf = new TextDecoder().decode(files.get('index.pdf'));
  expect(pdf).toContain('August client packet');
  expect(pdf).toContain('Prepared by Jordan Lee');
});

test('@claim:offline-reload loads the sample packet offline at mobile width', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const precache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cached = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
    return cached.flat().map((request) => new URL(request.url).pathname);
  });
  expect(precache.some((path) => /^\/assets\/index-.*\.js$/.test(path))).toBeTruthy();
  expect(precache.some((path) => /^\/assets\/index-.*\.css$/.test(path))).toBeTruthy();
  expect(precache).toContain('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await page.reload();

  for (const selector of ['.wordmark', 'footer a[href="/privacy/"]', 'footer a[href="/terms/"]']) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should have measurable geometry`).not.toBeNull();
    expect(box!.width, `${selector} should be at least 44 CSS px wide`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${selector} should be at least 44 CSS px tall`).toBeGreaterThanOrEqual(44);
  }

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Offline — capture and export still work')).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});

test('replaces the active worker and reloads the new shell offline', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();

  await page.evaluate(async () => {
    await new Promise<void>(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Updated worker did not take control')), 10_000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      await navigator.serviceWorker.register('/sw.js?revision=regression-update', { scope: '/' });
    });
  });

  await expect(page.getByText('Updated app ready.')).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBe(1);
  const updatedPrecache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cached = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()));
    return { keys, paths: cached.flat().map((request) => new URL(request.url).pathname) };
  });
  expect(updatedPrecache.keys).toHaveLength(1);
  expect(updatedPrecache.keys[0]).toContain('regression-update');
  expect(updatedPrecache.paths.some((path) => /^\/assets\/index-.*\.js$/.test(path))).toBeTruthy();
  expect(updatedPrecache.paths.some((path) => /^\/assets\/index-.*\.css$/.test(path))).toBeTruthy();

  await context.setOffline(true);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByRole('button', { name: 'Reload' }).click(),
  ]);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Offline — capture and export still work')).toBeVisible();
  const cachesAfterReload = await page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith('receipt-packet-shell-')));
  expect(cachesAfterReload).toHaveLength(1);
  expect(cachesAfterReload[0]).toContain('regression-update');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')).toContain('revision=regression-update');
  await context.close();
});
