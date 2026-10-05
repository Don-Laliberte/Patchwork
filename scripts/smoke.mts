import {
  formatIngredientDisplay,
  normalizeIngredient,
} from '../src/lib/normalizeIngredient.ts'
import { parseIngredients } from '../src/lib/parseIngredients.ts'
import { computeSuspects } from '../src/lib/suspects.ts'
import type { Product } from '../src/db/schema.ts'

const parsed = parseIngredients(
  'Ingredients: Water / Aqua / Eau, Glycerin, Myristic Acid, Stearic Acid',
)
console.assert(parsed[0]?.normalized === 'water', 'water alias')
console.assert(parsed[0]?.raw === 'Water', 'water display canonical')
console.assert(parsed.some((p) => p.normalized === 'glycerin'), 'glycerin')

// Case / whitespace equivalence for matching
console.assert(
  normalizeIngredient('  GLYCERIN ') === normalizeIngredient('glycerin'),
  'case+ws match',
)
console.assert(
  normalizeIngredient('Aqua') === normalizeIngredient('Water / Aqua / Eau'),
  'aqua/water alias',
)

// Display casing rules
console.assert(formatIngredientDisplay('GLYCERIN') === 'Glycerin', 'title glycerin')
console.assert(
  formatIngredientDisplay('glyceryl stearate') === 'Glyceryl Stearate',
  'title phrase',
)
console.assert(
  formatIngredientDisplay('peg-100 stearate') === 'PEG-100 Stearate',
  'peg rule',
)
console.assert(formatIngredientDisplay('ci 77891') === 'Titanium Dioxide', 'ci alias display')
console.assert(formatIngredientDisplay('Aqua') === 'Water', 'aqua → Water')
console.assert(
  formatIngredientDisplay('helianthus annuus (sunflower) seed oil') ===
    'Helianthus Annuus (Sunflower) Seed Oil',
  'parentheticals kept',
)

const products: Product[] = [
  {
    name: 'A',
    source: 'manual',
    ingredients: ['GLYCERIN', 'Fragrance'],
    flaggedBreakout: true,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    name: 'B',
    source: 'manual',
    ingredients: ['glycerin', 'Niacinamide'],
    flaggedBreakout: true,
    createdAt: 1,
    updatedAt: 1,
  },
]

const suspects = computeSuspects(products, [])
console.assert(
  suspects.length === 1 && suspects[0].normalizedName === 'glycerin',
  'suspect glycerin',
)
console.assert(suspects[0].displayName === 'Glycerin', 'suspect display casing')

console.log('smoke ok', {
  parsed: parsed.map((p) => p.raw),
  suspects: suspects.map((s) => s.displayName),
})
