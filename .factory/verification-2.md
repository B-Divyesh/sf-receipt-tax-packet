# Independent verification 2 — FAIL

**Verified:** 2026-08-28 06:36 UTC  
**Candidate:** `bd8b32719d856fb8704923b42ce7f836d027ed52`  
**Live URL:** <https://receipt-tax-packet.sociobot.in/>  
**Verdict:** **FAIL — do not release or certify this candidate.** The candidate
does not reliably reload offline after a worker refresh/update, the deployed
worker is not the candidate worker, and the live host still violates the
required immutable-cache policy. Functional receipt capture and export are
otherwise sound.

## Release-blocking defects

### High — candidate offline reload fails after normal worker lifecycle changes

The candidate's hand-written `public/sw.js` does not precache the generated
Vite JavaScript or CSS. It tries to learn loaded resource URLs later through a
`CACHE_URLS` message and matches cached responses without `ignoreVary`. This is
not reliable across reloads and worker replacement.

Fresh evidence from the exact candidate build at 390×844:

1. A clean context installed the worker and showed the app offline once, but
   after returning online and performing another controlled reload, the next
   offline reload produced `net::ERR_FAILED` and no application `<h1>`.
2. A second clean run failed on the first offline reload after installation,
   again with `net::ERR_FAILED` and no `<h1>`. Thus this is reproducible but
   timing-dependent; the repository's single happy-path offline test passed.
3. In a controlled worker-update simulation, the app correctly displayed
   “Updated app ready. Reload,” but the new cache contained `/`, legal pages,
   artwork, and icons—not `/assets/index-DTBFq3MQ.js` or
   `/assets/index-DTXWj9UD.css`. Reloading offline then failed with two resource
   errors and no app shell.

This breaks the brief's defining offline-PWA requirement. The later worker now
served live has a generated 20-entry precache and variance-tolerant matching;
the same install/reload/offline sequence passed twice on the live origin.

### High — live deployment is not the candidate

A fresh production build was compared byte-for-byte with the live site. The
HTML, manifest, legal/offline pages, hashed JS/CSS, artwork, icons, robots, and
sitemap all matched, but the service worker did not:

```text
candidate dist/sw.js  SHA-256 456f498c08f5bc6a7435dd561d0883ddeb745668eff0c947cf08115eeec36b7d (1,851 B)
live /sw.js           SHA-256 fac37934aec487ac92d782d8b6916c0a6a1c01414cd7c66e46baf68e22293bcf (1,874 B)
```

The candidate uses `receipt-packet-shell-v1` plus runtime `CACHE_URLS`. The live
worker uses `receipt-packet-shell-53459b7e0439`, a generated precache containing
the hashed build assets, and `ignoreVary`. The live URL is a later repaired
artifact, not commit `bd8b327` as requested.

### Medium — live fingerprinted assets are not cached immutably

Fresh `HEAD` responses at 06:31 UTC:

```text
GET /assets/index-DTBFq3MQ.js
content-type: text/javascript
cache-control: public, must-revalidate, max-age=30
content-length: 36667

GET /assets/index-DTXWj9UD.css
content-type: text/css
cache-control: public, must-revalidate, max-age=30
content-length: 13821
```

These names are content-fingerprinted, so the required policy is a long-lived
`max-age` with `immutable`. The 30-second policy unnecessarily revalidates the
app shell and repeats the earlier deployment-only failure.

### Medium — three mobile links miss the 44×44 CSS-pixel target minimum

At 390×844, browser geometry measured the wordmark link at 160.1×33.9 px,
Privacy at 43.0×19.7 px, and Terms at 35.7×19.7 px. Primary form and workflow
controls met the target size, but these three links do not meet the explicit
mobile interaction contract.

## Non-blocking defects and maintenance

### Low — no-match search incorrectly says the vault is empty

With two saved receipts, searching for `no matching receipt` renders “No
evidence filed yet” and “Add the first original receipt.” The records are still
present. Use a distinct no-results state and a clear-search action.

### Low — response hardening is incomplete

The live site sends HSTS, `Referrer-Policy: strict-origin-when-cross-origin`,
and `X-Content-Type-Options: nosniff`, but no `Content-Security-Policy`,
`Permissions-Policy`, or frame restriction. No exploit was demonstrated; this
is defense in depth for a site handling private receipt data.

### Maintenance — development dependencies have known advisories

