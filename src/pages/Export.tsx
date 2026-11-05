import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db/schema'
import {
  buildBreakoutCsv,
  buildCombinedExport,
  buildEliminationCsv,
  exportFilename,
  shareOrDownload,
} from '../lib/exportCsv'
import { importBreakoutCsv, importCombinedCsv, importEliminationCsv } from '../lib/importCsv'
import {
  isGoogleDriveConfigured,
  uploadCsvToGoogleDrive,
} from '../lib/googleDrive'

export default function ExportPage() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const metas = useLiveQuery(() => db.ingredients.toArray(), []) ?? []
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function downloadCombined() {
    const content = buildCombinedExport(products, metas)
    await shareOrDownload(exportFilename('export'), content)
    setMessage('Export ready.')
  }

  async function downloadBreakout() {
    await shareOrDownload(exportFilename('breakout'), buildBreakoutCsv(products))
  }

  async function downloadElimination() {
    await shareOrDownload(
      exportFilename('elimination'),
      buildEliminationCsv(products, metas),
    )
  }

  async function uploadDrive() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const content = buildCombinedExport(products, metas)
      const result = await uploadCsvToGoogleDrive(exportFilename('export'), content)
      setMessage(
        result.webViewLink
          ? `Uploaded to Google Drive.`
          : `Uploaded to Google Drive (file id ${result.id}).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drive upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const breakoutSheet =
          workbook.Sheets['Breakout Sheet'] ||
          workbook.Sheets[workbook.SheetNames[0]]
        const clearedSheet =
          workbook.Sheets['Cleared Sheet'] ||
          workbook.Sheets[workbook.SheetNames[1]]

        if (breakoutSheet) {
          const csv = XLSX.utils.sheet_to_csv(breakoutSheet)
          const imported = importBreakoutCsv(csv)
          if (imported.length) await db.products.bulkAdd(imported)
        }
        if (clearedSheet) {
          const csv = XLSX.utils.sheet_to_csv(clearedSheet)
          const importedMetas = importEliminationCsv(csv).filter((m) => m.cleared)
          for (const meta of importedMetas) {
            await db.ingredients.put(meta)
          }
        }
        setMessage('Spreadsheet imported.')
        return
      }

      const text = await file.text()
      const { products: importedProducts, metas: importedMetas } =
        importCombinedCsv(text)
      if (importedProducts.length) await db.products.bulkAdd(importedProducts)
      for (const meta of importedMetas) {
        await db.ingredients.put(meta)
      }
      setMessage(
        `Imported ${importedProducts.length} products and ${importedMetas.length} ingredient rows.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Export and Import</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          CSV matches the wide breakout layout from your sheet. Import migrates an existing log.
        </p>
      </div>

      <div className="panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl">Download</h3>
          <DownloadIcon />
        </div>
        <button type="button" className="btn btn-primary w-full" onClick={() => void downloadCombined()}>
          Download full export
        </button>
        <button type="button" className="btn btn-secondary w-full" onClick={() => void downloadBreakout()}>
          Breakout CSV only
        </button>
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={() => void downloadElimination()}
        >
          Elimination CSV only
        </button>
      </div>

      <div className="panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl">Google Drive</h3>
          <GoogleDriveIcon />
        </div>
        {isGoogleDriveConfigured() ? (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => void uploadDrive()}
          >
            {busy ? 'Working…' : 'Save export to Google Drive'}
          </button>
        ) : (
          <p className="text-sm text-[rgba(26,36,28,0.65)]">
            Set <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> at build time to enable Drive
            uploads. Until then, use CSV download.
          </p>
        )}
      </div>

      <div className="panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl">Import</h3>
          <ImportIcon />
        </div>
        <label className="btn btn-secondary w-full cursor-pointer">
          Import CSV or Excel
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-xs text-[rgba(26,36,28,0.55)]">
          Accepts Patchwork exports, breakout-wide CSVs, and your original Breakout / Cleared sheets.
        </p>
      </div>

      {message && <p className="text-sm text-[var(--safe)]">{message}</p>}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--moss)]">
      <path
        d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0 text-[var(--moss)]"
    >
      <path
        fill="currentColor"
        d="m14 12l-4-4v3H2v2h8v3m10 2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3h2V6h12v12H6v-3H4v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"
      />
    </svg>
  )
}

function GoogleDriveIcon() {
  return (
    <svg
      width="22"
      height="20"
      viewBox="0 0 87.3 78"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#0066da"
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
      />
      <path
        fill="#00ac47"
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"
      />
      <path
        fill="#ea4335"
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
      />
      <path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" />
      <path
        fill="#2684fc"
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
      />
      <path
        fill="#ffba00"
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
      />
    </svg>
  )
}
