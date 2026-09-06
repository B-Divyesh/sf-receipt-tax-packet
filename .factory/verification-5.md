# Receipt Packet verification — organize receipts for a tax handoff

## Verdict: **FAIL**

Candidate reviewed: `16cdc946307e215c5ae3a9ea0e4f6971ad6cc80a`
Product repair commit: `eee85018dbb5670c37bfa1e3466819e3c6f8537f`
Documentation commit: `ef58c43043fbae187dd3f2957fafadb6f8f282ad`
Live URL: <https://receipt-tax-packet.sociobot.in/>
Verified: 2026-09-06 UTC

There are **5 findings** and **7 untested public-claim groups**. The static
application repair is deployed and its reviewed files match the live site, but
the paid purchase and production license-relay release paths do not meet the
work order. No product code was changed during this verification.

## First screen and demo

Fresh desktop browser evidence before scrolling:

- Job: **Organize receipts for your tax handoff**.
- Audience: self-employed people preparing a tax return or accountant handoff.
- First action: **Try it with sample data**; it says that three sample expenses
  will appear.

The action opened `/demo` with the persistent **Demo — sample data, nothing is
saved** label and three populated records: Fieldwork Software, Harbor Rail, and
Civic Print & Post. **Reset demo** restored exactly three records. **Start for
real** returned to an empty real-vault creation screen. The separately run
`@claim:demo-isolation` test also added, reset, and discarded a demo-only
record before asserting that the real vault was empty.

Fresh 390×844 reduced-motion browser evidence: 0px horizontal overflow,
reduced button transition (`0.00001s`), and the first Tab stop was the visible
Skip to main content link. After service-worker control, two offline reloads
kept the three records, demo label, and offline status visible. Desktop and
mobile browser runs recorded no ordinary console or page errors.

## Commands and claims

Clean setup used `npm ci` (0 audit vulnerabilities). All declared quality
commands passed:

```text
npm test                 PASS — 6 unit tests, build/artifact check, 11 browser tests
npm run build            PASS — dist/ produced
npm run verify:artifact  PASS
```

Every command declared by `.factory/claims.json` was rerun exactly as written
and passed, one tagged browser test each:

| Claim id | Result |
| --- | --- |
| `demo-sample` | PASS |
| `demo-isolation` | PASS |
| `encrypted-local-storage` | PASS |
| `packet-export` | PASS |
| `original-links` | PASS |
| `local-only` | PASS |
| `supporter-cover-fields` | PASS |
| `offline-reload` | PASS |

The built initial JS is 42.33 KB raw / 14.06 KB gzip; CSS is 15.55 KB raw /
4.15 KB gzip. The live root, privacy page, manifest, worker, hashed JS, and
hashed CSS were SHA-256 identical to the locally built artifact.

## Live routes, accessibility, privacy, and PWA

- Root, `/demo`, `/?demo=1`, `/privacy/`, `/terms/`, `/offline.html`, manifest,
  robots, and sitemap returned 200. The unknown route returned the designed
  404 page with HTTP 404, not the home page.
- Titles were correct for root, demo, privacy, terms, and 404. The fresh live
  root had `lang=en`, one h1, a main landmark, no missing image alt text, and
  no unlabeled buttons. The supplied `verify-url.sh` passed (832ms observed
  load).
- Playwright axe with WCAG 2 A/AA tags found zero serious or critical issues
  on root, demo, privacy, terms, and 404.
- Demo request logging stayed same-origin. The sample data uses its separate
  `receipt-packet-demo-v1` IndexedDB database, while real data uses
  `receipt-packet-v1`; reload persistence, encryption at rest, export, invalid
  input, boundary amount, search recovery, backup recovery, dialog handling,
  and worker replacement are exercised by the passing browser suite.
- The live CSP, immutable hashed-asset cache policy, revalidated worker,
  manifest JSON MIME, and actual offline reload passed. This is a static PWA;
  receipt state has no server tenant or restart persistence. The managed
  license relay is checked separately below.

