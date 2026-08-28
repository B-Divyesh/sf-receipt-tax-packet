import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('creates an encrypted vault, links a receipt, and exports a packet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every claim keeps its proof.');
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

test('loads the app shell offline at mobile width', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
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
  await context.close();
});
