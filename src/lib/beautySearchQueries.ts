/** Build several OBF search strings from a noisy retailer / Amazon title. */

const FLUFF = new Set(
  [
    'sunscreen',
    'sunblock',
    'moisturizer',
    'moisturising',
    'moisturizing',
    'lotion',
    'cream',
    'serum',
    'gel',
    'spray',
    'lightweight',
    'non',
    'comedogenic',
    'non-comedogenic',
    'fragrance',
    'free',
    'fragrance-free',
    'reef',
    'safe',
    'ultra',
    'fluid',
    'texture',
    'high',
    'uva',
    'uvb',
    'protection',
    'invisible',
    'matte',
    'finish',
    'water',
    'sweat',
    'resistant',
    'spf',
    'face',
    'body',
    'daily',
    'broad',
    'spectrum',
    'oz',
    'fl',
    'pack',
    'count',
    'with',
    'and',
    'for',
    'the',
    'new',
    'improved',
    'formulated',
    'irritated',
    'dermatologist',
    'recommended',
    'skincare',
    'hydrating',
    'dual',
    'textured',
    'pads',
    'cleanser',
    'cleansing',
    'foam',
    'milk',
  ].map((s) => s.toLowerCase()),
)

/** Product forms we keep for brand+form queries (e.g. Cetaphil Moisturizing Lotion). */
const PRODUCT_FORMS = [
  'moisturizing lotion',
  'moisturising lotion',
  'moisturizing cream',
  'body lotion',
  'face cream',
  'cleanser',
  'cleansing foam',
]

const PRODUCT_LINES = [
  'anthelios',
  'toleriane',
  'cicaplast',
  'effaclar',
  'lipikar',
  'pure vitamin',
  'hyalu b5',
  'retinol b3',
  'mineral 89',
  'double repair',
  'daily facial',
  'oil control',
  'zero pore',
]

const LRP_LINES = new Set([
  'anthelios',
  'toleriane',
  'cicaplast',
  'effaclar',
  'lipikar',
])

/** Fix common Amazon slug truncations and tidy for search/display. */
export function repairProductName(raw: string): string {
  let name = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(ml|oz|g|fl\.?\s*oz)\b/gi, ' ')
    .replace(/\bpack of\s*\d+\b/gi, ' ')
    .replace(/\bspf\s*\d+(\.\d+)?\b/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Amazon often drops the leading "La" from La Roche-Posay
  name = name.replace(/\broche\s*posay\b/gi, 'La Roche-Posay')
  name = name.replace(/\bla\s+la\s+roche-posay\b/gi, 'La Roche-Posay')

  return name.replace(/\s+/g, ' ').trim()
}

function detectLine(lower: string): string | null {
  for (const line of PRODUCT_LINES) {
    if (lower.includes(line)) return line
  }
  return null
}

function detectForm(lower: string): string | null {
  for (const form of PRODUCT_FORMS) {
    if (lower.includes(form)) return form
  }
  return null
}

export function buildBeautySearchQueries(rawName: string): string[] {
  const repaired = repairProductName(rawName)
  if (repaired.length < 4) return []

  const lower = repaired.toLowerCase()
  const line = detectLine(lower)
  const form = detectForm(lower)
  const hasCetaphil = /cetaphil/i.test(repaired)

  const queries: string[] = []

  // Prefer Brand + line first for La Roche-Posay
  if (line && LRP_LINES.has(line)) {
    queries.push(`La Roche-Posay ${line}`)
    queries.push(line)
  }

  // Brand + product form (keeps Cetaphil usable)
  if (hasCetaphil && form) {
    queries.push(`Cetaphil ${form}`)
  } else if (hasCetaphil) {
    queries.push('Cetaphil moisturizing lotion')
    queries.push('Cetaphil')
  }

  const tokens = repaired
    .split(/\s+/)
    .filter((t) => {
      const key = t.toLowerCase().replace(/\./g, '')
      if (key === 'vitamin') return true
      return t.length > 1 && !FLUFF.has(key)
    })

  const compact = tokens.join(' ').trim()
  if (compact) queries.push(compact)
  if (tokens.length > 4) {
    queries.push(tokens.slice(0, 4).join(' '))
  }

  // Amazon often drops "C" from "Vitamin C Booster" slugs
  if (/\bvitamin\b/i.test(repaired) && !/\bvitamin\s*c\b/i.test(repaired)) {
    const withC = repaired.replace(/\bvitamin\b/i, 'Vitamin C')
    queries.push(withC)
    const brand = repaired.split(/\s+/)[0]
    if (brand && /\bbooster\b/i.test(repaired)) {
      queries.unshift(`${brand} Vitamin C Booster Shot`)
      queries.unshift(`${brand} Vitamin C Booster`)
    } else if (brand) {
      queries.push(`${brand} Vitamin C`)
    }
  }

  // Brand + first product words (helps INCIDecoder search ranking)
  if (tokens.length >= 2) {
    queries.push(tokens.slice(0, 3).join(' '))
  }

  // Non-LRP product lines as additional search hints (after brand+compact)
  if (line && !LRP_LINES.has(line)) {
    if (/medicube/i.test(repaired)) {
      queries.push(`Medicube ${line}`)
    }
    queries.push(line)
  }

  // Deduplicate while preserving order
  const seen = new Set<string>()
  return queries.filter((q) => {
    const key = q.toLowerCase()
    if (seen.has(key) || key.length < 4) return false
    seen.add(key)
    return true
  })
}

/** Cleaner label for the UI (drops marketing fluff from Amazon slugs). */
export function cleanDisplayProductName(raw: string): string {
  const repaired = repairProductName(raw)
  const lower = repaired.toLowerCase()
  const line = detectLine(lower)
  const form = detectForm(lower)

  if (line && LRP_LINES.has(line)) {
    const titled = line
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `La Roche-Posay ${titled}`
  }

  if (/cetaphil/i.test(repaired) && form) {
    const titled = form
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `Cetaphil ${titled}`
  }

  if (/medicube/i.test(repaired) && line) {
    const titled = line
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `Medicube ${titled}`
  }

  const tokens = repaired
    .split(/\s+/)
    .filter((t) => {
      const key = t.toLowerCase().replace(/\./g, '')
      return t.length > 1 && !FLUFF.has(key)
    })
  if (tokens.length >= 2) return tokens.slice(0, 4).join(' ')

  const queries = buildBeautySearchQueries(raw)
  return queries[0] || repaired
}
