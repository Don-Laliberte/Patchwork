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
        <h2 className="font-display text-2xl">Export & import</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          CSV matches the wide breakout layout from your sheet. Import migrates an existing log.
        </p>
      </div>

      <div className="panel rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold">Download</h3>
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
        <h3 className="font-semibold">Google Drive</h3>
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
        <h3 className="font-semibold">Import</h3>
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
