/** Ingredient text cleanup + plausibility gate (no deep app imports — safe for Pages Functions). */

const JUNK_PHRASES = [
  'all you need to know',
  "tout ce qu'il faut",
  'tout ce quil faut',
  'add to cart',
  'see more',
  'click here',
  'buy now',
  'free shipping',
  'customer reviews',
  'continue shopping',
  'savol',
]

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'you',
  'need',
  'know',
  'all',
  'what',
  'about',
])

/** Decode entities and normalize separators before quality checks / parsing. */
export function cleanupIngredientsText(text: string): string {
  let s = text
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n/g, '\n')

  s = s.replace(
    /^(?:.*?\b(?:fl\.?\s*oz|ml|g)\b.*?[\n:]|[\dA-Z]{2,}\s+\d+\s*ml.*?[\n:])+/gim,
    '',
  )
  s = s.replace(/^\s*\d+\s*m\b.*$/gim, '')
  s = s.replace(/\bINGREDIENTS?\s*[:\-–]?\s*/gi, '')

  s = s
    .replace(/[•●▪◦·]/g, ', ')
    .replace(/"\s*/g, ', ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  return s
}

/**
 * Split an INCI-style list on commas/semicolons without breaking:
 * - parenthetical notes: `3-O-Ethyl Ascorbic Acid(50,000Ppm)`
 * - numeric commas: `1,2-Hexanediol`, `50,000 ppm`
 */
export function splitIngredientList(text: string): string[] {
  const parts: string[] = []
  let buf = ''
  let depth = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!

    if (ch === '(' || ch === '[' || ch === '{') {
      depth++
      buf += ch
      continue
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1)
      buf += ch
      continue
    }

    if ((ch === ',' || ch === ';') && depth === 0) {
      // Keep thousand separators / INCI positional numbers (1,2-Hexanediol, 50,000)
      if (ch === ',' && /\d/.test(text[i - 1] ?? '')) {
        const rest = text.slice(i + 1)
        // Immediate digit: 1,2-Hexanediol or 50,000Ppm
        if (/^\d/.test(rest)) {
          buf += ch
          continue
        }
        // Spaced thousands before a unit: "1, 740Ppm" (not "B12, 3-O-Ethyl")
        if (/^\s+\d{3}(?:\D|$)/.test(rest)) {
          buf += ch
          continue
        }
      }
      const trimmed = buf.replace(/\.$/, '').trim()
      if (trimmed.length > 1) parts.push(trimmed)
      buf = ''
      continue
    }

    buf += ch
  }

  const trimmed = buf.replace(/\.$/, '').trim()
  if (trimmed.length > 1) parts.push(trimmed)
  return parts
}

/**
 * Reject crowdsourced / OCR dumps that are clearly not INCI lists.
 * Used before accepting Open Beauty Facts fallback text.
 */
export function isPlausibleIngredientsText(text: string): boolean {
  const cleaned = cleanupIngredientsText(text)
  if (cleaned.length < 20) return false

  const lower = cleaned.toLowerCase()
  if (JUNK_PHRASES.some((p) => lower.includes(p))) return false

  const parsed = splitIngredientList(cleaned)
  if (parsed.length < 4) return false

  if (parsed.some((p) => p.length > 72)) return false

  let sentenceLike = 0
  for (const item of parsed) {
    const words = item.toLowerCase().split(/\s+/).filter(Boolean)
    const stops = words.filter((w) => STOPWORDS.has(w)).length
    if (stops >= 3) sentenceLike++
  }
  if (sentenceLike >= 2) return false

  const chemicalHits = parsed.filter((p) =>
    /\b(aqua|water|glycerin|acid|oxide|extract|oil|dimethicone|alcohol|glycol|stearate|palmitate|niacinamide)\b/i.test(
      p,
    ),
  ).length
  if (chemicalHits < 1 && parsed.length < 8) return false

  return true
}
