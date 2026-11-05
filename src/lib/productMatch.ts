import type { Product } from '../db/schema'

interface Identity {
  name: string
  barcode?: string
}

/** Name key for duplicate checks. Ignores case, ®/™, and punctuation. */
export function normalizeProductName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Barcode key. Short or empty values do not count as an identity. */
export function normalizeBarcode(barcode: string | undefined): string {
  const digits = (barcode ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : ''
}

function find(parent: number[], index: number): number {
  let current = index
  while (parent[current] !== current) {
    parent[current] = parent[parent[current]!]!
    current = parent[current]!
  }
  return current
}

function union(parent: number[], a: number, b: number) {
  const rootA = find(parent, a)
  const rootB = find(parent, b)
  if (rootA !== rootB) parent[rootA] = rootB
}

/**
 * Products that share a normalized name or a barcode are one product,
 * including chains (same name as A, same barcode as B).
 */
export function clusterByIdentity<T extends Identity>(products: T[]): T[][] {
  const parent = products.map((_, index) => index)
  const byName = new Map<string, number>()
  const byBarcode = new Map<string, number>()

  products.forEach((product, index) => {
    const name = normalizeProductName(product.name)
    if (name) {
      const previous = byName.get(name)
      if (previous == null) byName.set(name, index)
      else union(parent, previous, index)
    }
    const barcode = normalizeBarcode(product.barcode)
    if (barcode) {
      const previous = byBarcode.get(barcode)
      if (previous == null) byBarcode.set(barcode, index)
      else union(parent, previous, index)
    }
  })

  const groups = new Map<number, T[]>()
  products.forEach((product, index) => {
    const root = find(parent, index)
    const list = groups.get(root)
    if (list) list.push(product)
    else groups.set(root, [product])
  })
  return [...groups.values()]
}

export function findDuplicateProducts<T extends Identity & { id?: number }>(
  products: T[],
  candidate: Identity & { id?: number },
): T[] {
  const name = normalizeProductName(candidate.name)
  const barcode = normalizeBarcode(candidate.barcode)
  if (!name && !barcode) return []
  return products.filter((product) => {
    if (candidate.id != null && product.id === candidate.id) return false
    const sameName = Boolean(name) && normalizeProductName(product.name) === name
    const sameBarcode =
      Boolean(barcode) && normalizeBarcode(product.barcode) === barcode
    return sameName || sameBarcode
  })
}

function recordScore(product: Product): number {
  return (
    (product.sourceUrl ? 4 : 0) +
    (product.imageUrl ? 2 : 0) +
    (product.barcode ? 2 : 0) +
    (product.notes ? 1 : 0) +
    product.ingredients.length / 1000
  )
}

/** Prefer the copy that already has a link, photo, or barcode. */
export function representativeProduct(group: Product[]): Product {
  return [...group].sort((a, b) => {
    const delta = recordScore(b) - recordScore(a)
    if (delta !== 0) return delta
    return b.updatedAt - a.updatedAt
  })[0]!
}

export function duplicateStatusConflict(group: Product[]): boolean {
  const flags = new Set(group.map((product) => product.flaggedBreakout))
  return flags.size > 1
}

/**
 * Same-status copies count once. A product marked both Breakout and Tolerated
 * is left out until the user picks — otherwise the tolerated copy clears every
 * ingredient the breakout copy is trying to accuse.
 */
export function productsForElimination(products: Product[]): Product[] {
  const used: Product[] = []
  for (const group of clusterByIdentity(products)) {
    if (group.length === 1) {
      used.push(group[0]!)
      continue
    }
    if (duplicateStatusConflict(group)) continue
    used.push(representativeProduct(group))
  }
  return used
}
