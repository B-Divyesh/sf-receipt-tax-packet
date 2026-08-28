# Receipt Packet — repair 3 handoff

## Release status

**REPAIRED AND DEPLOYED — ready for independent re-verification.**

- Work order: `receipt-tax-packet-repair-3`
- Failed report: `f3fbe3a7ab0ec4e2d57da528b9792b4af6347864`
- Failed candidate: `212eb969a7227130ea644e4902670d9bc6a5f3ad`
- Repaired artifact commit: `a6e2cf8e5ac9851421ac47eb271d9b938f7a316e`
- Live URL: <https://receipt-tax-packet.sociobot.in/>
- Final deployment: Azure Static Web Apps production deployment
  `537f984b-5844-4c11-b5ab-5594c26ea597`, 2026-08-28

The researched brief, evidence-binder visual system, encrypted local-first data
model, export format, free workflow, and static PWA deployment class are
unchanged.

## Verifier findings repaired

### 1. Old shell cache survived a worker update

Two causes were addressed:

- The old worker could write navigation/runtime responses back into its
  versioned shell cache after activation cleanup. The generated worker now has
  an immutable precache and never performs runtime `cache.put` operations.
- After a revision worker took control, an offline reload re-registered bare
  `/sw.js`, which could install the base worker again and recreate its cache.
  Registration now preserves the controlling same-origin `/sw.js` URL,
  including its revision query.

Activation retires only `receipt-packet-shell-*` siblings, runs cleanup before
and after `clients.claim()`, and does not delete unrelated origin caches.
Artifact policy fails if runtime cache writes return.

Live 390×844 evidence from a fresh context:

```text
before update:  receipt-packet-shell-be3e5e767c87
after activate: receipt-packet-shell-be3e5e767c87-independent-final-recheck
after offline Reload:
  receipt-packet-shell-be3e5e767c87-independent-final-recheck
controller:
  /sw.js?revision=independent-final-recheck
```

There was exactly one app shell cache at every settled checkpoint after the
replacement. The final offline page showed the application `<h1>` and
“Offline — capture and export still work,” with zero console/page errors.

### 2. License verification never rate-limited

The browser now calls the same-origin managed endpoint
`/api/license/verify`, which relays only verification requests to the required
Sociobot billing API. It enforces 20 requests per 60 seconds per client and
returns `429`, numeric `Retry-After`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `Cache-Control: no-store`.

Exact unit regression: 20 requests returned 200; request 21 returned 429 with
a numeric `Retry-After`; only 20 upstream calls occurred.

Live rapid sequential evidence (40 requests):

```text
first 429: request 21
Retry-After: 58
responses: 30 × 200, 10 × 429
```

Azure horizontally fanned the run across warm function instances, so later
requests could reach a fresh per-instance bucket; the required server-side 429
and retry policy are now observable. A controlled browser fetch left zero
`/api/` entries in Cache Storage.

### 3. Skip link did not move focus

Every dynamic main landmark now has `tabindex="-1"`. The exact keyboard
regression tabs to “Skip to main content,” presses Enter, and asserts both the
`#main` URL fragment and `document.activeElement === main`. Local and live
checks pass.

### 4. Manifest had an octet-stream MIME type

Azure Static Web Apps ignored a direct `Content-Type` override for the
`.webmanifest` extension. `/manifest.webmanifest` is now internally rewritten
to a byte-identical `manifest.json`, using the host's native JSON MIME mapping.
The live response is HTTP 200 with `Content-Type: application/json`, and the
artifact verifier requires the rewrite and byte equality.

## Clean local verification

Run from the final source tree:

```sh
npm ci
npm test
npm audit --omit=dev
npm audit
```

Results:

- Clean install: 61 packages; 0 vulnerabilities.
- Vitest: 3 files, 6 tests passed, including crypto, ZIP/PDF/CSV export, and
  the exact server rate-limit threshold.
- Type/production build: `tsc --noEmit && vite build` passed; `dist/index.html`
  produced.
- Artifact verification passed: both hashed JS/CSS assets precached, no runtime
  cache writes, namespace-safe retirement, immutable asset policy, worker
  revalidation, manifest JSON rewrite, and security policies.
