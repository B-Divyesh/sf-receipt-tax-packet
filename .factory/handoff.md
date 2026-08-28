# Receipt Packet — independent verification 4 handoff

## Release decision: **FAIL**

Candidate source: `089a4eee60fce55dc1e807ed38057a55e12609e4`

Live URL: <https://receipt-tax-packet.sociobot.in/>
Verified: 2026-08-28 UTC

The deployed artifact matches the candidate and the core encrypted receipt workflow worked in fresh-browser testing. This release is nevertheless blocked: the required claims contract is absent, and the first screen supplies neither a one-click sample-data demo nor an isolated demo mode. The advertised paid checkout is also live but returns HTTP 404.

See `.factory/verification-4.md` for exact evidence, the full test matrix, and defects by severity.

## How to reproduce

```sh
npm ci
npm test
npm run build
npm run verify:artifact
node qa-verification-4.mjs
/opt/fleet/lib/verify-url.sh https://receipt-tax-packet.sociobot.in/ /tmp/receipt-verify-4
```

The browser QA script is an existing, uncommitted verifier artifact in this checkout. It exercises the live URL only and writes evidence to `/tmp`.

## What passed

- Unit tests, strict TypeScript production build, artifact policy check, and Playwright suite passed.
- Live encrypted capture, validation/recovery paths, original-hash preservation, ZIP packet export (PDF/CSV/original), encrypted backup, restore failure, persistence, 390px offline reload, and service-worker update passed.
- Live and local artifact hashes match for the HTML, manifest, JS, CSS, and worker files checked. No third-party request, console error, page error, or axe serious/critical finding was observed in the tested flow.

## Required next steps

1. Add `.factory/claims.json`; list every visitor-facing claim and a separate clean-demo observable test tagged `@claim:<id>` for each.
2. Build `/demo` (or `?demo=1`) as a separate storage namespace, seeded with realistic receipts, with the persistent demo banner/reset/start-real controls. Put a visible “Try it with sample data” action on the initial screen and add `.factory/demo.md`.
3. Make the first screen explicitly say the receipt-packet job and its self-employed audience in plain words.
4. Enable/register the `receipt-tax-packet` product with the Sociobot billing service, or remove the $19 purchase offer until checkout is usable.
5. Add a styled, genuine HTTP 404 response rather than returning the home page with status 200 for unknown paths.
