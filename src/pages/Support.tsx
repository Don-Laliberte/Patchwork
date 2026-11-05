import { SUPPORT_LINKS } from '../config/support'

export default function SupportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">Support</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          Patchwork is free. If it helped you untangle a breakout log, you can support development
          here.
        </p>
      </div>

      {SUPPORT_LINKS.map((link) => (
        <a
          key={link.id}
          className="btn btn-primary w-full"
          href={link.href}
          target="_blank"
          rel="noreferrer"
        >
          {link.label}
        </a>
      ))}

      <details className="panel support-details rounded-2xl">
        <summary>
          <h3 className="font-display text-xl text-[var(--ink)]">Privacy</h3>
        </summary>
        <div className="support-details-body space-y-3 text-sm text-[rgba(26,36,28,0.75)]">
          <p>
            Product names, ingredients, and cleared flags are stored in this browser (IndexedDB). They
            are not uploaded to Patchwork servers.
          </p>
          <p>
            Label photos used for OCR are processed on-device and are not uploaded.
          </p>
          <p>
            Barcode lookup sends only the numeric code to Open Beauty Facts to fetch public product
            data. Successful lookups are cached locally.
          </p>
          <p>
            URL ingest may send the page address to Patchwork’s fetch helper, and may look up the
            product name on INCIDecoder and Open Beauty Facts when a retailer blocks scraping.
            Prefer paste or photo if you do not want those lookups.
          </p>
          <p>
            Google Drive export (when configured) uploads a CSV you choose to your own Drive after
            Google sign-in.
          </p>
        </div>
      </details>

      <details className="panel support-details rounded-2xl">
        <summary>
          <h3 className="font-display text-xl text-[var(--ink)]">Install</h3>
        </summary>
        <div className="support-details-body space-y-2 text-sm text-[rgba(26,36,28,0.75)]">
          <p>
            On phone: open Patchwork in the browser, then use Add to Home Screen / Install.
          </p>
          <p>
            On desktop Chrome or Edge: use Install from the address bar or browser menu.
          </p>
        </div>
      </details>
    </div>
  )
}
