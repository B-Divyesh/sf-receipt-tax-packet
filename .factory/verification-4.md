# Independent verification 4 — Receipt Packet

## Decision

**FAIL — release-blocking acceptance requirements are not met.**

- Candidate: `089a4eee60fce55dc1e807ed38057a55e12609e4`
- Live: <https://receipt-tax-packet.sociobot.in/>
- Date: 2026-08-28 UTC
- Scope: independent clean-install source QA and fresh-context production QA; no product code was modified.

The live deployment does match the candidate for the files checked:

| Path | SHA-256 |
| --- | --- |
| `/` / `dist/index.html` | `2dfd4e932b72cb3a05bcfaeebb0dca567577c880671dbc04bc8b1664cbc0d18e` |
| `/manifest.webmanifest` / `dist/manifest.webmanifest` | `bbb96153eda2a6ecb429ea751fcb2ee0451988bb73095253162eb2dd7a18e1a5` |
| `/assets/index-DCmCvUNy.js` / built JS | `766aee3bc88031bf9d58d685b42b44a7651f6157e27966ef7821cb8c68212080` |
| built CSS | `2f636a586f2b7753d2f4c8cd6ab1d497d317d37c984bcc5f5dca817bf8071a34` |
| built worker | `d321ca610f2eef6702c1e7d29f66edca5871319964bec37c643aa49d28dea1a7` |

## Mandatory claims and first-read gate — FAIL

Before other tests, I inspected `.factory/claims.json` from the checkout. **It does not exist.** There were consequently no listed commands to run and no `@claim:` tags anywhere in the test corpus. Under the claims contract this alone is release-blocking. It also leaves live claims such as “Local only,” “Ready offline,” local encryption, and ZIP/PDF/CSV export unlisted and without the required individually tagged clean-demo tests.

Cold production read in a new desktop browser context:

- Title: `Receipt Packet — evidence for every expense`
- H1: `Every claim keeps its proof.`
- Supporting sentence: `Build an accountant-ready packet from original receipt images—without bank access, OCR, or a subscription.`
- Only button: `Create encrypted vault`
- Exact visible `Try it with sample data` actions: **0**

The first screen does not plainly state the self-employed audience, uses a metaphor rather than the job as its headline, and does not tell a cold visitor to try a sample. More decisively, the mandatory sample action is absent.

Direct demo checks also failed: `/?demo=1` renders the ordinary locked vault; it has zero sample actions and zero `Demo — sample data, nothing is saved` banners. There is no `.factory/demo.md`, no sample storage namespace, reset, or start-real control. This is both a first-read and demo-sandbox release blocker.

## Defects

| Severity | Finding | Evidence / impact |
| --- | --- | --- |
| **Blocker** | No `.factory/claims.json`, no claim-tagged tests. | Required precondition missing. Visitor-facing offline, local-only, encryption, and export promises cannot meet the claims-test contract. |
| **Blocker** | No one-click sample-data demo or isolated demo mode. | Initial screen has 0 sample actions; `/?demo=1` is the real empty vault, with no banner/sample/reset/start-real. A new user must create real encrypted storage before trying the product. |
| **Blocker** | First-read acceptance fails. | H1 is `Every claim keeps its proof.`, which is not the job in plain words; it does not name the self-employed audience; there is no required demo action. |
| **High** | Advertised $19 “Buy supporter unlock” checkout is broken. | `GET https://api.sociobot.in/api/v1/products/receipt-tax-packet/checkout` returned `404` and `{"error":"enabled factory product","status":404}` on 2026-08-28. The live paid feature cannot be purchased. |
| **Medium** | Unknown routes are not a real 404. | `HEAD /does-not-exist` returned HTTP 200 and the 946-byte app home document. The static config uses a blanket navigation fallback and supplies no designed 404 route. |
| **Medium** | Required demo/copy evidence documents are absent. | `.factory/demo.md` and `.factory/copy-audit.md` are absent. The latter is the prescribed proof that first-screen copy was audited. |

## Clean source verification — PASS

At candidate `089a4ee`:

```text
npm ci                              PASS (61 packages; audit: 0 vulnerabilities)
npm run test:unit                   PASS (3 files, 6 tests)
npm run build                       PASS (tsc --noEmit; Vite produced dist/)
npm run verify:artifact             PASS
npm run test:e2e                    PASS (3/3 Chromium tests)
npm test                            PASS (the full chain above)
```

