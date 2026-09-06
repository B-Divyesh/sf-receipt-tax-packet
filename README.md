# Receipt Packet

Receipt Packet helps self-employed people organize original receipts and expense
notes for a tax-period or accountant handoff. It links each expense to its
unchanged receipt image and SHA-256 fingerprint, then exports the selected
period as one ZIP with a PDF index, CSV, integrity guide, and originals.

It deliberately does not perform OCR, bank sync, bookkeeping, reimbursement,
or tax-deductibility decisions.

Live site: <https://receipt-tax-packet.sociobot.in>

Try it without setup: <https://receipt-tax-packet.sociobot.in/demo>.
The demo contains three realistic receipt records in a separate browser-storage
namespace. Its reset and start-for-real controls never write sample changes to
your real vault. See [.factory/demo.md](.factory/demo.md) for the sample and
storage details.

## What ships

- Passphrase-derived AES-GCM encryption for receipt metadata and originals in
  IndexedDB; the passphrase is never stored.
- Capture/import, edit-with-original-lock, review, search, date filtering, and
  explicit deletion.
- Byte-for-byte original preservation with SHA-256 fingerprints.
- Accountant packet export containing `index.pdf`, `index.csv`, an integrity
  note, and deterministically linked files under `originals/`.
- Encrypted JSON backup and restore so data ownership is not tied to the app.
- Installable PWA shell with an offline fallback and fully offline workspace.
- Core capture, encrypted backup, and evidence export without a license.
- A $19 one-time supporter feature for custom PDF cover title and preparer
  fields. Purchase setup is pending billing registration; existing licenses can
  still be restored and verified through the rate-limited same-origin relay.
- Dedicated privacy and terms pages. No analytics, trackers, CDN scripts, or
  remote fonts.

## Develop

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run dev
```

The local URL printed by Vite opens the app. Browser storage is isolated per
origin, so development data is separate from production data.

## Test and build

```sh
npm test
npm run build
```

`npm test` runs unit tests, a production type/build check, artifact-policy
assertions, and Playwright browser tests for the capture/export flow, demo
isolation, axe, keyboard use, exact 390px touch targets, repeated offline
reloads, and a real service-worker replacement. Playwright 1.58.2 is pinned.

Every public product claim has a dedicated browser check in
[.factory/claims.json](.factory/claims.json). From a clean checkout, run each
declared command exactly as listed there, for example:

```sh
npm test -- --grep @claim:demo-sample
```

The reproducible deploy command is:

```sh
npm ci && npm run build
```

Static output lands in `dist/`, with `dist/index.html` at its root. Deploy that
directory as-is; infrastructure, DNS, billing registration, and rewrites are
managed by the Param Factory. The output includes Azure Static Web Apps policy
for immutable fingerprinted assets, a revalidated service worker, CSP,
permissions policy, and frame restrictions. The factory deploy command also
detects `api/` and publishes the managed license-verification function alongside
the static artifact.

## Security and data recovery

The vault uses PBKDF2-SHA-256 (250,000 iterations) and AES-256-GCM through the
browser Web Crypto API. Encryption protects local records at rest, but it cannot
protect an unlocked browser session or a compromised device. There is no
passphrase recovery. Users should download an encrypted backup after every
period and store both backup and passphrase safely.

## Product source of truth

- [Opportunity brief](.factory/brief.json)
- [Visual thesis and asset provenance](.factory/design.md)
- [Demo sandbox](.factory/demo.md)
- [Claims and their checks](.factory/claims.json)
- [Build handoff](.factory/handoff.md)

MIT licensed. See [LICENSE](LICENSE).