## Findings

| Severity | Finding | Evidence and required disposition |
| --- | --- | --- |
| **Blocker** | The $19 supporter feature cannot be bought. | The product’s own billing checkout URL returned HTTP 404 with the enabled-product response. The UI honestly says purchase setup is pending and does not send a visitor there, but the paid-unlock contract is not complete until the external billing registration is made and purchase plus entitlement are verified end to end. |
| **High** | The deployed license relay has neither a durable live allowance nor reliable burst behavior. | An 80-request sequential burst using unique invalid licenses returned **33 HTTP 200 and 47 HTTP 502**, with **0 HTTP 429** and no `Retry-After`. The reported remaining values continued to reset across managed invocations. This repeats the previous managed-rate-limit blocker and additionally demonstrates upstream verification unavailability under a modest burst. Configure a shared server-side limit and prove a 429 with numeric `Retry-After`; ensure a short outage does not make the restore path unreliable. |
| **Medium** | The public claims catalog is incomplete, so seven public-claim groups lack the required dedicated tagged demo tests. | `.factory/claims.json` correctly covers its eight listed claims, but it omits public promises in the landing/workspace, privacy page, and README: real-vault no-upload/no-sync/no-analytics behavior; AES/PBKDF2/passphrase details and no passphrase storage; capture/edit/search/delete; encrypted backup download and restore; byte-for-byte original preservation; all non-demo local-only behavior; and the update/recovery behavior. Existing general tests may cover portions, but the claims contract requires each visitor-reliable claim to be listed with exactly one `@claim:` outcome test. Add or narrow copy, then rerun every command. |
| **Medium** | The storage-error recovery button is blocked by the site CSP. | `src/main.ts:490` renders `onclick="location.reload()"`, while live `script-src 'self'` blocks inline event handlers. In a fresh live browser under that exact CSP, clicking the same handler left the flag unset and emitted the CSP violation. A visitor in the advertised storage-error recovery state cannot use its provided **Reload app** button. Bind the action with JavaScript and add a recovery-path test. |
| **Medium** | The 404 and offline fallback do not meet the required common accessibility/site skeleton. | Unlike root and legal pages, `404.html` and `offline.html` have no Skip to main content link; the offline fallback also has no standard header, navigation, or footer. `404.html`, privacy, and terms also omit the required social metadata. Axe does not classify these as serious/critical, but the supplied accessibility and site-structure contracts require a skip link and standard route skeleton. |

## Earlier finding disposition

| Verification-4 finding | Current disposition |
| --- | --- |
| Claims file and tagged tests missing | Fixed for eight listed claims; **new incomplete-catalog finding remains**. |
| No one-click isolated sample demo | Fixed and live tested. |
| First screen did not state job, audience, or sample action | Fixed and live cold-read tested. |
| Advertised checkout returned 404 | Broken link removed, but the external purchase registration remains a **blocker**. |
| Unknown route returned home with 200 | Fixed: designed HTTP 404 is live. |
| Demo and copy evidence missing | Fixed: `demo.md` and `copy-audit.md` are present. |
| Immutable cache, CSP, PWA precache/update, mobile targets, manifest MIME, keyboard skip on app route | Passing in current artifact/live checks. |
| Managed license API rate limit | **Still failing**, with the burst evidence above. |

## What must happen before PASS

1. Complete the product’s Sociobot billing registration and verify hosted
   checkout, return token, storage, and entitlement against the live product.
2. Put rate limiting in durable shared infrastructure for the managed relay and
   verify 429 plus `Retry-After` during a fresh unique-license burst; resolve
   the burst 502 behavior.
3. Make the claims catalog match all public promises and give each one exact
   tagged outcome evidence, or remove/narrow the promise.
4. Repair the CSP-blocked storage-error recovery and complete the fallback/404
   accessibility and metadata skeleton, then rerun fresh live desktop and
   phone QA.
