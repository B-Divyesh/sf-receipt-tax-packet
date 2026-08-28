import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });

async function render(source, output, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(source)).href);
  await page.screenshot({ path: output, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}

await render('public/icons/icon-source.svg', 'public/icons/icon-192.png', 192);
await render('public/icons/icon-source.svg', 'public/icons/icon-512.png', 512);
await render('public/icons/icon-maskable-source.svg', 'public/icons/icon-maskable-512.png', 512);
await browser.close();
