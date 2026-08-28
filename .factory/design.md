# Receipt Packet — visual thesis

## Direction and rationale

**Neo-brutalist utility: the evidence binder.** Receipt Packet should feel like a
physical working folder assembled on a clear desk: blunt rules, numbered tabs,
ink stamps, paper edges, and visible proof. The interface avoids “fintech” gloss
and decorative dashboards. Structure is the decoration, because the product's
promise is traceability: every expense line has an original, a note, and a
fingerprint.

The single-mode light canvas is intentional. A warm paper ground and charcoal
ink make long capture and review sessions legible, while the acid-lime action
colour behaves like a real indexing sticker. This visual direction is specific
to an accountant handoff rather than generic expense management.

## Palette

All colours are encoded as CSS tokens.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F3EFDF` | Page and “archive paper” background |
| `--sheet` | `#FFFDF5` | Working surfaces and form fields |
| `--ink` | `#171812` | Primary text and hard rules |
| `--muted-ink` | `#55564E` | Secondary text (7.0:1 on paper) |
| `--acid` | `#DDF746` | Primary actions and selected tabs |
| `--acid-ink` | `#171812` | Text on acid |
| `--blue` | `#1557FF` | Links, focus rings, active evidence |
| `--good` | `#087A55` | Complete/verified states |
| `--warn` | `#8A5200` | Incomplete/offline caution |
| `--danger` | `#B52B22` | Destructive/error states |
| `--shadow` | `#171812` | Offset physical shadows |

Status always includes an icon or word; colour never carries meaning alone.

## Typography

- **Display and labels:** `Arial Black`, `Arial`, sans-serif. Dense, uppercase,
  utilitarian, and available locally with no font download.
- **Body and controls:** `Arial`, `Helvetica`, sans-serif. Body starts at 16px,
  line-height 1.5. Numeric values use `font-variant-numeric: tabular-nums`.
- Scale: 14px metadata, 16px body, 20px section, 28px card total, and a
  clamp-based 40–68px product heading. Copy measure is capped at 68ch.

## Layout and spacing

The base unit is 4px; major rhythm uses 8, 12, 16, 24, 32, 48, and 64px.
Content sits in a 1180px maximum workbench. Desktop uses a narrow ledger
summary beside the evidence list. At 760px and below it becomes one column;
secondary metadata stacks, while the primary “Add receipt” and export controls
stay visible in the natural reading order. Tap targets are at least 44px.

Surfaces use 2px charcoal borders and 6px offset shadows—never soft floating
shadows. Corners are 0–8px to resemble clipped documents. Dashed rules signal
missing evidence or drop targets. Numbered badges make the capture → review →
export sequence obvious.

## Interaction grammar

- Buttons depress into their 4px offset shadow on activation.
- A receipt opens as a page layered over the ledger; focus enters the dialog
  and returns to its origin on close.
- Saving updates the completeness stamp immediately and announces the result.
- Deletion names the receipt and requires confirmation; exports never alter
  source data.
- Offline status is a persistent labelled strip, not an alarming modal.
- Empty, error, and locked states always state the next useful action.

## Motion policy

Motion uses physical paper logic and only `transform`/`opacity`: 180ms button
presses, 220ms dialog entrance, and a single 260ms receipt-row settle. Nothing
loops. Under `prefers-reduced-motion: reduce`, transitions and animations are
removed; hierarchy, borders, and status labels retain all meaning.

## Original asset plan and art direction

The hero illustration is an editorial still life of a receipt evidence packet:
a cream archive folder, three irregular receipts, a cobalt paper clip, a black
fingerprint/hash stamp, and one acid-lime index tab on an ink-black tabletop.
It explains original-to-line integrity without pretending to show OCR.

**Prompt sheet**

- Subject: a compact physical evidence binder with linked receipt originals.
- World: sole trader's tidy end-of-period workbench; archival, tactile, honest.
- Materials: toothy recycled paper, carbon ink, metal clip, rubber stamp.
- Light/lens: hard overhead studio light, top-down 50mm editorial composition.
- Palette words: warm paper, near-black ink, acid-lime tab, cobalt proof mark.
- Negative list: no people, hands, brands, logos, legible text, currency
  symbols, calculators, phones, gradients, glass effects, or watermark.

**Production prompt**

> Use case: stylized-concept. Asset type: responsive landing/workspace hero.
> A top-down editorial still life of an open cream archive evidence folder on
> an ink-black tabletop, containing three irregular blank thermal-paper
> receipts visibly tethered by thin cobalt-blue index lines to numbered black
> ledger marks, one cobalt paper clip, a circular fingerprint-like rubber stamp
> impression made of abstract concentric lines, and one acid-lime filing tab.
> Screen-print / cut-paper collage with tactile fibres, hard-edged shadows, bold
> neo-brutalist geometry, high contrast. Landscape with the object centred and
> safe cropping on all sides. No people, hands, brands, logos, legible text,
> currency symbols, calculators, phones, gradients, UI, watermark, or signature.

The source PNG and prompt sidecar live in `assets/src/`; responsive WebP output
lives in `public/assets/`. Generated imagery is original to this product and is
disclosed in the footer.

## Accessibility notes

The design has one document `h1`; application views begin at `h2`. Visible
focus uses a 3px cobalt ring plus 2px paper gap. Links remain underlined.
Form errors are textual and programmatically associated. The illustration has
descriptive alt text; texture is decorative. The paper palette has been chosen
for at least 4.5:1 body-text contrast.
