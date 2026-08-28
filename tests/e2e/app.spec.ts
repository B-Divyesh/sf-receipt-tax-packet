import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('creates an encrypted vault, links a receipt, and exports a packet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every claim keeps its proof.');
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

  await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
  await page.getByLabel('Confirm passphrase').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your receipt packet');
  await expect(page.getByText('No evidence filed yet')).toBeVisible();

  await page.getByRole('button', { name: '+ Add receipt' }).click();
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'rail-ticket.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByLabel('Receipt date').fill('2026-08-20');
  await page.getByLabel('Merchant').fill('Metro Rail');
  await page.getByLabel('Amount').fill('18.40');
  await page.getByLabel('Category').selectOption('Travel');
  await page.getByLabel('Claim explanation').fill('Train to client site for project meeting.');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await expect(page.getByText('Metro Rail')).toBeVisible();
  await expect(page.getByText('100% linked')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).click();
  const packet = await download;
  expect(packet.suggestedFilename()).toMatch(/^receipt-packet-.*\.zip$/);
});

test('loads the app shell offline at mobile width', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Offline — capture and export still work')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});
