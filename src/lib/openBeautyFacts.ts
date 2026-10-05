import { db } from '../db/schema'
import { buildBeautySearchQueries } from './beautySearchQueries'
import {
  cleanupIngredientsText,
  isPlausibleIngredientsText,
} from './ingredientsQuality'

const USER_AGENT = 'Patchwork/1.0 (https://example.com/support; local-first skincare tracker)'

export interface BeautyProductLookup {
  barcode: string
  name: string
  ingredientsText: string
  found: boolean
}

interface ObfResponse {
  status: number
  product?: {
    product_name?: string
    product_name_en?: string
    generic_name?: string
    ingredients_text?: string
    ingredients_text_en?: string
    ingredients?: Array<{ text?: string; id?: string }>
  }
}

export async function lookupOpenBeautyFacts(
  barcode: string,
): Promise<BeautyProductLookup> {
  const cached = await db.barcodeCache.get(barcode)
  if (cached) {
    const cleaned = cleanupIngredientsText(cached.ingredientsText)
    if (
      cached.ingredientsText &&
      !isPlausibleIngredientsText(cached.ingredientsText)
    ) {
      return { barcode, name: cached.name, ingredientsText: '', found: false }
    }
    return {
      barcode,
      name: cached.name,
      ingredientsText: cleaned || cached.ingredientsText,
      found: Boolean(cached.name || cleaned),
    }
  }

  const url = `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Patchwork-Client': USER_AGENT,
    },
  })

  if (!res.ok) {
    return { barcode, name: '', ingredientsText: '', found: false }
  }

  const data = (await res.json()) as ObfResponse
  if (data.status !== 1 || !data.product) {
    return { barcode, name: '', ingredientsText: '', found: false }
  }

  const product = data.product
  const name =
    product.product_name?.trim() ||
    product.product_name_en?.trim() ||
    product.generic_name?.trim() ||
    ''

  let ingredientsText =
    product.ingredients_text?.trim() ||
    product.ingredients_text_en?.trim() ||
    ''

  if (!ingredientsText && product.ingredients?.length) {
    ingredientsText = product.ingredients
      .map((i) => i.text || i.id?.replace(/^en:/, '') || '')
      .filter(Boolean)
      .join(', ')
  }

  ingredientsText = cleanupIngredientsText(ingredientsText)
  if (ingredientsText && !isPlausibleIngredientsText(ingredientsText)) {
    ingredientsText = ''
  }

  if (name || ingredientsText) {
    await db.barcodeCache.put({
      barcode,
      name,
      ingredientsText,
      cachedAt: Date.now(),
    })
  }

  return {
    barcode,
    name,
    ingredientsText,
    found: Boolean(name || ingredientsText),
  }
}

export interface BeautySearchHit {
  name: string
  ingredientsText: string
  code?: string
}

async function searchOnce(cleaned: string): Promise<BeautySearchHit | null> {
  if (cleaned.length < 4) return null

  const url =
    'https://world.openbeautyfacts.org/cgi/search.pl?' +
    new URLSearchParams({
      search_terms: cleaned,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '12',
    }).toString()

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Patchwork-Client': USER_AGENT,
    },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    products?: Array<{
      code?: string
      product_name?: string
      ingredients_text?: string
      ingredients_text_en?: string
    }>
  }

  const queryTokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const ranked = (data.products || [])
    .map((p) => {
      const rawText =
        p.ingredients_text?.trim() || p.ingredients_text_en?.trim() || ''
      const ingredientsText = cleanupIngredientsText(rawText)
      const name = p.product_name?.trim() || ''
      const nameLower = name.toLowerCase()
      const hay = `${name} ${ingredientsText}`.toLowerCase()
      const nameHits = queryTokens.reduce(
        (n, t) => n + (nameLower.includes(t) ? 1 : 0),
        0,
      )
      const score =
        (ingredientsText.length > 20 ? 10 : 0) +
        nameHits * 3 +
        queryTokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
      return { name, ingredientsText, code: p.code, score, nameHits }
    })
    .filter(
      (p) =>
        p.ingredientsText.length > 20 &&
        p.nameHits >= 1 &&
        isPlausibleIngredientsText(p.ingredientsText),
    )
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best) return null
  return {
    name: best.name || cleaned,
    ingredientsText: best.ingredientsText,
    code: best.code,
  }
}

/**
 * Text search when we have a product title but no barcode / blocked retailer page.
 * Tries several cleaned query variants (Amazon slugs are noisy).
 * Rejects corrupted ingredient dumps.
 */
export async function searchOpenBeautyFacts(
  query: string,
): Promise<BeautySearchHit | null> {
  const variants = buildBeautySearchQueries(query)
  if (variants.length === 0) {
    return searchOnce(
      query
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }

  for (const variant of variants) {
    const hit = await searchOnce(variant)
    if (hit) return hit
  }
  return null
}