No lint script exists. Strict TypeScript checking is included in `npm run build`. Consumer package testing is not applicable to this PWA.

Built budgets are within the stated static-PWA limits: JS 37,073 B raw / 12.42 kB gzip (≤200 kB), CSS 13,930 B / 3.84 kB gzip (≤50 kB), mobile hero 14,718 B (≤300 kB), and no font payload. The worker/artifact verifier confirmed two hashed precached assets plus immutable asset and worker/security policy checks.

## End-to-end browser QA — PASS except stated defects

The existing `qa-verification-4.mjs` live-only verifier was run in fresh Chromium contexts. It produced `/tmp/verification-4-browser-results.json`, screenshots under `/tmp/verification-4-*.png`, and an exported packet at `/tmp/verification-4-packet.zip`.

Passed representative normal, boundary, invalid, and recovery paths:

- Created the AES-GCM encrypted vault; short passphrase and mismatch errors were shown and recoverable.
- Rejected a non-image and an image over 15 MB. Saved a valid 1×1 PNG at the minimum `$0.01` and a `$99,999,999.00` USD value; the `$99,999,999.01` aggregate displayed correctly.
- Search no-results state, clear-search focus return, viewer dialog, unchanged 64-hex SHA-256 after editing receipt metadata, wrong passphrase recovery, and invalid-backup recovery all passed.
- Exported `receipt-packet-2026-12-01-2026-12-31.zip`: it contains `index.pdf`, `index.csv`, `README.txt`, and `originals/001-maximum.png`. CSV includes the selected record and original SHA-256.
- Encrypted-backup JSON did not contain the test merchant or claim note; IndexedDB receipt rows did not expose either plaintext value. Data persisted across lock/reload and correct unlock.
- Normal live flow made same-origin requests only; it made no third-party, tracking, CDN-font, or receipt-upload request. No console or page errors.

## PWA, mobile, keyboard, accessibility — PASS

- 390×844 reduced-motion browser: zero horizontal overflow; wordmark, Privacy, and Terms targets measured at least 44 px high; reduced-motion button transition was `1e-05s`.
- After service-worker control, two offline reloads showed the cached app and `Offline — capture and export still work`, with no console/page errors.
- Registered a replacement `sw.js?revision=verification-4`; after offline Reload, exactly one `receipt-packet-shell-*` cache remained, controlled by the revision worker, and the app H1 rendered.
- Keyboard: Skip to main content was first, had a visible `rgb(21, 87, 255)` 3px outline, and Enter moved DOM focus to `main#main`.
- Playwright axe: zero serious/critical findings on locked desktop, populated desktop, locked 390px mobile, privacy, terms, and offline pages.
- `/opt/fleet/lib/verify-url.sh` returned 200 in 668 ms with title, `lang=en`, one H1, a main landmark, zero missing image alt values, zero unlabeled buttons, and zero reported page errors. Standalone Lighthouse was not installed in this verifier image; axe and the factory URL audit were run.

## Live policies, rate limiting, and routing

- Headers on HTML, JS, worker, and manifest include HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options `nosniff`, Referrer-Policy, and Permissions-Policy. Hashed JS is `public, max-age=31536000, immutable`; worker is `no-cache, no-store, must-revalidate`; manifest is served as `application/json`.
- Rate-limit test against same-origin `/api/license/verify?license=<invalid>`: a sequential 30-request burst initially returned 200. Continuing immediately, the first 429 occurred on request 11 of the second run — **41 requests total in the observed burst** — with numeric `Retry-After: 50` and `X-RateLimit-Remaining: 0`. Subsequent requests returned 429. The endpoint thus satisfies the required observable 429/Retry-After behavior, although the initial remaining counter varied in pairs, consistent with more than one warm instance.
- `/privacy/`, `/terms/`, `/offline.html`, `robots.txt`, and `sitemap.xml` returned 200. The initial navigation links are usable. The unknown route behavior is the medium finding above.

## Required remediation and re-verification

1. Create claims and demo contracts first; do not rely on existing workflow tests as substitutes. Every claim needs its own `@claim:` test running from `/demo`/`?demo=1` in a clean state.
2. Add and manually cold-read the visible sample action and persistent isolated demo UI at 390px and desktop.
3. Either enable the Sociobot product checkout or remove the paid purchase control and its purchase promise.
4. Add a true 404 response/page and rerun all commands and fresh-live checks.
