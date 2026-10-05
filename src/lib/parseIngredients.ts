import { splitIngredientList } from './ingredientsQuality'
import {
  displayFromNormalized,
  normalizeIngredient,
} from './normalizeIngredient'

export interface ParsedIngredient {
  raw: string
  normalized: string
}

const HEADER_RE =
  /^(ingredients?|inci|composition|liste des ingrédients|ingredientes)\s*[:\-–]?\s*/i

export function stripIngredientsHeader(text: string): string {
  return text.replace(HEADER_RE, '').trim()
}

/**
 * Split label / paste text into ordered unique ingredients.
 * Display strings use standard Title Case; matching uses normalized keys.
 */
export function parseIngredients(text: string): ParsedIngredient[] {
  const cleaned = stripIngredientsHeader(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ', ')

  const chunks = splitIngredientList(cleaned)
    .map((part) =>
      part
        .replace(/^\s*[\d]+[.)]\s*/, '')
        .replace(/^\s*[-–—*•]+\s*/, '')
        .replace(/\.$/, '')
        .trim(),
    )
    .filter((part) => part.length > 1)

  const seen = new Set<string>()
  const out: ParsedIngredient[] = []

  for (const chunk of chunks) {
    const normalized = normalizeIngredient(chunk)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push({
      raw: displayFromNormalized(normalized, chunk),
      normalized,
    })
  }

  return out
}

export function ingredientsToRawList(items: ParsedIngredient[]): string[] {
  return items.map((i) => i.raw)
}
