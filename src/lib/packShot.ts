import { PRODUCT_URL_WORKER_PATH } from '../config/support'
import { db, type Product } from '../db/schema'

/** Ask the product-url worker for a pack shot by product name. */
export async function lookupPackShot(
  name: string,
): Promise<string | undefined> {
  const trimmed = name.trim()
  if (trimmed.length < 3) return undefined

  const res = await fetch(
    `${PRODUCT_URL_WORKER_PATH}?name=${encodeURIComponent(trimmed)}`,
  )
  if (!res.ok) return undefined

  const data = (await res.json()) as { imageUrl?: string }
  const url = data.imageUrl?.trim()
  return url || undefined
}

/** Fill in missing product.imageUrl values. Returns how many were updated. */
export async function backfillMissingProductImages(
  products: Product[],
): Promise<{ updated: number; checked: number }> {
  const missing = products.filter(
    (product) => product.id != null && !product.imageUrl?.trim(),
  )
  let updated = 0

  for (const product of missing) {
    try {
      const imageUrl = await lookupPackShot(product.name)
      if (!imageUrl || product.id == null) continue
      await db.products.update(product.id, {
        imageUrl,
        updatedAt: Date.now(),
      })
      updated += 1
    } catch {
      // Keep going — one bad lookup should not stop the rest
    }
  }

  return { updated, checked: missing.length }
}
