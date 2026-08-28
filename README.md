# Receipt Packet

Receipt Packet is an offline-first evidence binder for self-employed people
preparing a tax-period or accountant handoff. It ties every claimed expense to
its unchanged receipt image, a factual explanation, and a SHA-256 fingerprint,
then exports the selected period as one ZIP with a PDF index, CSV, integrity
guide, and originals.

It deliberately does not perform OCR, bank sync, bookkeeping, reimbursement,
or tax-deductibility decisions.

Live site: <https://receipt-tax-packet.sociobot.in>

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
- Free core workflow plus a $19 one-time supporter unlock for custom PDF cover
  fields through the Sociobot billing API.
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

`npm test` runs unit tests, a production build, and Playwright browser tests for
the capture/export flow, serious/critical axe findings, 390px layout, and an
offline reload. Playwright 1.58.2 is pinned.

The reproducible deploy command is:

```sh
npm ci && npm run build
```

Static output lands in `dist/`, with `dist/index.html` at its root. Deploy that
directory as-is; infrastructure, DNS, billing registration, and rewrites are
managed by the Param Factory.

## Security and data recovery

The vault uses PBKDF2-SHA-256 (250,000 iterations) and AES-256-GCM through the
browser Web Crypto API. Encryption protects local records at rest, but it cannot
protect an unlocked browser session or a compromised device. There is no
passphrase recovery. Users should download an encrypted backup after every
period and store both backup and passphrase safely.

## Product source of truth

- [Opportunity brief](.factory/brief.json)
- [Visual thesis and asset provenance](.factory/design.md)
- [Build handoff](.factory/handoff.md)

MIT licensed. See [LICENSE](LICENSE).
