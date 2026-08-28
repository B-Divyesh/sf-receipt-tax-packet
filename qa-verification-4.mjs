import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const baseURL = process.env.QA_URL || 'https://receipt-tax-packet.sociobot.in';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const results = {};
const browser = await chromium.launch({ headless: true });

async function axeSummary(page, key) {
  const scan = await new AxeBuilder({ page }).analyze();
  const severe = scan.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
  results[key] = { seriousCritical: severe.map((v) => v.id), totalViolations: scan.violations.length };
  assert.equal(severe.length, 0);
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));

  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  results.firstRead = {
    title: await page.title(),
    h1: await page.getByRole('heading', { level: 1 }).innerText(),
    lede: await page.locator('.lede').innerText(),
    buttons: await page.getByRole('button').allInnerTexts(),
    sampleActionCount: await page.getByText('Try it with sample data', { exact: true }).count(),
  };
  await page.screenshot({ path: '/tmp/verification-4-desktop-cold.png', fullPage: true });
  assert.equal(results.firstRead.sampleActionCount, 0);
  await axeSummary(page, 'axeLockedDesktop');

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  assert.equal(await skip.evaluate((el) => document.activeElement === el), true);
  results.skipFocusStyle = await skip.evaluate((el) => {
    const css = getComputedStyle(el);
    return { outline: css.outline, outlineColor: css.outlineColor };
  });
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('main#main').evaluate((el) => document.activeElement === el), true);

  await page.getByLabel('Passphrase', { exact: true }).fill('short');
  await page.getByLabel('Confirm passphrase').fill('short');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.getByText('Use at least 10 characters.').waitFor();
  results.shortPassphraseRecovery = true;

  await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
  await page.getByLabel('Confirm passphrase').fill('wrong mismatch phrase');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.getByText('The passphrases do not match.').waitFor();
  results.mismatchRecovery = true;

  await page.getByLabel('Confirm passphrase').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create encrypted vault' }).click();
  await page.getByRole('heading', { level: 1, name: 'Your receipt packet' }).waitFor();
  await page.getByText('No evidence filed yet').waitFor();

  await page.getByRole('button', { name: '+ Add receipt' }).click();
  assert.equal(await page.getByLabel('Original receipt image').evaluate((el) => document.activeElement === el), true);
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'not-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await page.getByLabel('Receipt date').fill('2026-01-01');
  await page.getByLabel('Merchant').fill('Boundary Supplies');
  await page.getByLabel('Amount').fill('0.01');
  await page.getByLabel('Claim explanation').fill('Small office supply used for client records.');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByText('Choose a JPG, PNG, WebP, HEIC, or HEIF image.').waitFor();
  results.nonImageRecovery = true;

  await page.getByLabel('Original receipt image').setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByText('That image is over 15 MB. Keep the original, but reduce the file size before adding it.').waitFor();
  results.oversizeRecovery = true;

  await page.getByLabel('Original receipt image').setInputFiles({ name: 'tiny-boundary.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByText('Boundary Supplies').waitFor();
  await page.locator('.receipt-row').filter({ hasText: 'Boundary Supplies' }).getByText('$0.01').waitFor();

  await page.getByRole('button', { name: '+ Add receipt' }).click();
  await page.getByLabel('Original receipt image').setInputFiles({ name: 'maximum.png', mimeType: 'image/png', buffer: tinyPng });
  await page.getByLabel('Receipt date').fill('2026-12-31');
  await page.getByLabel('Merchant').fill('Maximum Equipment');
  await page.getByLabel('Amount').fill('99999999');
  await page.getByLabel('Currency').selectOption('USD');
  await page.getByLabel('Category').selectOption('Equipment');
  await page.getByLabel('Claim explanation').fill('Boundary-value equipment record for export verification.');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByText('Maximum Equipment').waitFor();
  results.boundaryAmounts = { min: '$0.01', maxVisible: await page.getByText('$99,999,999.00').isVisible(), totalVisible: await page.getByText('$99,999,999.01').isVisible() };

  await axeSummary(page, 'axePopulatedDesktop');

  await page.getByLabel('Find a receipt').fill('nothing matches this');
  await page.getByRole('heading', { name: 'No matching receipts' }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await page.getByLabel('Find a receipt').evaluate((el) => document.activeElement === el), true);
  await page.getByText('Maximum Equipment').waitFor();
  results.searchRecovery = true;

  await page.getByRole('button', { name: 'View original from Boundary Supplies' }).click();
  await page.getByRole('heading', { name: 'Original receipt' }).waitFor();
  const originalHash = await page.locator('.full-hash').innerText();
  assert.match(originalHash, /^[a-f0-9]{64}$/);
  await page.getByRole('button', { name: 'Close original viewer' }).click();

  await page.getByRole('button', { name: 'Edit Boundary Supplies receipt' }).click();
  await page.getByText('Original locked').waitFor();
  await page.getByLabel('Merchant').fill('Boundary Supplies Edited');
  await page.getByRole('button', { name: 'Save receipt' }).click();
  await page.getByText('Boundary Supplies Edited').waitFor();
  await page.getByRole('button', { name: 'View original from Boundary Supplies Edited' }).click();
  const editedHash = await page.locator('.full-hash').innerText();
  assert.equal(editedHash, originalHash);
  await page.getByRole('button', { name: 'Close original viewer' }).click();
  results.originalIntegrityOnEdit = true;

  await page.getByLabel('From', { exact: true }).fill('2026-12-01');
  await page.getByLabel('To', { exact: true }).fill('2026-12-31');
  await page.getByText('1 receipt selected').waitFor();
  const packetPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence ZIP' }).click();
  const packet = await packetPromise;
  await packet.saveAs('/tmp/verification-4-packet.zip');
  results.packet = { filename: packet.suggestedFilename() };

  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted backup' }).click();
  const backup = await backupPromise;
  await backup.saveAs('/tmp/verification-4-backup.json');
  const backupText = await readFile('/tmp/verification-4-backup.json', 'utf8');
  results.backup = {
    filename: backup.suggestedFilename(),
    format: JSON.parse(backupText).format,
    leaksMerchant: backupText.includes('Maximum Equipment') || backupText.includes('Boundary Supplies'),
    leaksNote: backupText.includes('Boundary-value equipment'),
  };
  assert.equal(results.backup.leaksMerchant, false);
  assert.equal(results.backup.leaksNote, false);

  page.on('dialog', async (dialog) => dialog.accept());
  await page.getByLabel('Restore backup').setInputFiles({ name: 'bad-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await page.locator('#toast').getByText('This is not a Receipt Packet encrypted backup.').waitFor();
  await page.getByText('Maximum Equipment').waitFor();
  results.invalidBackupRecovery = true;

  const encryptedRows = await page.evaluate(async () => new Promise((resolve, reject) => {
    const req = indexedDB.open('receipt-packet-v1');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('receipts', 'readonly');
      const get = tx.objectStore('receipts').getAll();
      get.onsuccess = () => resolve(JSON.stringify(get.result));
      get.onerror = () => reject(get.error);
    };
  }));
  results.indexedDbPlaintextLeak = String(encryptedRows).includes('Maximum Equipment') || String(encryptedRows).includes('Boundary-value equipment');
  assert.equal(results.indexedDbPlaintextLeak, false);

  await page.getByRole('button', { name: 'Lock vault' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByLabel('Passphrase').fill('incorrect passphrase');
  await page.getByRole('button', { name: 'Unlock packet' }).click();
  await page.getByText('That passphrase did not unlock this vault. Try again.').waitFor();
  await page.getByLabel('Passphrase').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Unlock packet' }).click();
  await page.getByText('Maximum Equipment').waitFor();
  results.refreshPersistenceAndWrongPassRecovery = true;

  const demoPage = await context.newPage();
  await demoPage.goto(`${baseURL}/?demo=1`, { waitUntil: 'networkidle' });
  results.demoQuery = {
    sampleAction: await demoPage.getByText('Try it with sample data', { exact: true }).count(),
    demoBanner: await demoPage.getByText(/Demo — sample data, nothing is saved/i).count(),
    h1: await demoPage.getByRole('heading', { level: 1 }).innerText(),
  };
  await demoPage.close();

  results.network = {
    origins: [...new Set(requests.map((url) => new URL(url).origin))],
    external: requests.filter((url) => new URL(url).origin !== new URL(baseURL).origin),
  };
  results.errors = { consoleErrors, pageErrors };
  await page.screenshot({ path: '/tmp/verification-4-desktop-populated.png', fullPage: true });
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mobilePage = await mobile.newPage();
  const mobileConsoleErrors = [];
  const mobilePageErrors = [];
  mobilePage.on('console', (msg) => { if (msg.type() === 'error') mobileConsoleErrors.push(msg.text()); });
  mobilePage.on('pageerror', (error) => mobilePageErrors.push(error.message));
  await mobilePage.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await axeSummary(mobilePage, 'axeLockedMobile');
  await mobilePage.evaluate(() => navigator.serviceWorker.ready);
  await mobilePage.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await mobilePage.reload({ waitUntil: 'networkidle' });
  const mobileMetrics = await mobilePage.evaluate(() => {
    const selectors = ['.wordmark', 'footer a[href="/privacy/"]', 'footer a[href="/terms/"]'];
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      targets: Object.fromEntries(selectors.map((selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return [selector, { width: r.width, height: r.height }];
      })),
      buttonTransition: getComputedStyle(document.querySelector('.button')).transitionDuration,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
    };
  });
  await mobilePage.screenshot({ path: '/tmp/verification-4-mobile-cold.png', fullPage: true });
  await mobile.setOffline(true);
  await mobilePage.reload({ waitUntil: 'domcontentloaded' });
  await mobilePage.getByText('Offline — capture and export still work').waitFor();
  await mobilePage.reload({ waitUntil: 'domcontentloaded' });
  await mobilePage.getByRole('heading', { level: 1 }).waitFor();
  results.mobileOffline = { ...mobileMetrics, consoleErrors: mobileConsoleErrors, pageErrors: mobilePageErrors, offlineReloads: 2 };
  await mobile.close();

  const updateContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const updatePage = await updateContext.newPage();
  await updatePage.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await updatePage.evaluate(() => navigator.serviceWorker.ready);
  await updatePage.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await updatePage.reload({ waitUntil: 'networkidle' });
  await updatePage.evaluate(async () => {
    await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('replacement worker timeout')), 15000);
      navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timeout); resolve(); }, { once: true });
      await navigator.serviceWorker.register('/sw.js?revision=verification-4', { scope: '/' });
    });
  });
  await updatePage.getByText('Updated app ready.').waitFor();
  await updatePage.waitForTimeout(3000);
  const beforeOffline = await updatePage.evaluate(async () => ({
    caches: (await caches.keys()).filter((key) => key.startsWith('receipt-packet-shell-')),
    controller: navigator.serviceWorker.controller?.scriptURL,
  }));
  await updateContext.setOffline(true);
  await Promise.all([updatePage.waitForNavigation({ waitUntil: 'domcontentloaded' }), updatePage.getByRole('button', { name: 'Reload' }).click()]);
  await updatePage.waitForTimeout(3000);
  const afterOffline = await updatePage.evaluate(async () => ({
    caches: (await caches.keys()).filter((key) => key.startsWith('receipt-packet-shell-')),
    controller: navigator.serviceWorker.controller?.scriptURL,
    h1: document.querySelector('h1')?.textContent,
  }));
  results.workerUpdate = { beforeOffline, afterOffline };
  await updateContext.close();

  for (const route of ['/privacy/', '/terms/', '/offline.html']) {
    const legalContext = await browser.newContext();
    const legal = await legalContext.newPage();
    await legal.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    await axeSummary(legal, `axe${route}`);
    await legalContext.close();
  }

  await writeFile('/tmp/verification-4-browser-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
