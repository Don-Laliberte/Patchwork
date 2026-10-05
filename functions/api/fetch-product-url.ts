/**
 * Cloudflare Pages Function: fetch a product page and extract ingredients text.
 * Amazon and similar stores often block bots — we detect that, recover a name
 * from the URL slug, and fall back to INCIDecoder then Open Beauty Facts.
 */

import {
  canonicalizeProductUrl,
  isAmazonHost,
  productNameFromAmazonUrl,
} from '../../src/lib/urlProductHints.ts'
import {
  buildBeautySearchQueries,
  cleanDisplayProductName,
} from '../../src/lib/beautySearchQueries.ts'
import {
  cleanupIngredientsText,
  isPlausibleIngredientsText,
} from '../../src/lib/ingredientsQuality.ts'
import {
  extractInciDecoderIngredients,
  extractInciDecoderProductName,
  fetchInciDecoderProductUrl,
  searchInciDecoder,
} from '../../src/lib/inciDecoder.ts'

export async function onRequestGet(context: {
  request: Request
}): Promise<Response> {
  const requestUrl = new URL(context.request.url)
  const target = requestUrl.searchParams.get('url')

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  }

  if (!target) {
    return json({ error: 'Missing url query parameter' }, 400, cors)
  }

  let parsed: URL
  try {
    parsed = new URL(canonicalizeProductUrl(target))
  } catch {
    return json({ error: 'Invalid url' }, 400, cors)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'Only http(s) URLs allowed' }, 400, cors)
  }

  // Read the slug from the original URL before canonicalizing to /dp/ASIN
  const amazonHint =
    productNameFromAmazonUrl(target) || productNameFromAmazonUrl(parsed.toString())
  let name = amazonHint?.name ? cleanDisplayProductName(amazonHint.name) : ''
  let ingredientsText = ''
  let warning: string | undefined
  let blocked = false

  // Direct INCIDecoder product URL
  const inciDirect = await fetchInciDecoderProductUrl(target)
  if (inciDirect?.ingredientsText) {
    return json(
      {
        name:
          (inciDirect.name && inciDirect.name.length >= 8
            ? inciDirect.name
            : name) || 'Untitled product',
        ingredientsText: inciDirect.ingredientsText,
        sourceUrl: inciDirect.sourceUrl,
        warning:
          'Ingredients came from INCIDecoder (verify against your bottle — formulas vary by region).',
      },
      200,
      cors,
    )
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    })

    if (!upstream.ok) {
      blocked = true
      warning = `Store returned ${upstream.status}.`
    } else {
      const html = await upstream.text()
      if (looksBlocked(html)) {
        blocked = true
        warning = isAmazonHost(parsed.hostname)
          ? 'Amazon blocks automated ingredient lookups (captcha / bot check).'
          : 'This store blocked automated page access.'
      } else {
        name = cleanProductName(decodeEntities(extractTitle(html))) || name
        // Prefer INCIDecoder-specific extraction when applicable
        const host = parsed.hostname.replace(/^www\./, '')
        if (/incidecoder\.com$/i.test(host) || /inkeedecoder\.com$/i.test(host)) {
          ingredientsText = extractInciDecoderIngredients(html)
          name = extractInciDecoderProductName(html) || name
        } else {
          ingredientsText = extractIngredients(html)
        }
      }
    }
  } catch (err) {
    blocked = true
    warning =
      err instanceof Error ? err.message : 'Could not reach the product page.'
  }

  // INCIDecoder search (usually cleaner than OBF for skincare SKUs)
  if (!ingredientsText && name) {
    try {
      const inci = await searchInciDecoder(name)
      if (inci?.ingredientsText) {
        ingredientsText = inci.ingredientsText
        // Catalog title is usually better than Amazon slug (e.g. "Vitamin C" vs "Vitamin")
        if (inci.name?.trim()) name = inci.name
        warning = [
          warning,
          'Ingredients came from INCIDecoder (verify against your bottle — formulas vary by region).',
        ]
          .filter(Boolean)
          .join(' ')
      }
    } catch {
      // continue to OBF
    }
  }

  // Open Beauty Facts fallback
  if (!ingredientsText && name) {
    const obf = await searchOpenBeautyFacts(name)
    if (obf?.ingredientsText) {
      ingredientsText = obf.ingredientsText
      warning = [
        warning,
        'Ingredients came from Open Beauty Facts (verify against your bottle — formulas vary by region).',
      ]
        .filter(Boolean)
        .join(' ')
    }
  }

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

  if (ingredientsText) {
    return json(
      {
        name: name || 'Untitled product',
        ingredientsText,
        sourceUrl: parsed.toString(),
        warning,
        blocked,
      },
      200,
      cors,
    )
  }

  return json(
    {
      error: blocked
        ? `${warning || 'This page blocked automated access.'} ${
            name
              ? 'No reliable ingredient list was found in crowdsourced data. Paste or photo the label to finish.'
              : 'Paste or photo the ingredients list to finish.'
          }`
        : 'Could not find a reliable ingredients list on that page. Try paste or photo instead.',
      name: name || undefined,
      sourceUrl: parsed.toString(),
      blocked,
      warning,
    },
    422,
    cors,
  )
}

