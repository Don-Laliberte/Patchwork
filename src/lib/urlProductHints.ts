/** Hints derived from a product URL when the page itself cannot be scraped. */

export function isAmazonHost(hostname: string): boolean {
  return /(^|\.)amazon\.(ca|com|co\.uk|de|fr|it|es|co\.jp|com\.au|in)$/i.test(
    hostname,
  )
}

const ASIN_RE = /(?:^|\/)(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i
const SLUG_BEFORE_DP_RE =
  /\/([^/]+)\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i

/** `/Brand-Product-Name/dp/ASIN` → "Brand Product Name" */
export function productNameFromAmazonUrl(url: string): {
  name: string
  asin: string
} | null {
  try {
    const parsed = new URL(url)
    if (!isAmazonHost(parsed.hostname)) return null

    const slugMatch = parsed.pathname.match(SLUG_BEFORE_DP_RE)
    if (slugMatch) {
      const asin = slugMatch[2].toUpperCase()
      const slug = decodeURIComponent(slugMatch[1])
      // Ignore language / junk segments that aren't product titles
      if (!/^(gp|dp|product|d|en|fr|ca|gp)$/i.test(slug) && slug.includes('-')) {
        const name = slug
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim()
        return { name, asin }
      }
      return { name: '', asin }
    }

    const asinMatch = parsed.pathname.match(ASIN_RE) || url.match(ASIN_RE)
    if (!asinMatch) return null
    return { name: '', asin: asinMatch[1].toUpperCase() }
  } catch {
    return null
  }
}

/** Canonicalize noisy retailer URLs (drop tracking params). */
export function canonicalizeProductUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (isAmazonHost(parsed.hostname)) {
      const asinMatch =
        parsed.pathname.match(ASIN_RE) || parsed.href.match(ASIN_RE)
      if (asinMatch) {
        return `${parsed.origin}/dp/${asinMatch[1].toUpperCase()}`
      }
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}
