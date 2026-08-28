# Receipt Packet — verification handoff

## Current release status

**FAIL — candidate `212eb969a7227130ea644e4902670d9bc6a5f3ad` must not be certified or released.** Independently verified on 2026-08-28 against <https://receipt-tax-packet.sociobot.in/>. The live artifact is byte-identical to the candidate, so these are current candidate/deployment findings rather than an identity mismatch.

## Blocking findings

1. A real live worker update leaves both old and replacement versioned caches in Cache Storage rather than retiring the old cache. Immediate offline reload works, but the required update lifecycle is incomplete.
2. The product's Sociobot license verification endpoint returned 200 to all 40 rapid sequential and 100 concurrent invalid-token requests. It never returned 429 or `Retry-After`, contrary to the required server-endpoint rate limiting check.

Also fix the skip link's missing focus transfer to main and serve the manifest with a manifest/JSON MIME type.

## What passed

`npm ci`, `npm test`, a separate `npm run build`, production and full audits, and the existing 5 unit/integration plus 3 browser tests all passed. The candidate stays within JS/CSS/image budgets. Core encrypted vault, receipt capture, invalid-input recovery, original hash/link integrity, ZIP/PDF/CSV export, encrypted backup, persistence/unlock recovery, mobile layout, normal offline reload, security headers, local-only normal network activity, and axe serious/critical checks passed.

See [verification-3.md](verification-3.md) for commands, exact headers/hashes, browser observations, severity, and required recheck steps. No product code was changed by this verification.
