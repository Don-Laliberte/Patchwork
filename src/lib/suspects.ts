import type { IngredientMeta, Product } from '../db/schema'
import {
  displayFromNormalized,
  formatIngredientDisplay,
  normalizeIngredient,
} from './normalizeIngredient'
import { productsForElimination } from './productMatch'

export interface SuspectRow {
  normalizedName: string
  displayName: string
  breakoutCount: number
  note?: string
}

export interface ClearedRow {
  normalizedName: string
  displayName: string
  breakoutCount: number
  note?: string
  /** Manual clear from Suspects, or auto-cleared by a tolerated product. */
  reason: 'manual' | 'tolerated'
  clearedAt?: number
}

export function countBreakoutAppearances(products: Product[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const product of productsForElimination(products)) {
    if (!product.flaggedBreakout) continue
    const seenInProduct = new Set<string>()
    for (const raw of product.ingredients) {
      const key = normalizeIngredient(raw)
      if (!key || seenInProduct.has(key)) continue
      seenInProduct.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

export function countSafeAppearances(products: Product[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const product of productsForElimination(products)) {
    if (product.flaggedBreakout) continue
    const seenInProduct = new Set<string>()
    for (const raw of product.ingredients) {
      const key = normalizeIngredient(raw)
      if (!key || seenInProduct.has(key)) continue
      seenInProduct.add(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function preferredDisplay(
  normalized: string,
  products: Product[],
  meta?: IngredientMeta,
): string {
  if (meta?.displayName) {
    return formatIngredientDisplay(meta.displayName)
  }
  for (const product of products) {
    for (const raw of product.ingredients) {
      if (normalizeIngredient(raw) === normalized) {
        return displayFromNormalized(normalized, raw)
      }
    }
  }
  return displayFromNormalized(normalized, '')
}

/**
 * Suspects: appear in >1 breakout product, not manually cleared,
 * and not also present in a tolerated (safe) product.
 */
export function computeSuspects(
  products: Product[],
  metas: IngredientMeta[],
): SuspectRow[] {
  const metaByKey = new Map(metas.map((m) => [m.normalizedName, m]))
  const breakoutCounts = countBreakoutAppearances(products)
  const safeCounts = countSafeAppearances(products)

  const rows: SuspectRow[] = []
  for (const [normalizedName, breakoutCount] of breakoutCounts) {
    if (breakoutCount <= 1) continue
    const meta = metaByKey.get(normalizedName)
    if (meta?.cleared) continue
    if ((safeCounts.get(normalizedName) ?? 0) > 0) continue
    rows.push({
      normalizedName,
      displayName: preferredDisplay(normalizedName, products, meta),
      breakoutCount,
      note: meta?.note,
    })
  }

  return rows.sort(
    (a, b) =>
      b.breakoutCount - a.breakoutCount ||
      a.displayName.localeCompare(b.displayName),
  )
}

/**
 * Cleared: manually marked safe, or would-be suspects that also appear in a
 * tolerated product (so undoing a manual clear does not drop them into limbo).
 */
export function computeClearedList(
  products: Product[],
  metas: IngredientMeta[],
): ClearedRow[] {
  const metaByKey = new Map(metas.map((m) => [m.normalizedName, m]))
  const breakoutCounts = countBreakoutAppearances(products)
  const safeCounts = countSafeAppearances(products)
  const byKey = new Map<string, ClearedRow>()

  for (const meta of metas) {
    if (!meta.cleared) continue
    byKey.set(meta.normalizedName, {
      normalizedName: meta.normalizedName,
      displayName: formatIngredientDisplay(meta.displayName),
      breakoutCount: breakoutCounts.get(meta.normalizedName) ?? 0,
      note: meta.note,
      reason: 'manual',
      clearedAt: meta.clearedAt,
    })
  }

  // Would-be suspects that a tolerated product already clears for you.
  for (const [normalizedName, breakoutCount] of breakoutCounts) {
    if (breakoutCount <= 1) continue
    if ((safeCounts.get(normalizedName) ?? 0) <= 0) continue
    if (byKey.has(normalizedName)) continue
    const meta = metaByKey.get(normalizedName)
    byKey.set(normalizedName, {
      normalizedName,
      displayName: preferredDisplay(normalizedName, products, meta),
      breakoutCount,
      note: meta?.note,
      reason: 'tolerated',
      clearedAt: meta?.clearedAt,
    })
  }

  return [...byKey.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )
}
