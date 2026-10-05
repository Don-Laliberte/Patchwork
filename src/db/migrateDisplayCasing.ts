import { db } from './schema'
import { formatIngredientDisplay } from '../lib/normalizeIngredient'

const FLAG = 'patchwork.displayCasing.v1'

/** One-time rewrite of stored ingredient labels to Title Case. */
export async function migrateIngredientDisplayCasing(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(FLAG) === '1') return

  const products = await db.products.toArray()
  await db.transaction('rw', db.products, db.ingredients, async () => {
    for (const product of products) {
      if (product.id == null) continue
      const next = product.ingredients.map((i) => formatIngredientDisplay(i))
      const changed = next.some((v, i) => v !== product.ingredients[i])
      if (changed) {
        await db.products.update(product.id, {
          ingredients: next,
          updatedAt: Date.now(),
        })
      }
    }

    const metas = await db.ingredients.toArray()
    for (const meta of metas) {
      const displayName = formatIngredientDisplay(meta.displayName)
      if (displayName !== meta.displayName) {
        await db.ingredients.put({ ...meta, displayName })
      }
    }
  })

  localStorage.setItem(FLAG, '1')
}
