# Receipt Packet — verification handoff

## Independent verification 2 verdict (2026-08-28)

**FAIL — do not release or certify candidate
`bd8b32719d856fb8704923b42ce7f836d027ed52`.** Fresh independent verification
against <https://receipt-tax-packet.sociobot.in/> found three release blockers:
the candidate service worker intermittently fails offline reload and reliably
fails the tested post-update offline reload; the live `/sw.js` is a different,
later repaired artifact; and live hashed JS/CSS still use
`Cache-Control: public, must-revalidate, max-age=30` instead of long-lived
immutable caching. Three mobile navigation/legal links also miss the required
44 px touch-target minimum.

All repository gates, the normal receipt-to-ZIP workflow, encryption/backup
recovery, axe serious/critical checks, privacy trace, responsive layout, and
performance budgets otherwise passed. Lighthouse scored 100/100/100/100 on
both the candidate preview and live origin. See
[verification 2](verification-2.md) for exact hashes, reproduction steps,
severity-ranked defects, and end-to-end evidence. The earlier verification of
the later repair remains in [verification](verification.md) for history.

## Historical builder and repair handoff

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
- The production build now generates `dist/sw.js` from the actual output file
  list. Its versioned precache includes `/`, the hashed Vite JavaScript and CSS,
  all local assets, manifest, legal pages, and offline page. Cache matching
  ignores Vite preview's response-only `Vary: Origin` difference, so the same
  precached module response is available to browser module requests offline.
  It retains network-first navigations, cache-first assets, `skipWaiting`, and
  `clients.claim`.
- Original hero imagery was generated specifically for the product and reviewed
  for text/brand/seam issues. Prompt and provenance are in `.factory/design.md`
  and `assets/src/receipt-binder-hero.prompt.json`; WebP variants are 15 KB and
  40 KB.
- PWA icons are authored SVG and reproducibly rasterised with
  `npm run assets:icons`.

## Repair verification

Run from a clean clone:

```sh
npm ci
npm test
```

Deployment build command: `npm ci && npm run build`. Output is `dist/` and
`dist/index.html` is present at its root.

Verified 2026-08-28 locally from the repair branch:

- Reproduced the original failure with `npm ci && npm test`: the vault/receipt/
  export flow passed, but the 390×844 offline reload failed because the old
  worker cached HTML without Vite's hashed JS/CSS. A first generated-precache
  attempt exposed Vite preview's `Vary: Origin` cache mismatch; the final
  cache-first lookup explicitly ignores that response variance.
- Exact clean deploy build: `npm ci && npm run build` passed; `dist/index.html`
  exists at the output root.
- Full `npm test` passed: 5/5 Vitest unit tests and 2/2 Playwright Chromium
  tests. The browser flow creates an encrypted vault, links a PNG receipt, and
  downloads a receipt ZIP. It additionally runs axe with zero serious/critical
  findings, tabs to the skip link, operates add/save/export with Enter, checks
  dialog focus, and checks the 390×844 layout has no horizontal overflow.
- The offline regression test runs against `vite preview` from a fresh build,
  asserts the actual hashed JS and CSS are in Cache Storage, waits for service
  worker control, sets the browser context offline, reloads, and verifies the
  application shell plus the offline status strip. It passed twice consecutively
  after the repair.
- Factory `verify-url.sh` against local production preview: HTTP 200; title,
  `lang`, one `h1`, main landmark, and image-alt checks passed; zero console or
  page errors; measured load 555 ms.
- Lighthouse mobile local preview: Performance 100, Accessibility 100, Best
  Practices 100, SEO 100; LCP 1.2 s, CLS 0, total blocking time 0 ms.
- Privacy/static scan found no analytics, tracker, CDN, or remote font URLs;
  the only external endpoint in the built app is the documented Sociobot
  license checkout/verification API. `npm audit --omit=dev` reported 0
  production vulnerabilities.
- Production bundle: 36.7 KB JavaScript and 13.8 KB CSS uncompressed; hero
  sources 15 KB/40 KB WebP. All are well inside factory budgets.
- Deployed with `/opt/fleet/lib/deploy-static.sh receipt-tax-packet dist` to
  Azure Static Web Apps (Central US). Azure reported the custom domain `Ready`.
  Live `https://receipt-tax-packet.sociobot.in` verification then passed: HTTPS
  200, 648 ms page load, zero console/page errors, correct title and `lang`,
  one `h1`, a main landmark, no missing image alt text, and no unlabeled
  buttons. The live `sw.js` contains the generated versioned precache with the
  current hashed JS/CSS assets and `ignoreVary` cache matching; `/privacy/`
  responds with the local-first disclosure.

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
