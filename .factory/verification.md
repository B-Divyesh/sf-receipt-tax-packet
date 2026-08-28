# Independent verification — FAIL

**Verified:** 2026-08-28 06:02 UTC  
**Candidate:** `bbbc43a8243825f06be15304ac3bc8752f7a53c4`  
**Live URL:** <https://receipt-tax-packet.sociobot.in/>  
**Verdict:** **FAIL** — the deployed immutable build assets do not have the
required long-lived immutable HTTP caching policy. All core functional,
offline, accessibility, privacy, and byte-identity checks below otherwise
passed.

## Release-blocking defect

### Medium — hashed production assets are revalidated every 30 seconds

Evidence from the live deployment, reproduced 2026-08-28 06:02 UTC:

```
GET /assets/index-DTBFq3MQ.js
cache-control: public, must-revalidate, max-age=30
content-type: text/javascript

GET /assets/index-DTXWj9UD.css
cache-control: public, must-revalidate, max-age=30
```

The paths include Vite content hashes, so the static/PWA acceptance policy
requires long-lived immutable caching for them. A 30-second revalidation policy
needlessly refetches/revalidates the application shell and fails the stated
cache policy, even though the service worker supplies a cache-first offline
path after installation. This is a deployment configuration defect, not a
source-build mismatch. Fix the static host headers for fingerprinted assets
(for example, a one-year `max-age` plus `immutable`) and reverify.

## Non-blocking findings

### Low — a no-match search claims the vault is empty

With two saved receipts, searching for `no matching receipt` renders the
generic empty state: “No evidence filed yet” and “Add the first original
receipt.” The records have not been lost; the wording is inaccurate and can
prompt an unnecessary duplicate capture. Render a distinct “No receipts match
this search” state with a clear-search action.

### Low — response hardening is incomplete

The live site sends HSTS, `Referrer-Policy: strict-origin-when-cross-origin`,
and `X-Content-Type-Options: nosniff`, but sends no `Content-Security-Policy`,
`Permissions-Policy`, or frame-ancestors/X-Frame-Options response policy. This
is defense-in-depth rather than a demonstrated exploit; add an appropriately
tested policy because the app handles locally stored receipt data.

### Maintenance note — development audit findings only

`npm audit --omit=dev --json` reported **0 production vulnerabilities**.
The full development-tree audit reported one high Vite advisory and one
critical Vitest advisory; fixed non-major releases are available. These tools
are not shipped in `dist/`, so this is not counted as a production release
failure, but the development lockfile should be updated.

## Clean-checkout quality gates

The worktree was clean at candidate SHA before installation.

| Check | Result |
| --- | --- |
| `npm ci` | Passed; 64 packages installed. |
| `npm test` | Passed: 5/5 Vitest tests, production type/build, 2/2 Playwright Chromium tests. |
| Exact deploy build: `npm run build` | Passed: `tsc --noEmit` and Vite build; `dist/index.html` exists. |
| Repository lint/type checks | No separate lint script is defined; TypeScript check in `npm run build` passed. |
| Production dependency audit | Passed: 0 vulnerabilities with `--omit=dev`. |
| Bundle budgets | JS 36,667 B and CSS 13,821 B uncompressed; both within 200 KB/50 KB budgets. Hero WebP is 14,718 B (mobile) / 40,826 B. |

Attempted live Lighthouse 12.8.2 using the supplied Playwright Chromium. Its
CDP session closed during gathering in this container, so no Lighthouse score
is claimed. This was not used to determine the verdict; the required static
budgets and browser checks were measured directly.

## Functional and browser evidence

An independent Playwright Chromium run against the live URL passed 30
assertions on desktop and 390×844 mobile:

- Created the encrypted vault; exercised empty state, short and mismatched
  passphrases, wrong-unlock recovery, locking, refresh/persistence, and no
  passphrase in web storage.
- Captured valid PNG originals; rejected a text file; saved $0.01 and
  $99,999,999.00 boundary amounts; searched, filtered an empty period,
  edited metadata while preserving the original, viewed it, and confirmed
  deletion.
- Exported a January-period ZIP. `unzip -t` passed; it contains `index.pdf`,
  `index.csv`, `README.txt`, and `originals/001-receipt-one.png`. The original
  SHA-256 exactly matched the CSV and PDF fingerprint:
  `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`.
- Keyboard Tab reached the skip link; Enter flow is covered by the repository
  e2e test. The receipt dialog opens with focus on the original-file control.
  The 390px page has no horizontal overflow and tested controls are at least
  44px high. A reduced-motion stylesheet rule is present.
- axe found zero serious/critical violations on both the locked landing view
  and populated workspace. No console errors or page errors occurred.
- The live normal-user request trace contained only
  `receipt-tax-packet.sociobot.in` plus local `blob:` object URLs—no analytics,
  tracker, CDN, font, or receipt-data outbound request. Source review found
  only the documented Sociobot license checkout/verification API, inactive in
  the free flow. IndexedDB is used for vault data; privacy and terms pages
  load locally.

## PWA and deployment identity

- Live `index.html`, `sw.js`, manifest, offline page, privacy page, terms page,
  and both hashed JS/CSS assets have byte-for-byte SHA-256 equality with this
  candidate's fresh `dist/` output.
- The generated live worker precaches the shell and hashed assets, uses
  cache-first asset matching, network-first navigation fallback, versioned
  cache names, `skipWaiting`, and `clients.claim`.
- At 390×844, after the worker controlled the page, offline reload succeeded
  and showed both the application h1 and “Offline — capture and export still
  work.”
- A controlled worker-upgrade simulation with changed worker source activated
  immediately and displayed the application’s “Updated app ready. Reload”
  toast.
- HTTPS responses are 200 for `/`, `/privacy/`, `/terms/`, manifest and
  worker. The live deployment is therefore the requested candidate, despite
  its caching/header defects.

## Retest command summary

```sh
npm ci
npm test
npm run build
npm audit --omit=dev --json
```

After deployment caching is corrected, rerun the live 390px offline reload,
worker update, response-header check, and complete packet export.
