import { db, type Product, type ProductSource } from '../db/schema'
import {
  formatIngredientDisplay,
  normalizeIngredient,
} from './normalizeIngredient'

export async function saveProduct(input: {
  id?: number
  name: string
  ingredients: string[]
  source: ProductSource
  barcode?: string
  flaggedBreakout?: boolean
  notes?: string
}): Promise<number> {
  const now = Date.now()
  const payload: Product = {
    name: input.name.trim(),
    ingredients: input.ingredients
      .map((i) => formatIngredientDisplay(i))
      .filter(Boolean),
    source: input.source,
    barcode: input.barcode,
    flaggedBreakout: input.flaggedBreakout ?? true,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }

  if (input.id != null) {
    const existing = await db.products.get(input.id)
    await db.products.update(input.id, {
      ...payload,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    return input.id
  }

  return Number(await db.products.add(payload))
}

export async function deleteProduct(id: number): Promise<void> {
  await db.products.delete(id)
}

export async function setIngredientCleared(
  displayName: string,
  cleared: boolean,
  note?: string,
): Promise<void> {
  const normalizedName = normalizeIngredient(displayName)
  const existing = await db.ingredients.get(normalizedName)
  const formatted = formatIngredientDisplay(
    existing?.displayName || displayName,
  )
  await db.ingredients.put({
    normalizedName,
    displayName: formatted,
    cleared,
    clearedAt: cleared ? Date.now() : undefined,
    note: note ?? existing?.note,
  })
}

export async function upsertIngredientDisplay(
  displayName: string,
): Promise<void> {
  const normalizedName = normalizeIngredient(displayName)
  const existing = await db.ingredients.get(normalizedName)
  if (existing) return
  await db.ingredients.put({
    normalizedName,
    displayName: formatIngredientDisplay(displayName),
    cleared: false,
  })
}
