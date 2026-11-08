import { buildBeautySearchQueries } from './beautySearchQueries.ts'
import {
  cleanupIngredientsText,
  isPlausibleIngredientsText,
} from './ingredientsQuality.ts'

const UA = 'Patchwork/1.0 (+https://example.com/support; skincare ingredient lookup)'

export interface InciDecoderHit {
  name: string
  ingredientsText: string
  sourceUrl: string
  imageUrl?: string
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

function isInciDecoderChromeImage(url: string): boolean {
  return (
    /incidecoder-assets\.storage\.googleapis\.com/i.test(url) ||
    /\/assets\/icons\//i.test(url) ||
    /mstile|favicon|apple-touch|idlogo/i.test(url)
  )
}

/**
 * Pack shot from an INCIDecoder product page.
 * Prefer the real front_photo CDN asset — og:image is often the site tile icon.
 */
export function extractInciDecoderImageUrl(html: string): string | undefined {
  const fromImg = html.match(
    /<img[^>]+src=["'](https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"']+_front_photo[^"']+)["']/i,
  )?.[1]
  if (fromImg) return decodeEntities(fromImg)

  const candidates = [
    ...html.matchAll(
      /https:\/\/incidecoder-content\.storage\.googleapis\.com\/[^"'\s>]+_front_photo[^"'\s>]*/gi,
    ),
  ].map((m) => decodeEntities(m[0]))

  const preferred =
    candidates.find((u) => /_front_photo_original\.(jpe?g|png)$/i.test(u)) ||
    candidates.find((u) => /_front_photo_300x300@1x\.jpe?g$/i.test(u)) ||
    candidates.find((u) => /_front_photo_300x300@1x\.webp$/i.test(u)) ||
    candidates[0]
  if (preferred) return preferred

  const raw = extractMeta(html, 'og:image')
  if (!raw) return undefined
  const decoded = decodeEntities(raw)
  if (!decoded || isInciDecoderChromeImage(decoded)) return undefined
  return decoded
}

/** Extract ordered INCI names from an INCIDecoder product HTML page. */
export function extractInciDecoderIngredients(html: string): string {
  const meta = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
  )
  if (meta?.[1]) {
    const content = decodeEntities(meta[1])
    const after = content.replace(/^.*?ingredients explained:\s*/i, '').trim()
    if (after.length > 20 && (after.match(/,/g) || []).length >= 3) {
      return cleanupIngredientsText(after)
    }
  }

  const short = html.match(
    /id=["']ingredlist-short["'][\s\S]*?<\/div>\s*<\/div>/i,
  )
  const block = short?.[0] || html
  const names: string[] = []
  const seen = new Set<string>()
  for (const m of block.matchAll(
    /href=["']\/ingredients\/[^"']+["'][^>]*>([^<]+)</gi,
  )) {
    const name = decodeEntities(m[1]).trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    // Skip nav noise
    if (/^(products|ingredients|decode|login|register)$/i.test(name)) continue
    seen.add(key)
    names.push(name)
    if (names.length >= 80) break
  }
  return cleanupIngredientsText(names.join(', '))
}

export function extractInciDecoderProductName(html: string): string {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || ''
  return decodeEntities(title)
    .replace(/\s*ingredients\s*\(explained\)\s*$/i, '')
    .replace(/\s*[|\-–—].*$/, '')
    .trim()
}

function scoreProductPath(path: string, query: string): number {
  const slug = path.replace(/^\/products\//, '').toLowerCase()
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
  let score = tokens.reduce((n, t) => n + (slug.includes(t) ? 1 : 0), 0)
  // Strongly prefer results that include the brand (first query token)
  const brand = tokens[0]
  if (brand && slug.startsWith(brand)) score += 5
  else if (brand && slug.includes(brand)) score += 2
  // Prefer shorter / more exact product slugs over long marketing URLs
  score += Math.max(0, 3 - Math.floor(slug.length / 40))
  return score
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const SEARCH_HOSTS = [
  'https://incidecoder.com',
  'https://inkeedecoder.com',
] as const

/** Resolve a product by name via INCIDecoder / INKEEDecoder search → product page. */
export async function searchInciDecoder(
  query: string,
): Promise<InciDecoderHit | null> {
  const variants = buildBeautySearchQueries(query)
  const toTry = variants.length > 0 ? variants : [query.trim()].filter(Boolean)
  // Also try the raw query lightly cleaned (keeps booster / shot wording Amazon may omit "C" from)
  const rawish = query.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (rawish && !toTry.some((q) => q.toLowerCase() === rawish.toLowerCase())) {
    toTry.push(rawish)
  }

  for (const variant of toTry) {
    for (const host of SEARCH_HOSTS) {
      const searchUrl =
        `${host}/search?` + new URLSearchParams({ query: variant }).toString()
      const searchHtml = await fetchHtml(searchUrl)
      if (!searchHtml) continue

      const paths = [
        ...searchHtml.matchAll(/href="(\/products\/[^"#?]+)"/gi),
      ]
        .map((m) => m[1])
        .filter((p) => !p.endsWith('/create'))

      const unique = [...new Set(paths)]
      unique.sort(
        (a, b) => scoreProductPath(b, variant) - scoreProductPath(a, variant),
      )

      const brand = variant
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .find((t) => t.length > 2)

      for (const path of unique.slice(0, 6)) {
        // Skip clearly off-brand results when we know the brand token
        if (brand && !path.toLowerCase().includes(brand)) continue

        const productUrl = `${host}${path}`
        const html = await fetchHtml(productUrl)
        if (!html) continue
        const ingredientsText = extractInciDecoderIngredients(html)
        if (!ingredientsText || !isPlausibleIngredientsText(ingredientsText)) {
          continue
        }
        const extractedName = extractInciDecoderProductName(html)
        const name =
          extractedName.length >= 8 && !/^la roche$/i.test(extractedName)
            ? extractedName
            : variant
        return {
          name,
          ingredientsText,
          sourceUrl: productUrl,
          imageUrl: extractInciDecoderImageUrl(html),
        }
      }
    }
  }

  return null
}

/** If the user pasted an INCIDecoder product URL, scrape that page directly. */
export async function fetchInciDecoderProductUrl(
  url: string,
): Promise<InciDecoderHit | null> {
  try {
    const parsed = new URL(url)
    if (!/incidecoder\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) {
      // also allow inkeedecoder if they rebrand redirects
      if (!/inkeedecoder\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) {
        return null
      }
    }
    if (!parsed.pathname.includes('/products/')) return null
    const html = await fetchHtml(parsed.toString())
    if (!html) return null
    const ingredientsText = extractInciDecoderIngredients(html)
    if (!ingredientsText || !isPlausibleIngredientsText(ingredientsText)) {
      return null
    }
    return {
      name: extractInciDecoderProductName(html),
      ingredientsText,
      sourceUrl: parsed.toString(),
      imageUrl: extractInciDecoderImageUrl(html),
    }
  } catch {
    return null
  }
}