`npm audit --omit=dev --json` reports zero production vulnerabilities. The
full development-tree audit reports one high Vite finding and one critical
Vitest finding. Non-major fixes are available (`vite` 7.3.6 and `vitest`
3.2.7); neither package is shipped in `dist/`.

## Clean-checkout quality gates

The candidate was tested from a separate detached, clean worktree. It remained
clean after verification.

| Check | Fresh result |
| --- | --- |
| `npm ci` | Passed; 61 packages installed from lockfile. |
| `npm test` | Passed: 5/5 Vitest tests, production type/build, 2/2 Playwright 1.58.2 Chromium tests. |
| Exact production build: `npm run build` | Passed independently; `tsc --noEmit` and Vite 7.1.3 completed; `dist/index.html` exists. |
| Lint/type checks | No lint script exists. TypeScript check is part of the build and passed. |
| Production audit | 0 vulnerabilities. |
| Required docs | README, MIT LICENSE, design thesis, handoff, privacy, and terms are present. |

Build output is 36,667 B JavaScript (12.34 KB gzip), 13,821 B CSS (3.82 KB
gzip), no fonts, and 14,718 B for the mobile hero WebP. This is well inside the
200 KB JS, 50 KB CSS, 120 KB font, and 300 KB hero budgets.

Fresh Lighthouse 13.0.1 mobile audits using the supplied Chromium:

| Target | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Candidate production preview | 100 | 100 | 100 | 100 | 1.2 s | 0 ms | 0 |
| Live production origin | 100 | 100 | 100 | 100 | 1.1 s | 60 ms | 0 |

## End-to-end product evidence

The full flow was independently exercised against both the candidate preview
and live origin on 1440×900 desktop, plus locked/mobile coverage at 390×844:

- Created a vault after validating short and mismatched passphrases; refreshed,
  confirmed the vault relocked, recovered from a wrong passphrase, and unlocked
  the persisted records.
- Rejected a text file and an image over 15 MB with actionable messages.
- Saved the minimum $0.01 and maximum $99,999,999.00 values; the value one cent
  above the maximum was blocked by native form validation.
- Searched, viewed an original, edited metadata while preserving its SHA-256,
  filtered a period to one record, cancelled deletion, and confirmed deletion.
- Exported and tested the ZIP successfully. It contained `index.pdf`,
  `index.csv`, `README.txt`, and `originals/001-receipt-one.png`. The original,
  CSV, and PDF all contained the same SHA-256:
  `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`.
- Downloaded an encrypted JSON backup. It contained neither passphrase nor
  plaintext merchant/note. An invalid backup produced a recoverable error; a
  clean live context then restored the valid backup and unlocked both records.
- IndexedDB inspection showed only config plus encrypted metadata/original
  `ArrayBuffer` ciphertext. The passphrase was absent from local storage.
- Privacy and terms returned 200. The normal workflow made no requests outside
  the product origin (apart from local `blob:` URLs). The only source-declared
  external service is the Sociobot billing API. A read-only invalid-license
  check returned `{valid:false, reason:"invalid"}` with correct production-origin
  CORS and `Cache-Control: no-store`.

## Accessibility, browser, and PWA evidence

- axe reported zero serious/critical findings on locked desktop, populated
  workspace, and 390 px mobile views on both preview and live.
- Keyboard Tab first reached the visibly focused skip link. Enter targeted
  `#main`; the next Tab entered the main form. Dialog focus entered the receipt
  form/viewer, and all tested controls operated by keyboard.
- Reduced-motion emulation reduced transition duration to effectively zero.
  The 390 px layout had no horizontal overflow.
- No console errors, uncaught page errors, or online request failures occurred
  in either complete product flow.
- Chromium reported zero manifest parse/installability errors; the 192, 512,
  and maskable icons, standalone display, scope, theme, and versioned start URL
  were recognized.
- Live offline reload passed repeatedly with the later deployed worker. The
  exact candidate worker failed as described above.

## Reproduction summary

```sh
git worktree add --detach /tmp/receipt-qa bd8b32719d856fb8704923b42ce7f836d027ed52
cd /tmp/receipt-qa
npm ci
npm test
npm run build
npm audit --omit=dev --json
npm audit --json
npm run preview -- --port 4173
```

After fixing the candidate worker and deploying that exact build, recheck cold
install, multiple online/offline reload cycles, a real worker update, live
SHA-256 identity, and immutable response caching.
