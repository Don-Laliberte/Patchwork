# Patchwork

**Patchwork** is a local-first skincare tracker that helps you figure out which ingredients might be causing breakouts.

Log the products that flare you up and the ones you tolerate. Patchwork compares their ingredient lists and surfaces likely **suspects** — ingredients that show up across breakout products but not in products you already handle fine. Clear false leads as you go, and keep narrowing the list.

No account required. Your product log lives on your device.

## How it works

1. **Add products** — paste an INCI list, scan a barcode, snap a label for OCR, or drop in a product URL.
2. **Tag each product** as Breakout or Tolerated.
3. **Review Elimination** — shared breakout ingredients become suspects; anything also found in a tolerated product is treated as cleared.
4. **Mark ingredients cleared** when you’ve ruled them out by hand.
5. **Export** a CSV backup (and optionally upload to Google Drive when configured).

## Features

- Breakout and tolerated product log with pack-shot thumbnails when available
- Automatic suspect list from shared breakout ingredients
- Manual clear / undo for ingredients
- Add via paste, photo OCR, barcode (Open Beauty Facts), or URL lookup
- CSV / Excel import and export
- Optional Google Drive export upload
- Installable PWA — works offline for your saved data

## Privacy

| Data | Where it goes |
| --- | --- |
| Products, ingredients, cleared flags | On this device (IndexedDB) |
| Label OCR | On-device |
| Barcode lookup | Barcode number → Open Beauty Facts |
| URL ingest | Product URL → Patchwork fetch helper |
| Google Drive export | Only if you opt in and connect Drive |

Nothing is stored on Patchwork servers.

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Optional Google Drive uploads: set `VITE_GOOGLE_CLIENT_ID` at build time (see Export in the app when it’s missing).

## Stack

React, Vite, TypeScript, Dexie, Tailwind — deployed as a Cloudflare Pages app with a small Pages Function for URL ingest.

## Support

If Patchwork helps your routine, you can [support the project on Ko-fi](https://ko-fi.com/W5Y1289CMI).
