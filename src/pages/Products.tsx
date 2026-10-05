import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { ProductPreviewForm } from '../components/ProductPreviewForm'
import { deleteProduct } from '../lib/products'

export default function ProductsPage() {
  const products = useLiveQuery(
    () => db.products.orderBy('updatedAt').reverse().toArray(),
    [],
  )
  const [editingId, setEditingId] = useState<number | null>(null)

  const editing = products?.find((p) => p.id === editingId)

  if (editing && editing.id != null) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl">Edit product</h2>
        <ProductPreviewForm
          productId={editing.id}
          initialName={editing.name}
          initialIngredients={editing.ingredients}
          initialBarcode={editing.barcode}
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Products</h2>
          <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
            Breakout rows feed elimination. Tolerated products help clear false suspects.
          </p>
        </div>
        <Link to="/add" className="btn btn-primary">
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

      <ul className="space-y-3">
        {products?.map((product) => (
          <li key={product.id} className="panel rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold leading-snug">{product.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-[rgba(26,36,28,0.55)]">
                  {product.flaggedBreakout ? 'Breakout' : 'Tolerated'} · {product.source}
                  {product.barcode ? ` · ${product.barcode}` : ''}
                </p>
                <p className="mt-2 text-sm text-[rgba(26,36,28,0.72)] line-clamp-2">
                  {product.ingredients.slice(0, 8).join(', ')}
                  {product.ingredients.length > 8 ? '…' : ''}
                </p>
                <p className="mt-2 text-xs text-[rgba(26,36,28,0.5)]">
                  {product.ingredients.length} ingredients
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => setEditingId(product.id ?? null)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (product.id != null && confirm(`Delete ${product.name}?`)) {
                    void deleteProduct(product.id)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
