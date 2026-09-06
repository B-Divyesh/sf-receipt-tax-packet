# Demo sandbox

Open <https://receipt-tax-packet.sociobot.in/demo> or
<https://receipt-tax-packet.sociobot.in/?demo=1>. The landing page’s **Try it
with sample data** action goes to the same sandbox in one click.

The sandbox creates three realistic August 2026 examples entirely in the
browser: Civic Print & Post (supplies), Harbor Rail (travel), and Fieldwork
Software (software). Each has a locally generated SVG receipt original, an
expense explanation, and a SHA-256 fingerprint. No sample file is fetched and
no account or passphrase is needed.

Demo storage uses the IndexedDB database `receipt-packet-demo-v1`; real
records use `receipt-packet-v1`. While the persistent **Demo — sample data,
nothing is saved** banner is present, all add, edit, export, and reset actions
touch only the demo database. **Reset demo** removes changes and re-seeds the
three examples. **Start for real** clears the demo database and returns to an
empty real vault; it never copies demo records into real storage.

The service worker precaches the app shell. The sample records are generated
locally on each demo entry, so the demo remains populated after the first
online visit and an offline reload.
