import { formatIngredientDisplay, normalizeIngredient } from './normalizeIngredient'
import { parseIngredients } from './parseIngredients'
import type { IngredientMeta, Product } from '../db/schema'

export interface ImportResult {
  products: Omit<Product, 'id'>[]
  metas: IngredientMeta[]
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

function truthy(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'y'
}

export function importBreakoutCsv(text: string): Omit<Product, 'id'>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  if (lines.length === 0) return []

  const rows = lines.map(parseCsvLine)
  const first = rows[0]?.map((c) => c.toLowerCase()) ?? []
  const hasHeader =
    first[0] === 'product' || first.includes('ingredient')
  const dataRows = hasHeader ? rows.slice(1) : rows
  const now = Date.now()

  return dataRows
    .filter((cells) => cells[0] && cells[0] !== '0')
    .map((cells) => {
      const name = cells[0]
      const ingredients = cells
        .slice(1)
        .filter((c) => c && c !== '0' && c.toUpperCase() !== '#N/A')
        .map((c) => formatIngredientDisplay(c))
      return {
        name,
        source: 'manual' as const,
        ingredients,
        flaggedBreakout: true,
        createdAt: now,
        updatedAt: now,
      }
    })
}

export function importEliminationCsv(text: string): IngredientMeta[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  if (lines.length === 0) return []
  const rows = lines.map(parseCsvLine)
  const header = rows[0]?.map((c) => c.toLowerCase()) ?? []
  const hasHeader =
    header[0]?.includes('ingredient') ||
    header.includes('cleared') ||
    header.includes('clear?') ||
    header.includes('uncleared')

  const dataRows = hasHeader ? rows.slice(1) : rows
  const clearedIdx = header.findIndex(
    (h) => h === 'cleared' || h === 'clear?' || h === 'clear',
  )
  const notesIdx = header.findIndex((h) => h === 'notes' || h === 'note')
  const nameIdx =
    header.findIndex((h) => h === 'ingredient' || h === 'uncleared' || h === 'cleared ingredients') >= 0
      ? header.findIndex((h) => h === 'ingredient' || h === 'uncleared' || h === 'cleared ingredients')
      : 0

  const now = Date.now()
  const metas: IngredientMeta[] = []

  for (const cells of dataRows) {
    const displayName = cells[nameIdx] || cells[0]
    if (!displayName || displayName === '0' || displayName.toUpperCase() === '#N/A') {
      continue
    }
    const cleared =
      clearedIdx >= 0 ? truthy(cells[clearedIdx] ?? '') : false
    if (!cleared && clearedIdx >= 0) {
      // Sheet-style: only import cleared rows as meta when Clear? column exists
      // Still store uncleared suspects as uncleared meta for display names
    }
    metas.push({
      normalizedName: normalizeIngredient(displayName),
      displayName: formatIngredientDisplay(displayName),
      cleared,
      clearedAt: cleared ? now : undefined,
      note: notesIdx >= 0 ? cells[notesIdx] || undefined : undefined,
    })
  }

  return metas
}

/** Split a combined export or single-sheet CSV into products + metas. */
export function importCombinedCsv(text: string): ImportResult {
  const breakoutMatch = text.match(/#\s*Breakout\s*\n([\s\S]*?)(?=\n#\s*Elimination|$)/i)
  const eliminationMatch = text.match(/#\s*Elimination\s*\n([\s\S]*)$/i)

  if (breakoutMatch || eliminationMatch) {
    return {
      products: breakoutMatch ? importBreakoutCsv(breakoutMatch[1]) : [],
      metas: eliminationMatch ? importEliminationCsv(eliminationMatch[1]) : [],
    }
  }

  // Heuristic: if first column looks like Product header, treat as breakout wide CSV
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) ?? ''
  const cells = parseCsvLine(firstLine).map((c) => c.toLowerCase())
  if (cells[0] === 'product') {
    return { products: importBreakoutCsv(text), metas: [] }
  }
  if (cells.includes('cleared') || cells.includes('clear?') || cells[0] === 'uncleared') {
    return { products: [], metas: importEliminationCsv(text) }
  }

  // Fallback: treat as freeform paste of one product's ingredients is wrong here —
  // assume breakout-style rows without header
  return { products: importBreakoutCsv(text), metas: [] }
}

export function ingredientsFromText(text: string): string[] {
  return parseIngredients(text).map((p) => p.raw)
}
