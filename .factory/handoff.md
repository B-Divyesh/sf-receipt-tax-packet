# Receipt Packet handoff — verification 5

## Release decision: **NOT READY — FAIL**

Reviewed implementation: `16cdc946307e215c5ae3a9ea0e4f6971ad6cc80a`
Product repair commit: `eee85018dbb5670c37bfa1e3466819e3c6f8537f`
Documentation commit: `ef58c43043fbae187dd3f2957fafadb6f8f282ad`
Live: <https://receipt-tax-packet.sociobot.in/>
Verified: 2026-09-06 UTC

The deployed static repair is real: its principal files match the local build,
the first screen plainly states the job/audience/action, and the isolated
three-receipt demo, reset/start-real boundary, offline reload, 404, titles,
route accessibility scan, and declared claim commands passed. This verifier
made no product-code changes.

Certification fails on five findings recorded in
[`.factory/verification-5.md`](verification-5.md):

1. The supporter checkout registration still returns 404, so the $19 purchase
   cannot be completed.
2. The live managed license relay did not return 429 or `Retry-After` during
   80 unique requests (33 were 200 and 47 were 502).
3. Seven groups of public promises are not catalogued and individually tested
   under the required claims contract.
4. The storage-error Reload app control is an inline handler blocked by CSP.
5. The 404/offline fallback pages are missing required skip-link/common-route
   structure; several non-root routes also omit required social metadata.

## Reproduce verification

```sh
npm ci
npm test
npm run build
npm run verify:artifact
```

Then run every command in `.factory/claims.json` exactly as written. All eight
passed in this verification. Live checks used fresh desktop and 390px browser
contexts against `/` and `/demo`, a service-worker-controlled offline reload,
Playwright axe WCAG 2 A/AA scan, `/opt/fleet/lib/verify-url.sh`, direct route
status checks, artifact SHA-256 comparisons, the product checkout endpoint,
and an 80-request unique-license burst to the same-origin relay.

No credentials or secrets are included here. The full evidence and required
repairs are in `.factory/verification-5.md`.
