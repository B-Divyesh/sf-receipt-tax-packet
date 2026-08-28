# Independent verification 3 — FAIL

**Verified:** 2026-08-28 07:37 UTC  
**Candidate:** `212eb969a7227130ea644e4902670d9bc6a5f3ad`  
**Live URL:** <https://receipt-tax-packet.sociobot.in/>  
**Verdict:** **FAIL — do not certify this candidate.** The local application and deployed artifact are otherwise substantially functional, but the live PWA does not retire the prior cache on a worker update and the product's server-side license-verification endpoint has no observed rate limiting. Both violate explicit acceptance requirements.

## Release-blocking defects

### High — live worker update retains the old cache

At 390×844 in a fresh Chromium context, the normal live worker was installed, the app was reloaded, and then a replacement worker was registered at the same scope. The in-app `Updated app ready.` notice appeared and an offline reload after selecting Reload succeeded. However, after activation settled, Cache Storage still contained both:

```text
receipt-packet-shell-79d4963933ea
receipt-packet-shell-79d4963933ea-independent-qa2
```

Both contained the full shell. The worker's stated lifecycle requires old caches to be retired; the repository regression test expects one cache, but the live deployment retained two. Repeated real updates will accumulate shell caches and can retain stale private-app resources. This is a deployment/runtime failure of the required PWA update path, even though the immediate offline reload passed.

### High — billing verification endpoint did not return 429 under a burst

The product includes the documented Sociobot license verification endpoint:

```text
GET https://api.sociobot.in/api/v1/products/receipt-tax-packet/verify?license=…
```

An invalid-token request returned `200` with `{"valid":false,"reason":"invalid"}` and `Cache-Control: no-store`. A 40-request rapid sequential check returned 40 × `200`; a separate 100-request concurrent check returned 100 × `200`. There were no `429` responses and no `Retry-After` header, so no threshold can be recorded. The work order requires a server-side endpoint to begin returning `429` with `Retry-After` under a rapid burst.

## Additional findings

### Medium — skip link does not transfer keyboard focus into main

Tab reaches the visible skip link first and Enter changes the URL to `#main`, but the `<main id="main">` element is not focusable. Fresh browser evidence after activation was `active=BODY; mainFocused=false`. Give the main landmark a temporary or permanent `tabindex="-1"` and focus it when the link is used, so keyboard and assistive-technology users arrive at the skipped-to content.

### Low — manifest is served as `application/octet-stream`

`/manifest.webmanifest` returns HTTP 200 but `content-type: application/octet-stream`. Serve it as `application/manifest+json` (or `application/json`) for standards-aligned PWA delivery. Chromium produced no manifest console error in this check.

## Clean-checkout quality gates

The checkout began clean at the requested candidate and remained clean except for this verifier's factory documentation. No product code was modified.

| Check | Result |
| --- | --- |
| `npm ci` | Passed: 61 packages installed; audit reported 0 vulnerabilities. |
| `npm test` | Passed: 5/5 Vitest, exact production type/build, artifact verification, and 3/3 Playwright Chromium tests. |
| Exact production build | Passed independently: `tsc --noEmit && vite build`; `dist/` produced. |
| Available lint/type checks | No lint script exists; TypeScript is included in `npm run build` and passed. |
| `npm audit --omit=dev` and full `npm audit` | Both reported 0 vulnerabilities. |
| Bundle budgets | JS 36,947 B / 12.35 KB gzip; CSS 13,930 B / 3.84 KB gzip; no fonts; mobile hero 14,718 B. All are within the stated static-PWA budgets. |

Lighthouse 13.0.1 was attempted with the supplied Chromium against the local preview and live origin. This environment's Chrome session closed during Lighthouse navigation/BFCache cleanup, so it did not emit a valid score report. This is recorded as unscored rather than treated as product evidence. Browser and axe checks below completed normally.

## Functional, privacy, accessibility, and deployment evidence

- The live root, worker, manifest, privacy, terms, offline page, and hashed CSS/JS were byte-for-byte equal to the locally built candidate. Live and local `/sw.js` SHA-256 were both `49e0cf3d4f5d8d44ee74e7e5bab18de394b801b929366c94869ea1890ffbff4f`.
- Desktop normal flow was exercised: mismatched passphrase recovery; encrypted vault creation; required-field recovery; text-file rejection; >15 MB image rejection; $0.01 and $99,999,999.00 receipt saves; correct $99,999,999.01 aggregate; keyboard save; search/no-results recovery; original viewer/hash; metadata edit with the original locked; filtered period export; encrypted backup; invalid-backup recovery; refresh persistence; wrong-passphrase recovery and successful unlock.
- The exported ZIP contained `index.pdf`, `index.csv`, `README.txt`, and `originals/001-receipt.png`. The downloaded encrypted backup contained none of the test merchant or claim-note plaintext. IndexedDB inspection likewise found no test merchant plaintext in stored receipt rows.
- axe found zero serious/critical violations on desktop home, privacy, terms, and offline pages. The normal live load had zero console warnings/errors and zero uncaught page errors. Visible focus, dialogs, form labels, and keyboard actions were exercised; the skip-focus exception is listed above.
- At 390×844, the wordmark and Privacy/Terms links measured at least 44×44 px, horizontal overflow was 0 px, and reduced-motion transition duration was `1e-05s`. Two offline reloads after fresh worker control passed.
- Normal use issued requests only to `receipt-tax-packet.sociobot.in` (HTML, local CSS/JS, and supplied artwork); no trackers, CDN fonts, or third-party requests were observed. The only declared external endpoint is Sociobot licensing. The app remains local-first with encrypted IndexedDB data.
- Live policies include the configured CSP, `Permissions-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, immutable hashed assets, and `no-cache, no-store, must-revalidate` for `/sw.js`.

## Required recheck after repair

1. Deploy the exact repaired candidate.
2. In a fresh mobile context, perform a real worker replacement and confirm Cache Storage has exactly one current versioned shell cache before and after an offline reload.
3. Configure rate limiting on the license verification endpoint and verify a rapid burst reaches `429` with a numeric/date `Retry-After`; record the observed threshold.
4. Restore focus to main after activating the skip link, correct the manifest MIME type, and rerun desktop/mobile axe plus Lighthouse in a stable browser runner.
