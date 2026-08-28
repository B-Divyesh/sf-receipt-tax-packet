# Receipt Packet — build handoff

## Delivered

Receipt Packet v1 is a complete local-first receipt evidence workflow. A user
creates a passphrase vault, imports a receipt image, records its date, merchant,
amount, currency, category, and claim explanation, then reviews or filters the
ledger and exports a period packet. Every original is encrypted at rest,
preserved byte-for-byte, fingerprinted with SHA-256, and linked by the same
deterministic path in the PDF/CSV and ZIP.

The export contains:

- `index.pdf` with period, totals, explanations, original paths, and hashes;
- `index.csv` for an accountant or spreadsheet;
- `README.txt` explaining integrity and the non-advice boundary;
- `originals/NNN-filename.ext` for every selected receipt.

Encrypted JSON backup/restore, a lock action, search, mobile capture, empty and
error states, offline status, PWA installation, privacy/terms pages, and the $19
one-time Sociobot supporter unlock are included. Core capture, backup, and full
packet export remain free; the supporter feature is limited to custom PDF cover
fields.

## Implementation notes

- Vite + vanilla TypeScript; no runtime packages, CDNs, analytics, or fonts.
- IndexedDB stores AES-256-GCM ciphertext only. Keys derive in memory with
  PBKDF2-SHA-256 at 250,000 iterations; no passphrase or plaintext is stored.
- Service worker uses a versioned app-shell cache, runtime asset caching,
  navigation fallback, `skipWaiting`, `clients.claim`, and an update-ready toast.
- Original hero imagery was generated specifically for the product and reviewed
  for text/brand/seam issues. Prompt and provenance are in `.factory/design.md`
  and `assets/src/receipt-binder-hero.prompt.json`; WebP variants are 15 KB and
  40 KB.
- PWA icons are authored SVG and reproducibly rasterised with
  `npm run assets:icons`.

## Verification

Run from a clean clone:

```sh
npm ci
npm test
```

Deployment build command: `npm ci && npm run build`. Output is `dist/` and
`dist/index.html` is present at its root.

Verified 2026-08-28 locally:

- Unit: 5/5 passed (crypto, SHA-256, CSV escaping, PDF header, ZIP structure,
  path linking).
- Playwright 1.58.2: 2/2 passed (vault → receipt → ZIP, axe serious/critical,
  offline reload, 390×844 layout/no horizontal overflow).
- Factory `verify-url.sh`: HTTP 200; title/lang/main/one h1/alt checks passed;
  zero console or page errors; measured load 562 ms.
- Lighthouse headless mobile-class audit: Performance 100, Accessibility 100,
  Best Practices 100, SEO 100; LCP 1.2 s, CLS 0, total blocking time 0 ms,
  speed index 0.9 s. (Local preview; production network may differ.)
- Production bundle: 36.7 KB JavaScript and 13.8 KB CSS uncompressed; hero
  sources 15 KB/40 KB WebP. All are well inside factory budgets.
- `npm audit --omit=dev`: 0 production vulnerabilities.

## Known gaps and next steps

- Browser storage is per device and has no cloud sync by design. Users must keep
  explicit backups; clearing site data without one is unrecoverable.
- There is no passphrase recovery. This is an intentional consequence of the
  local encryption model and is disclosed before vault creation.
- HEIC/HEIF bytes can be preserved where the browser provides them, but some
  desktop browsers cannot preview those formats; JPG/PNG/WebP are safest.
- The factory must register the production billing product and confirm the $19
  price/return URL. The app intentionally contains the slug-based contract, not
  a provider product ID.
- Run a production-origin Lighthouse check after deployment because service
  worker and cache timing can vary by host.
