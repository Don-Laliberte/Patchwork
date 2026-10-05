# Patchwork

Local-first PWA for tracking skincare products and ruling out breakout ingredients by process of elimination. It's currently a work in progress, branding and colors are NOT final.

## Features

- Log breakout and tolerated products
- Automatic **suspects** (ingredients in more than one breakout product, not cleared, not also in a tolerated product)
- Mark ingredients **cleared**
- Ingest via paste, photo OCR, barcode (Open Beauty Facts), or product URL
- CSV / Excel import & export; Google Drive upload when configured
- Installable PWA; data stays in IndexedDB on device

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Privacy snapshot

- Product data: on-device only
- OCR: on-device
- Barcode lookup: sends barcode number to Open Beauty Facts
- URL ingest: sends URL to the Patchwork fetch helper

## Support Me!

[Support Patchwork](https://ko-fi.com/W5Y1289CMI)

