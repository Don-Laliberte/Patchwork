import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Product } from '../db/schema'
import { DuplicateCluster } from '../components/DuplicateCluster'
import { ProductCard } from '../components/ProductCard'
import { ProductPreviewForm } from '../components/ProductPreviewForm'
import { clusterByIdentity } from '../lib/productMatch'
import { deleteProduct } from '../lib/products'

export default function ProductsPage() {
  const products = useLiveQuery(
    () => db.products.orderBy('updatedAt').reverse().toArray(),
    [],
  )
  const [editingId, setEditingId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)
  const [openActionsId, setOpenActionsId] = useState<number | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const deleteTitleId = useId()

  const editing = products?.find((p) => p.id === editingId)
  const normalizedQuery = query.trim().toLowerCase()
  const clusters = useMemo(() => {
    if (!products) return []
    return clusterByIdentity(products)
      .map((group) => [...group].sort((a, b) => b.updatedAt - a.updatedAt))
      .sort((a, b) => (b[0]?.updatedAt ?? 0) - (a[0]?.updatedAt ?? 0))
      .filter((group) => {
        if (!normalizedQuery) return true
        return group.some(
          (product) =>
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.barcode?.toLowerCase().includes(normalizedQuery) ||
            product.ingredients.some((ingredient) =>
              ingredient.toLowerCase().includes(normalizedQuery),
            ),
        )
      })
  }, [products, normalizedQuery])

  useEffect(() => {
    if (!pendingDelete) return
    cancelDeleteRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingDelete(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingDelete])

  if (editing && editing.id != null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary px-3"
            onClick={() => setEditingId(null)}
            aria-label="Back to products"
          >
            ←
          </button>
          <h2 className="font-display text-2xl">Edit product</h2>
        </div>
        <ProductPreviewForm
          productId={editing.id}
          initialName={editing.name}
          initialIngredients={editing.ingredients}
          initialBarcode={editing.barcode}
          initialImageUrl={editing.imageUrl}
          initialSourceUrl={editing.sourceUrl}
          source={editing.source}
          flaggedBreakout={editing.flaggedBreakout}
          onSaved={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Products</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          Breakout rows feed elimination. Tolerated products help clear false suspects.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="field min-w-0 flex-1"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ingredient, or barcode…"
          aria-label="Search products"
        />
        <Link to="/add" className="btn btn-primary shrink-0">
          Add
        </Link>
      </div>

      {!products && <p className="text-sm">Loading…</p>}

      {products && products.length === 0 && (
        <div className="panel rounded-2xl p-5">
          <p className="font-display text-xl">No products yet</p>
          <p className="mt-2 text-sm text-[rgba(26,36,28,0.65)]">
            Add a breakout product by paste, photo, barcode, or URL to start ruling out ingredients.
          </p>
          <Link to="/add" className="btn btn-primary mt-4 inline-flex">
            Add your first product
          </Link>
        </div>
      )}

      {products && products.length > 0 && clusters.length === 0 && (
        <p className="text-sm text-[rgba(26,36,28,0.65)]">
          No products match “{query.trim()}”.
        </p>
      )}

      <ul className="space-y-2.5">
        {clusters.map((group) => {
          const key = group.map((product) => product.id).join('-')
          if (group.length > 1) {
            return (
              <DuplicateCluster
                key={key}
                products={group}
                openActionsId={openActionsId}
                onToggleActions={(id) =>
                  setOpenActionsId((prev) => (prev === id ? null : id))
                }
                onCloseActions={() => setOpenActionsId(null)}
                onEdit={(id) => {
                  setOpenActionsId(null)
                  setEditingId(id)
                }}
                onDelete={(product) => {
                  setOpenActionsId(null)
                  setPendingDelete(product)
                }}
              />
            )
          }
          const product = group[0]!
          return (
            <ProductCard
              key={product.id ?? key}
              product={product}
              actionsOpen={openActionsId === product.id}
              onToggleActions={() =>
                setOpenActionsId((prev) =>
                  prev === product.id ? null : (product.id ?? null),
                )
              }
              onCloseActions={() => setOpenActionsId(null)}
              onEdit={() => {
                setOpenActionsId(null)
                setEditingId(product.id ?? null)
              }}
              onDelete={() => {
                setOpenActionsId(null)
                setPendingDelete(product)
              }}
            />
          )
        })}
      </ul>

      {pendingDelete && pendingDelete.id != null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(26,36,28,0.45)] p-4 sm:items-center"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteTitleId}
            className="panel w-full max-w-sm rounded-2xl p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={deleteTitleId} className="font-display text-xl">
              Delete product?
            </h3>
            <p className="mt-2 text-sm text-[rgba(26,36,28,0.72)]">
              “{pendingDelete.name}” will be removed from this device. This can’t
              be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelDeleteRef}
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger flex-1"
                onClick={() => {
                  const id = pendingDelete.id
                  setPendingDelete(null)
                  if (id != null) void deleteProduct(id)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
