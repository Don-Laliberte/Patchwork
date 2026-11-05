import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProductPreviewForm } from '../components/ProductPreviewForm'
import { startBarcodeScan, type BarcodeStop } from '../lib/barcode'
import { fetchProductFromUrl, UrlIngestError } from '../lib/fetchProductUrl'
import { recognizeIngredientsImage } from '../lib/ocr'
import { lookupOpenBeautyFacts } from '../lib/openBeautyFacts'
import { parseIngredients } from '../lib/parseIngredients'
import type { ProductSource } from '../db/schema'

type Tab = 'barcode' | 'paste' | 'photo' | 'url'

interface Draft {
  name: string
  ingredients: string[]
  barcode?: string
  imageUrl?: string
  sourceUrl?: string
  source: ProductSource
}

export default function IngestPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('paste')
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')
  const [url, setUrl] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftWarning, setDraftWarning] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopRef = useRef<BarcodeStop | null>(null)
  const handledBarcode = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  function openDraft(next: Draft, warning?: string) {
    setDraft(next)
    setDraftWarning(warning ?? null)
    setError(null)
    setStatus(null)
    stopScanner()
  }

  function stopScanner() {
    stopRef.current?.()
    stopRef.current = null
    setScanning(false)
  }

  async function handlePastePreview() {
    setError(null)
    const parsed = parseIngredients(pasteText)
    if (parsed.length === 0) {
      setError('Could not parse any ingredients. Check commas or line breaks.')
      return
    }
    openDraft({
      name: pasteName,
      ingredients: parsed.map((p) => p.raw),
      barcode: manualBarcode || undefined,
      source: 'manual',
    })
  }

  async function handlePhoto(file: File | null) {
    if (!file) return
    setError(null)
    setStatus('Reading label…')
    setOcrProgress(0)
    try {
      const text = await recognizeIngredientsImage(file, setOcrProgress)
      const parsed = parseIngredients(text)
      if (parsed.length === 0) {
        setError(
          'OCR finished but no ingredients were parsed. Try a clearer crop or paste the text.',
        )
        setPasteText(text)
        setTab('paste')
        return
      }
      openDraft({
        name: pasteName,
        ingredients: parsed.map((p) => p.raw),
        barcode: manualBarcode || undefined,
        source: 'ocr',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed')
    } finally {
      setStatus(null)
      setOcrProgress(null)
    }
  }

  async function resolveBarcode(code: string) {
    if (handledBarcode.current === code) return
    handledBarcode.current = code
    setManualBarcode(code)
    setStatus(`Looking up ${code}…`)
    setError(null)
    try {
      const result = await lookupOpenBeautyFacts(code)
      if (!result.found || !result.ingredientsText) {
        setStatus(null)
        setError(
          result.found
            ? 'Product found but ingredients are missing. Paste or photo the label — barcode will be kept.'
            : 'Not in Open Beauty Facts. Paste or photo the label — barcode will be kept.',
        )
        setTab('paste')
        stopScanner()
        return
      }
      const parsed = parseIngredients(result.ingredientsText)
      openDraft({
        name: result.name,
        ingredients: parsed.map((p) => p.raw),
        barcode: code,
        imageUrl: result.imageUrl,
        sourceUrl: `https://world.openbeautyfacts.org/product/${encodeURIComponent(code)}`,
        source: 'barcode',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setStatus(null)
    }
  }

  async function startScanner() {
    setError(null)
    handledBarcode.current = null
    if (!videoRef.current) return
    try {
      setScanning(true)
      stopRef.current = await startBarcodeScan(videoRef.current, (code) => {
        void resolveBarcode(code)
      })
    } catch (err) {
      setScanning(false)
      setError(
        err instanceof Error
          ? err.message
          : 'Camera unavailable. Enter the barcode manually.',
      )
    }
  }

  async function handleUrl() {
    setError(null)
    setStatus('Fetching page…')
    try {
      const result = await fetchProductFromUrl(url.trim())
      const parsed = parseIngredients(result.ingredientsText)
      if (parsed.length === 0) {
        setPasteName(result.name || pasteName)
        setTab('paste')
        setError(
          result.warning ||
            'Page fetched but ingredients could not be parsed. Paste the INCI list to finish.',
        )
        return
      }
      if (result.warning) {
        openDraft(
          {
            name: result.name,
            ingredients: parsed.map((p) => p.raw),
            imageUrl: result.imageUrl,
            sourceUrl: result.sourceUrl,
            source: 'url',
          },
          result.warning,
        )
      } else {
        openDraft({
          name: result.name,
          ingredients: parsed.map((p) => p.raw),
          imageUrl: result.imageUrl,
          sourceUrl: result.sourceUrl,
          source: 'url',
        })
      }
    } catch (err) {
      if (err instanceof UrlIngestError) {
        if (err.nameHint) setPasteName(err.nameHint)
        setTab('paste')
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'URL fetch failed')
      }
    } finally {
      setStatus(null)
    }
  }

  if (draft) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl">Review before save</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)]">
          Fix OCR typos and confirm the list. Nothing is stored until you save.
        </p>
        {draftWarning && (
          <p className="panel rounded-xl p-3 text-sm text-[rgba(26,36,28,0.75)]">
            {draftWarning}
          </p>
        )}
        <ProductPreviewForm
          initialName={draft.name}
          initialIngredients={draft.ingredients}
          initialBarcode={draft.barcode}
          initialImageUrl={draft.imageUrl}
          initialSourceUrl={draft.sourceUrl}
          source={draft.source}
          onSaved={() => navigate('/')}
          onCancel={() => {
            setDraft(null)
            setDraftWarning(null)
          }}
        />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'barcode', label: 'Barcode' },
    { id: 'paste', label: 'Paste' },
    { id: 'photo', label: 'Photo' },
    { id: 'url', label: 'URL' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Add product</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          Every path ends in an editable preview before it hits your log.
        </p>
      </div>

      <div className="panel rounded-xl p-1 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              if (t.id !== 'barcode') stopScanner()
              setTab(t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'paste' && (
        <div className="panel rounded-2xl p-4 space-y-3">
          <input
            className="field"
            placeholder="Product name"
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
          />
          {manualBarcode && (
            <p className="text-xs text-[rgba(26,36,28,0.55)]">
              Barcode on deck: {manualBarcode}
            </p>
          )}
          <textarea
            className="field min-h-40"
            placeholder="Paste ingredients, separated by commas…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button type="button" className="btn btn-primary w-full" onClick={() => void handlePastePreview()}>
            Preview ingredients
          </button>
        </div>
      )}

      {tab === 'photo' && (
        <div className="panel rounded-2xl p-4 space-y-3">
          <input
            className="field"
            placeholder="Product name (optional for now)"
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
          />
          <label className="btn btn-primary w-full cursor-pointer">
            Take or upload photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          {ocrProgress != null && (
            <p className="text-sm">OCR progress: {ocrProgress}%</p>
          )}
          <p className="text-xs text-[rgba(26,36,28,0.55)]">
            Photos stay on this device. Crop to the ingredients block for best results.
          </p>
        </div>
      )}

      {tab === 'barcode' && (
        <div className="panel rounded-2xl p-4 space-y-3">
          <div className="overflow-hidden rounded-xl bg-black aspect-[3/4]">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
          <div className="flex gap-2">
            {!scanning ? (
              <button type="button" className="btn btn-primary flex-1" onClick={() => void startScanner()}>
                Start camera
              </button>
            ) : (
              <button type="button" className="btn btn-secondary flex-1" onClick={stopScanner}>
                Stop camera
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="Or type barcode"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              inputMode="numeric"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void resolveBarcode(manualBarcode.replace(/\D/g, ''))}
            >
              Look up
            </button>
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className="panel rounded-2xl p-4 space-y-3">
          <input
            className="field"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!url.trim()}
            onClick={() => void handleUrl()}
          >
            Fetch ingredients
          </button>
          <p className="text-xs text-[rgba(26,36,28,0.55)]">
            Best on brand / INCI pages (including INCIDecoder links). Amazon often
            blocks lookups — Patchwork tries INCIDecoder, then Open Beauty Facts,
            and rejects junk matches. Paste or photo the label when databases are
            missing or wrong. Always verify against the bottle.
          </p>
        </div>
      )}

      {status && <p className="text-sm text-[var(--moss)]">{status}</p>}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  )
}
