import {
  buildBeautySearchQueries,
  cleanDisplayProductName,
} from '../src/lib/beautySearchQueries.ts'
import {
  cleanupIngredientsText,
  isPlausibleIngredientsText,
} from '../src/lib/ingredientsQuality.ts'
import { onRequestGet } from '../functions/api/fetch-product-url.ts'

const junkSample = `WATER, ISOPROPYL PALMITATE, ACOHOL DENAT, Diethylamino Hydroxybenzoyl Hexyl Benzoate Oxidized Chacetate Copernicia Cerifera Cera/Carnauba Wax De Carnauba Methoxypropylamino Cyclohexenylidene Tout Ce Qu'il Faut Savol Hoyethylcyanoacetate Pentylene Glycol C12-22 Alkyl All You Need To Know Tehydroxyethylacrylate Copolymer`

const cleanSample =
  'Water, Glycerin, Petrolatum, Dicaprylyl Ether, Dimethicone, Glyceryl Stearate, Cetyl Alcohol, Helianthus Annuus Seed Oil, PEG-30 Stearate, Panthenol, Niacinamide'

console.assert(
  !isPlausibleIngredientsText(junkSample),
  'reject all-you-need-to-know junk',
)
console.assert(isPlausibleIngredientsText(cleanSample), 'accept clean list')

const cleanedToleriane = cleanupIngredientsText(
  '6M E40 ml/39 g/1.35 FL.OZ INGREDIENTS: AQUA &quot; GLYCERIN &quot; SQUALANE, DIMETHICONE, NIACINAMIDE, CETYL ALCOHOL',
)
console.assert(
  !cleanedToleriane.includes('&quot;'),
  'decode entities',
)
console.assert(
  isPlausibleIngredientsText(cleanedToleriane),
  'noisy-but-real toleriane-like list passes after cleanup',
)

const antheliosQueries = buildBeautySearchQueries(
  'Roche Posay Sunscreen Anthelios Lightweight Non Comedogenic',
)
console.assert(
  antheliosQueries.some((q) => /la roche-posay anthelios/i.test(q)),
  'anthelios query',
)

const tolerianeQueries = buildBeautySearchQueries(
  'Toleriane Formulated Irritated Dermatologist Recommended',
)
console.assert(
  tolerianeQueries.some((q) => /toleriane/i.test(q)),
  'toleriane query present',
)
console.assert(
  !tolerianeQueries.some((q) => /dermatologist recommended/i.test(q)),
  'no dermatologist recommended in queries',
)
console.assert(
  cleanDisplayProductName(
    'Toleriane Formulated Irritated Dermatologist Recommended',
  ) === 'La Roche-Posay Toleriane',
  'toleriane display',
)
console.assert(
  cleanDisplayProductName('Cetaphil Moisturizing Lotion 500ml') ===
    'Cetaphil Moisturizing Lotion',
  'cetaphil keeps form',
)

const urls = [
  ['B0052EM8L8', 'https://www.amazon.ca/Toleriane-Formulated-Irritated-Dermatologist-Recommended/dp/B0052EM8L8'],
  ['B08BMV5VDL', 'https://www.amazon.ca/Roche-Posay-Sunscreen-Anthelios-Lightweight-Non-Comedogenic/dp/B08BMV5VDL'],
  ['B0CVRCR6VF', 'https://www.amazon.ca/Medicube-Zero-Pore-Pads-Dual-Textured/dp/B0CVRCR6VF'],
  ['B0FX418XT8', 'https://www.amazon.ca/Arencia-Vitamin-Booster-Glutathione-Niacinamide/dp/B0FX418XT8'],
  ['B0DBF65JYY', 'https://www.amazon.ca/medicube-Niacinamide-Hydrating-Moisturizing-Skincare/dp/B0DBF65JYY'],
  ['B00BMJTP54', 'https://www.amazon.ca/Cetaphil-Moisturizing-Lotion-500ml/dp/B00BMJTP54'],
] as const

async function probe() {
  for (const [asin, url] of urls) {
    const res = await onRequestGet({
      request: new Request(
        'http://local/api/fetch-product-url?url=' + encodeURIComponent(url),
      ),
    })
    const body = (await res.json()) as {
      name?: string
      ingredientsText?: string
      warning?: string
    }
    const hasIng = Boolean(body.ingredientsText)
    const okGate = hasIng
      ? isPlausibleIngredientsText(body.ingredientsText!)
      : true
    console.log(
      asin,
      res.status,
      body.name,
      hasIng ? `ingredients=${body.ingredientsText!.length}` : 'no-ingredients',
      okGate ? 'gate-ok' : 'GATE-FAIL',
    )
  }
}

await probe()
console.log('obf-quality smoke ok')