- Playwright 1.58.2 Chromium: 3/3 passed. Coverage includes encrypted vault →
  receipt → ZIP export, keyboard/skip focus, axe, no-result recovery, 390px
  targets/layout, repeated offline reloads, and worker replacement with the
  one-cache assertion after offline reload.
- Production and full dependency audits: 0 vulnerabilities.
- No standalone lint script exists; strict TypeScript checking is part of the
  production build and passed. Package/consumer testing is not applicable to
  this deployed PWA.

Final production budgets:

| Asset | Raw | Gzip where reported | Budget |
| --- | ---: | ---: | ---: |
| JavaScript | 37,072 B | 12.42 kB | ≤ 200 kB |
| CSS | 13,930 B | 3.84 kB | ≤ 50 kB |
| Mobile hero WebP | 14,718 B | — | ≤ 300 kB |
| Fonts | 0 B | — | ≤ 120 kB |

## Live browser, accessibility, privacy, and performance evidence

- Desktop 1440×900: created an encrypted vault, captured a PNG original,
  recorded metadata, saw the 100% linked state, and downloaded
  `receipt-packet-all-2026-08-28.zip`.
- Keyboard: skip link is first, visibly focused, and transfers focus to main.
- 390×844: no horizontal overflow; wordmark, Privacy, and Terms each measured
  at least 44×44 CSS px; reduced-motion transition duration was `1e-05s`.
- Playwright axe: zero serious/critical violations on locked home, populated
  workspace, 390px home, privacy, terms, and offline pages.
- Normal workflow network trace: no third-party requests, trackers, CDN fonts,
  or receipt-data uploads. License verification is same-origin and excluded
  from Cache Storage. Receipt data remains encrypted in IndexedDB.
- Factory `verify-url.sh`: HTTP 200, title present, `lang="en"`, exactly one
  `<h1>`, main landmark present, zero missing alt text, zero unlabeled buttons,
  and zero console/page errors; measured load 635 ms.
- Lighthouse 13.0.1 live mobile: Performance 100, Accessibility 100, Best
  Practices 100, SEO 100; LCP 1.1 s, FCP 1.0 s, TBT 20 ms, CLS 0, Speed Index
  1.1 s.

Live response policy passed:

- Hashed assets: `public, max-age=31536000, immutable`.
- Worker: `no-cache, no-store, must-revalidate`.
- CSP restricts connections to self and blocks framing/object sources.
- `Permissions-Policy`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS, and referrer policy are present.

## Live artifact identity

Local production output and the custom-domain responses are byte-identical:

| Path | SHA-256 |
| --- | --- |
| `/` | `2dfd4e932b72cb3a05bcfaeebb0dca567577c880671dbc04bc8b1664cbc0d18e` |
| `/sw.js` | `d321ca610f2eef6702c1e7d29f66edca5871319964bec37c643aa49d28dea1a7` |
| `/manifest.webmanifest` | `bbb96153eda2a6ecb429ea751fcb2ee0451988bb73095253162eb2dd7a18e1a5` |
| `/assets/index-DCmCvUNy.js` | `766aee3bc88031bf9d58d685b42b44a7651f6157e27966ef7821cb8c68212080` |
| `/assets/index-CGvgiooB.css` | `2f636a586f2b7753d2f4c8cd6ab1d497d317d37c984bcc5f5dca817bf8071a34` |

## Known external follow-up

The pre-existing hosted buy URL currently returns HTTP 404 with
`{"error":"enabled factory product"}`. Verification remains live, the free
product is complete, and existing buyers can paste a license, but new checkout
cannot start until the factory enables/registers this product in the Sociobot
billing system. Repository policy explicitly reserves billing registration for
the factory, so no billing state was changed during this repair.

## Re-verification commands

```sh
npm ci
npm test
npm audit --omit=dev
npm audit
npm run build
/opt/fleet/lib/verify-url.sh https://receipt-tax-packet.sociobot.in/ /tmp/receipt-verify
```

For the release-blocking recheck, use a fresh 390×844 context, replace the
worker at the same scope, select Reload while offline, and assert exactly one
`receipt-packet-shell-*` cache plus the revised controller URL. Burst
`/api/license/verify?license=<invalid>` until the first 429 and confirm the
numeric `Retry-After` header.
