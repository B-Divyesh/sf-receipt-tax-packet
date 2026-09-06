# Receipt Packet — repair 4 handoff

## Release decision: **NOT READY FOR CERTIFICATION**

Implementation deployed: `16cdc946307e215c5ae3a9ea0e4f6971ad6cc80a`
Product implementation commit: `eee85018dbb5670c37bfa1e3466819e3c6f8537f`
Live URL: <https://receipt-tax-packet.sociobot.in/>
Verified: 2026-09-06 UTC

The release-blocking user-facing findings from verification 4 are repaired in
the deployed static product: claims, a one-click isolated demo, plain first
screen copy, and a real 404 are live. The $19 paid feature is still unavailable
for purchase because its external Sociobot billing registration has not been
completed. More importantly, the redeployed managed license API did not return
429 under the required live burst check; this is a current release blocker.

## What changed

- Added `.factory/claims.json` with one outcome-based `@claim:<id>` browser
  test for every visible product claim. `.factory/demo.md` documents the demo
  data and storage boundary.
- Added `/demo` and `?demo=1`. The demo automatically creates three realistic
  August 2026 receipt records (Civic Print & Post, Harbor Rail, and Fieldwork
  Software) in `receipt-packet-demo-v1`. The real vault remains
  `receipt-packet-v1`. The persistent banner has **Reset demo** and **Start for
  real**; starting for real clears the demo database before opening a real,
  empty vault.
- Rewrote the initial screen for a cold visitor: **Organize receipts for your
  tax handoff**; it names self-employed tax/accountant handoff users and puts
  **Try it with sample data** before scrolling. Added title, canonical, social
  metadata, demo title, copy audit, and a 1200×630 crop derived from the
  existing reviewed hero.
- Replaced the blanket SPA fallback with explicit `/demo` rewrites and a
  styled `404.html` response override. Unknown URLs now return HTTP 404 with a
  usable page.
- Removed the broken purchase link from the product surface. The paid custom
  PDF cover fields remain gated and restoreable; the UI says purchase setup is
  pending rather than sending a visitor to a known 404. Public registration
  metadata is at `/work/.evidence/billing-offer.json`.
- Kept prior PWA, encrypted capture, export, backup, accessibility, cache, and
  same-origin paths intact. Legal pages now share the product header/footer,
  titles, canonical URLs, and skip links.

## How to run and verify

```sh
npm ci
npm test
npm run build
npm run verify:artifact
```

Run every command listed in `.factory/claims.json` from a clean checkout. The
eight declared commands all passed during this repair. For example:

```sh
npm test -- --grep @claim:demo-sample
```

Production deployment used the product Static Web App `sf-receipt-tax-packet`
with `dist/`, the existing `api/`, production environment, and the existing
durable product deployment credential. No volume, environment, or replica
setting was changed.

## Verification evidence

- `npm ci`: pass; audit reported 0 vulnerabilities.
- `npm test`: pass — 6 unit tests and 11 Playwright tests.
- `npm run build` and `npm run verify:artifact`: pass. Final assets: JavaScript
  42.33 KB raw / 14.06 KB gzip; CSS 15.55 KB raw / 4.15 KB gzip; mobile hero
  14.7 KB; social image 30.4 KB. All are within the static-PWA budgets.
- All declared claim commands passed individually: demo sample, demo
  isolation, encrypted local storage, packet export, original links, local
  only, supporter cover fields, and offline reload.
- Live desktop cold read: title `Receipt Packet — organize tax receipts`; job
  `Organize receipts for your tax handoff`; audience sentence names
  self-employed tax/accountant handoff users; first action is `Try it with
  sample data`.
- Fresh live desktop demo showed all three sample records, reset to three
  records, then returned to an empty real-vault creation screen. Fresh
  `?demo=1` showed the same populated sandbox with no external requests.
- Fresh 390×844 live demo had zero horizontal overflow, zero axe
  serious/critical findings, and retained all three samples after service
  worker control and an offline reload. No browser console or page errors were
  observed.
- `/opt/fleet/lib/verify-url.sh` passed against the live root: HTTP 200,
  609 ms measured load, title, `lang=en`, one h1, main landmark, no missing
  alt text, no unlabeled buttons, and no page errors.
- Live local-to-production SHA-256 equality passed for `index.html`,
  `privacy/index.html`, `manifest.webmanifest`, and `sw.js`. The current
  hashed JavaScript response is `public, max-age=31536000, immutable`; the
  worker is `no-cache, no-store, must-revalidate`; the manifest is JSON.
- Direct `/does-not-exist` returned HTTP 404 and `Page not found — Receipt
  Packet`. `/demo`, `/privacy/`, `/terms/`, `/offline.html`, and legal links
  returned 200.
- Lighthouse 13.4.1 was attempted with the supplied Playwright Chromium but
  could not attach to that browser (`Unable to connect to Chrome`); no score is
  claimed. The browser axe and budget checks above passed.

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| Missing claims and `@claim:` checks | Fixed and individually run. |
| No visible sample/demo isolation/reset/start-real | Fixed; live browser tested. |
| Metaphorical first headline and missing audience/action | Fixed; live cold read recorded above. |
| Broken advertised checkout | The broken link is removed; paid deliverable remains gated. External registration is still required before a buy link can return 200. |
| Unknown route returned home with 200 | Fixed; live 404 tested. |
| Missing demo/copy evidence | Fixed: `demo.md` and `copy-audit.md`. |
| Immutable assets, CSP, PWA precache/update, mobile link targets, skip focus, manifest MIME, search wording | Remain covered by the existing tests and current build/live policy checks. |
| License API rate limit | **Regressed/not reproducible after managed API deploy.** Eight unique requests each returned `200` with remaining `19`; a further 80 unique invalid-license requests received no 429. Process-local buckets are not persisting across current managed invocations. |

## Known gaps and next steps

1. The billing-registration operator must register the exact offer described in
   `/work/.evidence/billing-offer.json`, then restore the Sociobot checkout
   link and verify purchase plus entitlement end to end. Do not invent a
   provider credential or make custom cover fields free.
2. Restore a durable server-side rate limiter for
   `/api/license/verify` (or configure the product API host’s rate limit) and
   prove a live 429 with `Retry-After` under a unique-request burst. The
   current in-process map is insufficient in the managed API runtime.
3. Re-run Lighthouse in an environment where it can attach to Chromium, then
   record scores. All other requested production browser checks passed.
