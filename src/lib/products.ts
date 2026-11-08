import { db, type Product, type ProductSource } from '../db/schema'
import {
  formatIngredientDisplay,
  normalizeIngredient,
} from './normalizeIngredient'
import { representativeProduct } from './productMatch'

export async function saveProduct(input: {
  id?: number
  name: string
  ingredients: string[]
  source: ProductSource
  barcode?: string
  imageUrl?: string
  sourceUrl?: string
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
    imageUrl: input.imageUrl,
    sourceUrl: input.sourceUrl,
    flaggedBreakout: input.flaggedBreakout ?? true,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }

  if (input.id != null) {
    const existing = await db.products.get(input.id)
    await db.products.update(input.id, {
      ...payload,
      // Keep scraped fields on edit unless a new URL was provided
      imageUrl: input.imageUrl ?? existing?.imageUrl,
      sourceUrl: input.sourceUrl ?? existing?.sourceUrl,
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

/**
 * Write onto one existing row and delete the other copies.
 * Blank incoming fields keep a link, photo, barcode, or note already stored
 * on any copy in the group.
 */
export async function saveOverDuplicates(
  input: Parameters<typeof saveProduct>[0],
  matches: Product[],
): Promise<number> {
  const keeperId = input.id ?? representativeProduct(matches).id
  if (keeperId == null) {
    throw new Error('Could not find the existing product.')
  }
  const existing = await db.products.get(keeperId)
  const extras = matches.filter((product) => product.id != null && product.id !== keeperId)
  const id = await saveProduct({
    ...input,
    id: keeperId,
    barcode:
      input.barcode ?? existing?.barcode ?? extras.find((product) => product.barcode)?.barcode,
    imageUrl:
      input.imageUrl ??
      existing?.imageUrl ??
      extras.find((product) => product.imageUrl)?.imageUrl,
    sourceUrl:
      input.sourceUrl ??
      existing?.sourceUrl ??
      extras.find((product) => product.sourceUrl)?.sourceUrl,
    notes: input.notes ?? existing?.notes ?? extras.find((product) => product.notes)?.notes,
  })
  const extraIds = extras
    .map((product) => product.id)
    .filter((productId): productId is number => productId != null)
  if (extraIds.length) await db.products.bulkDelete(extraIds)
  return id
}

/** Collapse a duplicate group to one row with the chosen status. */
export async function collapseDuplicateGroup(
  group: Product[],
  flaggedBreakout: boolean,
): Promise<void> {
  if (group.length < 2) return
  const keeper = representativeProduct(group)
  if (keeper.id == null) return
  const longest =
    [...group].sort((a, b) => b.ingredients.length - a.ingredients.length)[0] ?? keeper
  await saveOverDuplicates(
    {
      id: keeper.id,
      name: keeper.name,
      ingredients: longest.ingredients,
      source: keeper.source,
      barcode: keeper.barcode,
      imageUrl: keeper.imageUrl,
      sourceUrl: keeper.sourceUrl,
      flaggedBreakout,
      notes: keeper.notes,
    },
    group,
  )
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

/** Persist a note without changing cleared status. */
export async function saveIngredientNote(
  displayName: string,
  note: string,
): Promise<void> {
  const normalizedName = normalizeIngredient(displayName)
  const existing = await db.ingredients.get(normalizedName)
  const trimmed = note.trim()
  await db.ingredients.put({
    normalizedName,
    displayName: formatIngredientDisplay(existing?.displayName || displayName),
    cleared: existing?.cleared ?? false,
    clearedAt: existing?.clearedAt,
    note: trimmed || undefined,
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
