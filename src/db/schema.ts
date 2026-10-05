import Dexie, { type EntityTable } from 'dexie'

export type ProductSource = 'manual' | 'url' | 'ocr' | 'barcode'

export interface Product {
  id?: number
  name: string
  source: ProductSource
  barcode?: string
  ingredients: string[]
  /** Breakout product when true; tolerated/safe product when false */
  flaggedBreakout: boolean
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface IngredientMeta {
  normalizedName: string
  displayName: string
  cleared: boolean
  clearedAt?: number
  note?: string
}

export interface BarcodeCacheEntry {
  barcode: string
  name: string
  ingredientsText: string
  cachedAt: number
}

export class PatchworkDB extends Dexie {
  products!: EntityTable<Product, 'id'>
  ingredients!: EntityTable<IngredientMeta, 'normalizedName'>
  barcodeCache!: EntityTable<BarcodeCacheEntry, 'barcode'>

  constructor() {
    super('patchwork')
    this.version(1).stores({
      products: '++id, name, flaggedBreakout, barcode, updatedAt',
      ingredients: 'normalizedName, cleared, displayName',
      barcodeCache: 'barcode, cachedAt',
    })
  }
}

export const db = new PatchworkDB()
