/** Small INCI alias map — keys and values are already normalized. */
const ALIASES: Record<string, string> = {
  aqua: 'water',
  eau: 'water',
  'water aqua': 'water',
  'water aqua eau': 'water',
  glycerine: 'glycerin',
  parfum: 'fragrance',
  aroma: 'fragrance',
  'tocopheryl acetate': 'tocopherol',
  'vitamin e': 'tocopherol',
  'vitamin c': 'ascorbic acid',
  'ci 77891': 'titanium dioxide',
  'ci 77491': 'iron oxides',
  'ci 77492': 'iron oxides',
  'ci 77499': 'iron oxides',
}

/** Canonical Title Case labels for known normalized keys. */
const CANONICAL_DISPLAY: Record<string, string> = {
  water: 'Water',
  glycerin: 'Glycerin',
  fragrance: 'Fragrance',
  tocopherol: 'Tocopherol',
  'ascorbic acid': 'Ascorbic Acid',
  'titanium dioxide': 'Titanium Dioxide',
  'iron oxides': 'Iron Oxides',
}

const UPPERCASE_TOKENS = new Set([
  'peg',
  'ppg',
  'ci',
  'dna',
  'rna',
  'uv',
  'spf',
  'pha',
  'aha',
  'bha',
  'edta',
  'pca',
  'bht',
  'bha',
])

function cleanupWhitespace(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[•●▪◦·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeIngredient(raw: string): string {
  let s = cleanupWhitespace(raw)
    .replace(/\s*[\\/|]\s*/g, ' ')
    .toLowerCase()

  // Whole ingredient wrapped in parens (marketing extracts) — unwrap, don't discard
  const wholeParen = s.match(/^\((.*)\)$/)
  if (wholeParen) {
    s = wholeParen[1]!.trim()
  } else {
    // Drop trailing parenthetical notes often found on labels (matching only)
    s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  }

  // Drop trailing concentration notes for matching (1,740ppm / 1, 740 Ppm / 10ppm)
  const withoutThousands = s.replace(
    /\s*\d{1,3}(?:,\s*\d{3})+(?:\.\d+)?\s*(?:ppm|ppb|%)\s*$/i,
    '',
  )
  s =
    withoutThousands !== s
      ? withoutThousands.trim()
      : s.replace(/\s*\d+(?:\.\d+)?\s*(?:ppm|ppb|%)\s*$/i, '').trim()

  if (ALIASES[s]) return ALIASES[s]

  // Prefer first token group for multi-language water lines already split
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && parts.includes('water') && parts.includes('aqua')) {
    return 'water'
  }

  return ALIASES[s] ?? s
}

function titleCaseWord(word: string): string {
  if (!word) return word

  // Preserve parenthetical chunks by formatting inside
  if (word.startsWith('(') && word.endsWith(')')) {
    const inner = word.slice(1, -1)
    return `(${inner
      .split(/\s+/)
      .map((w) => titleCaseWord(w))
      .join(' ')})`
  }

  // Hyphenated compounds: peg-100, c12-15, acrylate/c10-30
  if (word.includes('-') || word.includes('/')) {
    return word
      .split(/([-/])/)
      .map((part) => {
        if (part === '-' || part === '/') return part
        return titleCaseWord(part)
      })
      .join('')
  }

  const lower = word.toLowerCase()

  if (UPPERCASE_TOKENS.has(lower)) {
    return lower.toUpperCase()
  }

  // Carbon chains: c12 → C12
  if (/^c\d/i.test(word)) {
    return `C${word.slice(1)}`
  }

  // Pure / leading numbers keep digits (PEG-100 already split)
  if (/^\d/.test(word)) {
    return word
  }

  // PEG100 without hyphen
  if (/^(peg|ppg)\d/i.test(word)) {
    return word.replace(/^(peg|ppg)/i, (m) => m.toUpperCase())
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * INCI-style Title Case for UI storage/display.
 * Matching still uses {@link normalizeIngredient}; this is aesthetics only.
 */
export function formatIngredientDisplay(raw: string): string {
  let cleaned = cleanupWhitespace(raw)
  if (!cleaned) return ''

  // Unwrap marketing extracts that arrived as a sole parenthetical token
  const wholeParen = cleaned.match(/^\((.*)\)$/)
  if (wholeParen) cleaned = wholeParen[1]!.trim()

  const normalized = normalizeIngredient(cleaned)
  if (CANONICAL_DISPLAY[normalized]) {
    return CANONICAL_DISPLAY[normalized]
  }

  // For slash-separated multi-language water lines, show canonical Water
  if (normalized === 'water') {
    return 'Water'
  }

  // Keep useful parentheticals; format the whole phrase
  // Unify odd separators to spaces for display of multi-lang water already handled
  const forDisplay = cleaned.replace(/\s*[\\|]\s*/g, ' / ')

  return forDisplay
    .split(/\s+/)
    .map((word) => titleCaseWord(word))
    .join(' ')
}

/** Prefer canonical/formatted display for a normalized key + optional raw sample. */
export function displayFromNormalized(
  normalized: string,
  rawFallback: string,
): string {
  if (CANONICAL_DISPLAY[normalized]) {
    return CANONICAL_DISPLAY[normalized]
  }
  if (rawFallback.trim()) {
    return formatIngredientDisplay(rawFallback)
  }
  return formatIngredientDisplay(normalized)
}
