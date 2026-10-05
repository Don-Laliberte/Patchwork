import { useState } from 'react'
import type { ProductSource } from '../db/schema'
import { parseIngredients } from '../lib/parseIngredients'
import { saveProduct } from '../lib/products'

interface Props {
  initialName?: string
  initialIngredients?: string[]
  initialBarcode?: string
  source: ProductSource
  productId?: number
  flaggedBreakout?: boolean
  onSaved?: () => void
  onCancel?: () => void
}

export function ProductPreviewForm({
  initialName = '',
  initialIngredients = [],
  initialBarcode,
  source,
  productId,
  flaggedBreakout = true,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName)
  const [rows, setRows] = useState(
    initialIngredients.length > 0 ? initialIngredients : [''],
  )
  const [isSafe, setIsSafe] = useState(!flaggedBreakout)
  const [barcode, setBarcode] = useState(initialBarcode ?? '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRow(index: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? value : r)))
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  function addRow() {
    setRows((prev) => [...prev, ''])
  }

  function reparseFromJoined() {
    const parsed = parseIngredients(rows.filter(Boolean).join(', '))
    setRows(parsed.length ? parsed.map((p) => p.raw) : [''])
  }

  async function handleSave() {
    setError(null)
    const ingredients = rows.map((r) => r.trim()).filter(Boolean)
    if (!name.trim()) {
      setError('Add a product name.')
      return
    }
    if (ingredients.length === 0) {
      setError('Add at least one ingredient.')
      return
    }
    setSaving(true)
    try {
      await saveProduct({
        id: productId,
        name,
        ingredients,
        source,
        barcode: barcode.trim() || undefined,
        flaggedBreakout: !isSafe,
        notes: notes.trim() || undefined,
      })
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel rounded-2xl p-4 space-y-4">
      <div>
        <label className="text-sm font-semibold">Product name</label>
        <input
          className="field mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. La Roche-Posay Toleriane Cleanser"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={!isSafe}
            onChange={() => setIsSafe(false)}
          />
          Breakout product
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={isSafe}
            onChange={() => setIsSafe(true)}
          />
          Tolerated / safe
        </label>
      </div>

      {(barcode || initialBarcode !== undefined) && (
        <div>
          <label className="text-sm font-semibold">Barcode</label>
          <input
            className="field mt-1"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            inputMode="numeric"
            placeholder="UPC / EAN"
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-semibold">Ingredients</label>
          <button type="button" className="text-sm font-semibold text-[var(--moss)]" onClick={reparseFromJoined}>
            Re-split list
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="flex gap-2">
              <span className="w-6 shrink-0 pt-3 text-xs text-[rgba(26,36,28,0.45)]">
                {index + 1}
              </span>
              <input
                className="field"
                value={row}
                onChange={(e) => updateRow(index, e.target.value)}
                placeholder="Ingredient name"
              />
              <button
                type="button"
                className="btn btn-danger px-3"
                onClick={() => removeRow(index)}
                aria-label="Remove ingredient"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary mt-3 w-full" onClick={addRow}>
          Add ingredient
        </button>
      </div>

      <div>
        <label className="text-sm font-semibold">Notes</label>
        <textarea
          className="field mt-1 min-h-20"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : productId != null ? 'Update product' : 'Save product'}
        </button>
      </div>
    </div>
  )
}
