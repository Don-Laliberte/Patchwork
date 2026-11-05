import { useEffect, useRef, useState, type ReactNode } from 'react'
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

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'barcode', label: 'Barcode', icon: <BarcodeIcon /> },
    { id: 'paste', label: 'Paste', icon: <PasteIcon /> },
    { id: 'photo', label: 'Photo', icon: <CameraIcon /> },
    { id: 'url', label: 'URL', icon: <LinkIcon /> },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Add product</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          Every path ends in an editable preview before it hits your log.
        </p>
      </div>

      <div className="add-card panel">
        <div className="add-tabs" role="tablist" aria-label="How to add a product">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-label={t.label}
              title={t.label}
              className={`add-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => {
                if (t.id !== 'barcode') stopScanner()
                // Manual tab changes clear stale messages. Handoffs from photo /
                // barcode / URL call setTab directly and keep their error.
                if (t.id !== tab) {
                  setError(null)
                  setStatus(null)
                }
                setTab(t.id)
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="add-card-body">
          {tab === 'paste' && (
            <>
              <input
                className="field"
                placeholder="Product name"
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                aria-label="Product name"
              />
              {manualBarcode && (
                <p className="add-note">Barcode on deck: {manualBarcode}</p>
              )}
              <textarea
                className="field add-well"
                placeholder="Paste ingredients, separated by commas…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                aria-label="Ingredients"
              />
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={!pasteName.trim() || !pasteText.trim()}
                onClick={() => void handlePastePreview()}
              >
                Preview ingredients
              </button>
            </>
          )}

          {tab === 'photo' && (
            <>
              <input
                className="field"
                placeholder="Product name (optional for now)"
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                aria-label="Product name"
              />
              <label className="add-well add-well-hit">
                <CameraIcon />
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
                <p className="add-note">OCR progress: {ocrProgress}%</p>
              )}
              <p className="add-note">
                Photos stay on this device. Crop to the ingredients block for best results.
              </p>
            </>
          )}

          {tab === 'barcode' && (
            <>
              <div className="add-inline-field">
                <input
                  className="field"
                  placeholder="Type a barcode…"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  inputMode="numeric"
                  aria-label="Barcode"
                  onKeyDown={(e) => {
                    const code = manualBarcode.replace(/\D/g, '')
                    if (e.key === 'Enter' && code) void resolveBarcode(code)
                  }}
                />
                <button
                  type="button"
                  className="add-inline-action"
                  disabled={!manualBarcode.replace(/\D/g, '')}
                  onClick={() => void resolveBarcode(manualBarcode.replace(/\D/g, ''))}
                >
                  Look up
                </button>
              </div>
              <div className={`add-well add-camera ${scanning ? 'live' : ''}`}>
                <video ref={videoRef} className="add-camera-video" muted playsInline />
                {!scanning ? (
                  <button type="button" className="add-well-action" onClick={() => void startScanner()}>
                    <CameraIcon />
                    Start camera
                  </button>
                ) : (
                  <button type="button" className="add-well-stop" onClick={stopScanner}>
                    Stop camera
                  </button>
                )}
              </div>
              <p className="add-note">Point the camera at a barcode, or type the number above.</p>
            </>
          )}

          {tab === 'url' && (
            <>
              <div className="add-inline-field">
                <input
                  className="field"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  aria-label="Product page URL"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim()) void handleUrl()
                  }}
                />
                <button
                  type="button"
                  className="add-inline-action"
                  disabled={!url.trim()}
                  onClick={() => void handleUrl()}
                >
                  Fetch
                </button>
              </div>
              <details className="add-note-details">
                <summary>
                  Best on brand / INCI pages. Always verify against the bottle.
                </summary>
                <p>
                  Amazon often blocks lookups — Patchwork tries INCIDecoder, then Open
                  Beauty Facts, and rejects junk matches. Paste or photo the label when
                  databases are missing or wrong.
                </p>
              </details>
            </>
          )}

          {status && <p className="text-sm text-[var(--moss)]">{status}</p>}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function BarcodeIcon() {
  return (
    <svg width="26" height="22" viewBox="0 0 28 24" aria-hidden>
      <rect x="1" y="3" width="1.5" height="18" fill="currentColor" />
      <rect x="4" y="3" width="2.7" height="18" fill="currentColor" />
      <rect x="8.1" y="3" width="1.2" height="18" fill="currentColor" />
      <rect x="10.6" y="3" width="2.3" height="18" fill="currentColor" />
      <rect x="14.2" y="3" width="1.1" height="18" fill="currentColor" />
      <rect x="16.6" y="3" width="3" height="18" fill="currentColor" />
      <rect x="20.9" y="3" width="1.4" height="18" fill="currentColor" />
      <rect x="23.6" y="3" width="2.4" height="18" fill="currentColor" />
    </svg>
  )
}

function PasteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="4.5" width="10" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9 5.5H7.5A2.5 2.5 0 0 0 5 8v10.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8A2.5 2.5 0 0 0 16.5 5.5H15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.5h6M9 16h4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.2 7.2 9.4 5.4h5.2l1.2 1.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <rect x="3.5" y="7.2" width="17" height="11.6" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="13" r="2.7" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l1.76-1.76a5 5 0 0 0-7.07-7.07L10.5 5.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L5.17 12.76a5 5 0 0 0 7.07 7.07l1.23-1.23"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
