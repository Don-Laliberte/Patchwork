import { useState } from 'react'
import type { Product } from '../db/schema'
import { collapseDuplicateGroup } from '../lib/products'
import { duplicateStatusConflict } from '../lib/productMatch'
import { ProductCard } from './ProductCard'

interface Props {
  products: Product[]
  openActionsId: number | null
  onToggleActions: (id: number) => void
  onCloseActions: () => void
  onEdit: (id: number) => void
  onDelete: (product: Product) => void
}

export function DuplicateCluster({
  products,
  openActionsId,
  onToggleActions,
  onCloseActions,
  onEdit,
  onDelete,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conflict = duplicateStatusConflict(products)
  const count = products.length
  const statusLabel = products[0]?.flaggedBreakout ? 'Breakout' : 'Tolerated'
  const listsDiffer =
    new Set(products.map((product) => product.ingredients.join('\n').toLowerCase())).size > 1

  async function keep(flaggedBreakout: boolean) {
    setBusy(true)
    setError(null)
    try {
      await collapseDuplicateGroup(products, flaggedBreakout)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge these copies')
      setBusy(false)
    }
  }

  return (
    <li className={`duplicate-cluster ${conflict ? 'conflict' : ''}`}>
      <div className="duplicate-banner" role="status">
        <p className="text-sm font-semibold">
          {conflict
            ? 'Same product, two statuses'
            : count === 2
              ? 'Saved twice'
              : `Saved ${count} times`}
        </p>
        <p className="mt-1 text-sm text-[rgba(26,36,28,0.72)]">
          {conflict
            ? 'These copies disagree, so this product is left out of elimination until you pick a status. The copy you keep also holds onto a link, photo, or barcode from the others.'
            : `Every copy is ${statusLabel}, so elimination counts this product once. Removing the extra ${count === 2 ? 'copy' : 'copies'} keeps a link, photo, or barcode from whichever entry has one.`}
          {listsDiffer ? ' The longer ingredient list is the one kept.' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {conflict ? (
            <>
              <button
                type="button"
                className="btn btn-danger flex-1 text-sm"
                disabled={busy}
                onClick={() => void keep(true)}
              >
                Keep as breakout
              </button>
              <button
                type="button"
                className="btn btn-safe flex-1 text-sm"
                disabled={busy}
                onClick={() => void keep(false)}
              >
                Keep as tolerated
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={busy}
              onClick={() => void keep(products[0]?.flaggedBreakout ?? false)}
            >
              {count === 2 ? 'Remove extra copy' : 'Remove extra copies'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </div>
      <ul className="space-y-2.5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            actionsOpen={openActionsId === product.id}
            onToggleActions={() => onToggleActions(product.id ?? -1)}
            onCloseActions={onCloseActions}
            onEdit={() => onEdit(product.id ?? -1)}
            onDelete={() => onDelete(product)}
          />
        ))}
      </ul>
    </li>
  )
}
