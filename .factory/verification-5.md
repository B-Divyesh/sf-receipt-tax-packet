# Independent repair verification 5 — Receipt Packet

## Result: **CONDITIONAL FAIL**

Implementation deployed: `16cdc946307e215c5ae3a9ea0e4f6971ad6cc80a`
Product code repair: `eee85018dbb5670c37bfa1e3466819e3c6f8537f`
Live: <https://receipt-tax-packet.sociobot.in/>
Date: 2026-09-06 UTC

All verification-4 product-surface failures are repaired. Certification remains
blocked by the external billing registration and by an observed failure of the
managed API’s process-local rate limiter after deployment.

## Fixed findings

- `.factory/claims.json` now lists eight claims, each with exactly one clean
  `@claim:` Playwright test. Every documented command passed individually.
- Landing page provides a one-click **Try it with sample data** action. `/demo`
  and `?demo=1` load three named example expenses immediately, show the
  persistent sample-data banner, reset to the seed, and discard demo data when
  starting for real. Browser tests demonstrate that the real vault stays empty.
- The first-read title/h1/sentence/action use plain job and audience language.
- The site no longer advertises a checkout known to return 404. It preserves
  the $19 gated feature, terms, restore path, and public billing metadata while
  saying registration is pending.
- Unknown routes now produce the styled `404.html` with HTTP 404.
- `.factory/demo.md`, `.factory/copy-audit.md`, catalog description, social
  metadata, and a derived 1200×630 social image are present.

## Passing checks

- Clean `npm ci`, `npm test`, `npm run build`, `npm run verify:artifact`, and
  production dependency audit passed. The full browser suite is 11/11.
- Fresh desktop and 390px live browser contexts passed the demo, reset,
  start-real, direct query demo, same-origin request, offline reload, no-error,
  overflow, and axe serious/critical checks.
- `verify-url.sh` passed against the live root. Production hashes for HTML,
  privacy, manifest, and worker equal the local `dist/` artifact.
- The live dynamic asset cache, worker cache policy, manifest MIME, security
  headers, and 404 response were inspected and pass.

## Remaining blockers

1. `https://api.sociobot.in/api/v1/products/receipt-tax-packet/checkout`
   remains unregistered and returns 404. This is an external controller task;
   the UI does not link visitors to it. The required registration data is
   `/work/.evidence/billing-offer.json`.
2. A current burst of 80 unique invalid-license calls to the deployed
   same-origin API did not yield a 429 or `Retry-After`. Follow-up probes each
   returned remaining `19`, showing the in-memory bucket is not shared across
   current managed invocations. This must be resolved with durable API-host
   rate limiting before release certification.

No credentials were recorded.
