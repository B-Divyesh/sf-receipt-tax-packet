# Receipt Packet — repair handoff

## Release status

**PASS — repaired, pushed, and deployed 2026-08-28.** This repair addresses the
independent verifier report in `ae276377c49c40d24b36a3267a02002d5c5886aa`
for candidate `bd8b32719d856fb8704923b42ce7f836d027ed52`.

Deployed product code is commits `fdd2264` and `8a174de` on `main`. Deployment
`54871135-7a0a-4ca8-b395-f0d8aaf1e9db` completed successfully to the existing
Azure Static Web App in Central US. The custom domain is Ready at
<https://receipt-tax-packet.sociobot.in/>.

## Repairs

- **Offline/update reliability:** production builds generate `dist/sw.js` from
  the actual output inventory and precache the hashed JS/CSS. Cache lookup uses
  `ignoreVary`; install uses `skipWaiting`; activation retires old caches before
  `clients.claim`. The obsolete runtime `CACHE_URLS` protocol and stale
  `public/sw.js` were removed. Deploy-only `staticwebapp.config.json` is
  explicitly excluded because Azure consumes it and returns 404 for that path.
- **Artifact identity:** the deployed HTML, worker, manifest, legal/offline
  pages, JS/CSS, artwork, icons, robots, and sitemap are the exact repair build.
  All 17 deployable files matched local SHA-256 byte-for-byte. Live `/sw.js` and
  `dist/sw.js` both hash to
  `49e0cf3d4f5d8d44ee74e7e5bab18de394b801b929366c94869ea1890ffbff4f`.
- **Response caching:** `/assets/index-CGvgiooB.css` and
  `/assets/index-DtnT7533.js` now return
  `Cache-Control: public, max-age=31536000, immutable`. `/sw.js` returns
  `no-cache, no-store, must-revalidate` so updates are discovered promptly.
- **Mobile targets:** the wordmark is 160.1×44 CSS px; Privacy and Terms are
  each 44×44 CSS px at 390×844. Automated geometry assertions protect all three.
- **Other verifier findings:** a populated vault now shows a distinct “No
  matching receipts” state with a keyboard-operable clear action. CSP,
  Permissions-Policy, `X-Frame-Options: DENY`, nosniff, and Referrer-Policy ship
  through Azure configuration. Vite 7.3.6 and Vitest 3.2.7 remove the reported
  development advisories; both full and production-only audits report zero.

## Exact regression coverage

`npm test` now proves:

- five crypto/export unit and integration tests;
- production TypeScript and Vite build;
- generated worker contains every hashed JS/CSS asset, `ignoreVary`,
  `skipWaiting`, `clients.claim`, and no runtime `CACHE_URLS` or deploy-only
  configuration URL;
- deployment policy contains immutable asset caching, worker revalidation, CSP,
  permissions, content-type, and frame restrictions;
- desktop vault creation → encrypted receipt → search/no-results recovery → ZIP
  export, with keyboard activation and axe;
- 390px fresh install, two controlled online reloads, two offline reloads,
  zero horizontal overflow, and measured 44px targets;
- a real active-worker replacement, visible update action, old-cache retirement,
  hashed asset presence in the replacement cache, and offline reload after the
  user chooses Reload.

## Verification evidence

Run from a clean clone:

```sh
npm ci
npm test
```

Results on the repair commit:

- `npm ci`: 61 packages installed; zero vulnerabilities.
- Vitest: 2 files, 5/5 tests passed.
- Playwright 1.58.2 Chromium: 3/3 tests passed.
- Production build: `dist/index.html` present; JS 36,947 B (12.35 KB gzip), CSS
  13,930 B (3.84 KB gzip), no fonts, mobile hero 14,718 B.
- Factory `verify-url.sh`, local and live: HTTP 200, correct title/lang, one
  `h1`, main landmark, image alt text, labelled buttons, and zero console/page
  errors. Live measured load was 763 ms.
- Axe: zero violations on 1440×900 desktop, 390×844 mobile, privacy, terms, and
  offline pages. Keyboard skip-link, form, dialog, save, and export paths pass.
  Reduced-motion transition duration is effectively zero (`0.00001s`).
- Live 390px lifecycle: fresh worker became active and controlling; two offline
  reloads passed; replacement cache contained both current hashed assets; update
  toast appeared; post-update offline reload passed; overflow was 0 px.
- Live privacy trace: no requests outside the product origin during normal use.
  Invalid-license verification returned HTTP 200,
  `{valid:false, reason:"invalid"}`, production-origin CORS, and `no-store`.
- Live response policy includes CSP, Permissions-Policy, frame denial,
  Referrer-Policy, nosniff, immutable hashed assets, and a non-cacheable worker.
- Lighthouse 13.0.1 mobile, local: 100 Performance / 100 Accessibility / 100
  Best Practices / 100 SEO, LCP 1.2 s, TBT 0 ms, CLS 0. Live: 100 / 100 / 100 /
  100, LCP 1.1 s, TBT 0 ms, CLS 0. Lighthouse emitted a browser-tab shutdown
  warning after writing each complete JSON report; the audits and scores were
  complete.

The product remains a static Vite + TypeScript offline PWA with `dist/` as the
deployment root. No backend, package-consumer surface, tracking, CDN font, or
new external service was added.

## Known product constraints

- Browser storage is per device and intentionally has no cloud sync. Clearing
  site data without an exported encrypted backup is unrecoverable.
- There is intentionally no passphrase recovery; this is disclosed before vault
  creation.
- HEIC/HEIF originals can be preserved where supplied, but browser preview
  support varies. JPG, PNG, and WebP are safest.
- The factory must keep the production `$19` Sociobot billing product and return
  URL registered. The app uses only the documented slug-based billing contract.
