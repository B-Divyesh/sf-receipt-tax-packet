import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const cacheName = (files: string[]): string =>
  `receipt-packet-shell-${createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)}`;

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

function serviceWorkerSource(version: string, precache: string[]): string {
  return `/* Generated during the production build. Do not edit this copy. */
const CACHE_PREFIX = 'receipt-packet-shell-';
const BASE_VERSION = ${JSON.stringify(version)};
const REVISION = new URL(self.location.href).searchParams.get('revision');
const VERSION = REVISION ? \`${'${BASE_VERSION}'}-\${REVISION.replace(/[^a-z0-9._-]/gi, '')}\` : BASE_VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 2)};

const retireOldShells = async () => {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== VERSION)
    .map((key) => caches.delete(key)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    retireOldShells()
      .then(() => self.clients.claim())
      .then(retireOldShells),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request, { ignoreVary: true })) || (await caches.match('/', { ignoreVary: true })) || (await caches.match('/offline.html', { ignoreVary: true }))));
    return;
  }

  event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)));
});
`;
}

function generatedPrecache(): Plugin {
  return {
    name: 'receipt-packet-generated-precache',
    apply: 'build',
    async closeBundle() {
      const output = join(process.cwd(), 'dist');
      const files = await filesIn(output);
      const precache = files
        .map((file) => `/${relative(output, file).split(sep).join('/')}`)
        .filter((file) => !['/sw.js', '/staticwebapp.config.json'].includes(file) && !file.endsWith('.map'))
        .concat(['/', '/privacy/', '/terms/'])
        .sort();
      await writeFile(join(output, 'sw.js'), serviceWorkerSource(cacheName(precache), precache));
    },
  };
}

export default defineConfig({
  plugins: [generatedPrecache()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 2048,
  },
});