function json(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function looksBlocked(html: string): boolean {
  const sample = html.slice(0, 8000).toLowerCase()
  return (
    sample.includes('validatecaptcha') ||
    sample.includes('api-services-support@amazon.com') ||
    sample.includes('automated access to amazon') ||
    sample.includes('enter the characters you see') ||
    (html.length < 12000 && sample.includes('captcha'))
  )
}

function cleanProductName(title: string): string {
  return title
    .replace(/\s*[|:].*Amazon.*$/i, '')
    .replace(/\s*[-–—].*Amazon.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMeta(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  return (html.match(re)?.[1] || html.match(re2)?.[1] || '').trim()
}

function extractTitle(html: string): string {
  const og = extractMeta(html, 'og:title')
  if (og) return og
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return (m?.[1] || '').replace(/\s+/g, ' ').trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function extractIngredients(html: string): string {
  const scriptBlocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
  for (const block of scriptBlocks) {
    try {
      const data = JSON.parse(block[1])
      const nodes = Array.isArray(data)
        ? data
        : [data, ...((data as { '@graph'?: unknown[] })['@graph'] || [])]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const record = node as Record<string, unknown>
        const ingredients = record.ingredients || record.ingredient
        if (typeof ingredients === 'string' && ingredients.length > 10) {
          return decodeEntities(ingredients)
        }
      }
    } catch {
      // continue
    }
  }

  // Amazon "Important Information" / ingredients modules when present
  const amazonPatterns = [
    /id=["']important-information["'][\s\S]{0,2000}?ingredients?\s*[:\-–]?\s*([\s\S]{20,5000}?)(?:<\/(?:div|span|p|td|li|section)>)/i,
    /data-feature-name=["']ingredients["'][\s\S]{0,500}?>([\s\S]{20,5000}?)<\//i,
    /class=["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]{20,5000}?)<\//i,
  ]

  for (const re of amazonPatterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const text = stripTags(m[1])
      if (looksLikeIngredientList(text)) return text
    }
  }

  const patterns = [
    /ingredients?\s*[:\-–]\s*([\s\S]{20,5000}?)(?:<\/(?:p|div|span|li|td|section)>|\n\n)/i,
    /inci\s*[:\-–]\s*([\s\S]{20,5000}?)(?:<\/(?:p|div|span|li|td|section)>|\n\n)/i,
    /itemprop=["']ingredient["'][^>]*>([\s\S]*?)</i,
  ]

  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) {
      const text = stripTags(m[1])
      if (looksLikeIngredientList(text)) return text
    }
  }

  return ''
}

function looksLikeIngredientList(text: string): boolean {
  if (text.length < 20) return false
  const lower = text.toLowerCase()
  // Marketing blurbs mention "ingredient" without being an INCI list
  if (
    lower.includes('hydrating ingredient system') ||
    (lower.includes('key ingredients') && !lower.includes(','))
  ) {
    return false
  }
  const commaCount = (text.match(/,/g) || []).length
  return commaCount >= 3 || /\baqua\b|\bwater\b/i.test(text)
}

interface ObfSearchHit {
  name: string
  ingredientsText: string
}

async function searchOpenBeautyFacts(
  query: string,
): Promise<ObfSearchHit | null> {
  const variants = buildBeautySearchQueries(query)
  const toTry =
    variants.length > 0
      ? variants
      : [
          query
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        ]

  for (const cleaned of toTry) {
    if (cleaned.length < 4) continue
    const url =
      'https://world.openbeautyfacts.org/cgi/search.pl?' +
      new URLSearchParams({
        search_terms: cleaned,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: '12',
      }).toString()

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Patchwork/1.0 (+https://example.com/support)',
        },
      })
      if (!res.ok) continue
      const data = (await res.json()) as {
        products?: Array<{
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
          const nameHits = queryTokens.reduce(
            (n, t) => n + (nameLower.includes(t) ? 1 : 0),
            0,
          )
          return {
            name,
            ingredientsText,
            score: (ingredientsText.length > 20 ? 10 : 0) + nameHits * 3,
            nameHits,
          }
        })
        .filter(
          (p) =>
            p.ingredientsText.length > 20 &&
            p.nameHits >= 1 &&
            isPlausibleIngredientsText(p.ingredientsText),
        )
        .sort((a, b) => b.score - a.score)

      if (ranked[0]) {
        return {
          name: ranked[0].name || cleaned,
          ingredientsText: ranked[0].ingredientsText,
        }
      }
    } catch {
      // try next variant
    }
  }

  return null
}
