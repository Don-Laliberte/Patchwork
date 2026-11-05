import { PRODUCT_URL_WORKER_PATH } from '../config/support'
import { cleanDisplayProductName } from './beautySearchQueries'
import {
  cleanupIngredientsText,
  isPlausibleIngredientsText,
} from './ingredientsQuality'
import { searchOpenBeautyFacts } from './openBeautyFacts'
import {
  canonicalizeProductUrl,
  productNameFromAmazonUrl,
} from './urlProductHints'

export interface UrlIngestResult {
  name: string
  ingredientsText: string
  sourceUrl: string
  imageUrl?: string
  warning?: string
  blocked?: boolean
}

export class UrlIngestError extends Error {
  nameHint?: string
  sourceUrl?: string
  blocked?: boolean

  constructor(
    message: string,
    opts?: { nameHint?: string; sourceUrl?: string; blocked?: boolean },
  ) {
    super(message)
    this.name = 'UrlIngestError'
    this.nameHint = opts?.nameHint
    this.sourceUrl = opts?.sourceUrl
    this.blocked = opts?.blocked
  }
}

export async function fetchProductFromUrl(url: string): Promise<UrlIngestResult> {
  const original = url.trim()
  const canonical = canonicalizeProductUrl(original)
  // IMPORTANT: parse the slug from the original URL — canonical Amazon URLs drop it
  const localHint = productNameFromAmazonUrl(original)
  const localName = localHint?.name
    ? cleanDisplayProductName(localHint.name)
    : ''

  // Send the original URL so the worker can also recover the product title slug
  const endpoint = `${PRODUCT_URL_WORKER_PATH}?url=${encodeURIComponent(original)}`
  const res = await fetch(endpoint)
  const raw = await res.text()
  let data: Partial<UrlIngestResult> & { error?: string; name?: string } = {}
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    // fall through to client OBF recovery below
    data = { error: raw || `URL fetch failed (${res.status})` }
  }

  let name =
    (data.name && !/^Amazon product\b/i.test(data.name)
      ? cleanDisplayProductName(data.name)
      : '') ||
    localName ||
    ''
  let ingredientsText = data.ingredientsText || ''
  let imageUrl = data.imageUrl
  let warning = data.warning
  const blocked = Boolean(data.blocked) || !res.ok

  if (ingredientsText) {
    ingredientsText = cleanupIngredientsText(ingredientsText)
    if (!isPlausibleIngredientsText(ingredientsText)) {
      ingredientsText = ''
      warning = [
        warning,
        'Crowdsourced ingredient text looked unreliable, so it was discarded.',
      ]
        .filter(Boolean)
        .join(' ')
    }
  }

  // Client-side OBF fallback when worker couldn't get ingredients
  // (INCIDecoder is worker-only — no browser CORS)
  if (!ingredientsText && name) {
    try {
      const obf = await searchOpenBeautyFacts(name)
      if (obf?.ingredientsText) {
        ingredientsText = cleanupIngredientsText(obf.ingredientsText)
        if (isPlausibleIngredientsText(ingredientsText)) {
          if (!imageUrl && obf.imageUrl) imageUrl = obf.imageUrl
          warning = [
            warning,
            'Ingredients came from Open Beauty Facts (verify against your bottle — formulas vary by region).',
          ]
            .filter(Boolean)
            .join(' ')
        } else {
          ingredientsText = ''
        }
      }
    } catch {
      // ignore; user can paste
    }
  }

  if (ingredientsText) {
    return {
      name: name || localName || 'Untitled product',
      ingredientsText,
      sourceUrl: data.sourceUrl || canonical,
      imageUrl,
      warning,
      blocked,
    }
  }

  throw new UrlIngestError(
    data.error ||
      (blocked
        ? 'This store blocked automated lookup, and no reliable ingredient list was found in crowdsourced data. Paste or photo the label to finish — retailer pages and public databases are often incomplete or wrong.'
        : 'No reliable ingredient list found for that link. Paste or photo the label instead — crowdsourced databases are often incomplete.'),
    {
      nameHint: name || localName || undefined,
      sourceUrl: data.sourceUrl || canonical,
      blocked,
    },
  )
}
