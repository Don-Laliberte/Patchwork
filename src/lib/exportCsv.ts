import type { IngredientMeta, Product } from '../db/schema'
import { countBreakoutAppearances } from './suspects'

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function joinCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function buildBreakoutCsv(products: Product[]): string {
  const breakouts = products.filter((p) => p.flaggedBreakout)
  const maxIngredients = breakouts.reduce(
    (max, p) => Math.max(max, p.ingredients.length),
    0,
  )
  const header = [
    'Product',
    ...Array.from({ length: Math.max(maxIngredients, 1) }, () => 'Ingredient'),
  ]
  const rows = breakouts.map((p) => {
    const cells = [p.name, ...p.ingredients]
    while (cells.length < header.length) cells.push('')
    return joinCsvRow(cells)
  })
  return [joinCsvRow(header), ...rows].join('\n')
}

export function buildEliminationCsv(
  products: Product[],
  metas: IngredientMeta[],
): string {
  const counts = countBreakoutAppearances(products)
  const names = new Set<string>([
    ...counts.keys(),
    ...metas.map((m) => m.normalizedName),
  ])

  const displayFor = (key: string) =>
    metas.find((m) => m.normalizedName === key)?.displayName ??
    products
      .flatMap((p) => p.ingredients)
      .find((raw) => raw.toLowerCase().includes(key)) ??
    key

  const header = joinCsvRow([
    'Ingredient',
    'AppearsInBreakouts',
    'Cleared',
    'Notes',
  ])
  const rows = [...names]
    .sort((a, b) => displayFor(a).localeCompare(displayFor(b)))
    .map((key) => {
      const meta = metas.find((m) => m.normalizedName === key)
      return joinCsvRow([
        meta?.displayName ?? displayFor(key),
        String(counts.get(key) ?? 0),
        meta?.cleared ? 'TRUE' : 'FALSE',
        meta?.note ?? '',
      ])
    })

  return [header, ...rows].join('\n')
}

export function buildCombinedExport(
  products: Product[],
  metas: IngredientMeta[],
): string {
  return [
    '# Breakout',
    buildBreakoutCsv(products),
    '',
    '# Elimination',
    buildEliminationCsv(products, metas),
  ].join('\n')
}

export function exportFilename(kind: string): string {
  const d = new Date()
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
  return `patchwork-${kind}-${stamp}.csv`
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function shareOrDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/csv' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Patchwork export' })
    return
  }
  downloadTextFile(filename, content)
}
