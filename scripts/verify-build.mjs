import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = new URL('../dist/', import.meta.url);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }))).flat();
}

const output = root.pathname;
await stat(join(output, 'index.html'));
const files = await filesIn(output);
const hashedAssets = files
  .map((file) => `/${relative(output, file).split(sep).join('/')}`)
  .filter((file) => /^\/assets\/.*\.(?:css|js)$/.test(file));
const worker = await readFile(join(output, 'sw.js'), 'utf8');
for (const asset of hashedAssets) {
  if (!worker.includes(JSON.stringify(asset))) throw new Error(`Service worker does not precache ${asset}`);
}
for (const required of ['ignoreVary: true', 'self.skipWaiting()', 'self.clients.claim()', "searchParams.get('revision')"]) {
  if (!worker.includes(required)) throw new Error(`Service worker is missing ${required}`);
}
if (worker.includes('CACHE_URLS')) throw new Error('Obsolete runtime CACHE_URLS protocol remains in the worker');
if (worker.includes('cache.put(')) throw new Error('The immutable shell cache must not be recreated by runtime writes');
if (!worker.includes("key.startsWith(CACHE_PREFIX) && key !== VERSION")) throw new Error('Worker cache retirement is not namespace-safe');
if (worker.includes('"/staticwebapp.config.json"')) throw new Error('Deploy-only configuration must not be precached');

const config = JSON.parse(await readFile(join(output, 'staticwebapp.config.json'), 'utf8'));
const assets = config.routes?.find((route) => route.route === '/assets/*');
if (assets?.headers?.['Cache-Control'] !== 'public, max-age=31536000, immutable') {
  throw new Error('Fingerprint assets are not configured for immutable caching');
}
const swRoute = config.routes?.find((route) => route.route === '/sw.js');
if (!swRoute?.headers?.['Cache-Control']?.includes('no-store')) throw new Error('Service worker is not configured for revalidation');
const manifestRoute = config.routes?.find((route) => route.route === '/manifest.webmanifest');
if (!manifestRoute?.headers?.['Content-Type']?.startsWith('application/manifest+json')) throw new Error('Manifest MIME type is not configured');
for (const header of ['Content-Security-Policy', 'Permissions-Policy', 'X-Content-Type-Options', 'X-Frame-Options']) {
  if (!config.globalHeaders?.[header]) throw new Error(`Missing security header ${header}`);
}

console.log(`Verified production artifact: ${hashedAssets.length} hashed assets precached; immutable and security policies present.`);
