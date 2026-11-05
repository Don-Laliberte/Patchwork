import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { clusterByIdentity, duplicateStatusConflict } from '../lib/productMatch'
import { computeClearedList, computeSuspects } from '../lib/suspects'
import { setIngredientCleared } from '../lib/products'

export default function EliminationPage() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const metas = useLiveQuery(() => db.ingredients.toArray(), []) ?? []
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

  const suspects = computeSuspects(products, metas)
  const cleared = computeClearedList(products, metas)
  const conflictCount = clusterByIdentity(products).filter(duplicateStatusConflict).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">Elimination</h2>
        <p className="text-sm text-[rgba(26,36,28,0.65)] mt-1">
          Suspects appear in more than one breakout product and are not cleared. Ingredients also
          found in tolerated products drop off this list.
        </p>
      </div>

      {conflictCount > 0 && (
        <div className="panel rounded-2xl p-4 text-sm">
          <p>
            {conflictCount === 1
              ? '1 product is saved as both Breakout and Tolerated, so it is left out of elimination until you pick a status.'
              : `${conflictCount} products are saved as both Breakout and Tolerated, so they are left out of elimination until you pick a status.`}
          </p>
          <Link to="/" className="btn btn-secondary mt-3 inline-flex">
            Review products
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-xl">Suspects</h3>
        {suspects.length === 0 && (
          <div className="panel rounded-2xl p-4 text-sm text-[rgba(26,36,28,0.65)]">
            No suspects yet. Add at least two breakout products that share an ingredient.
          </div>
        )}
        <ul className="space-y-3">
          {suspects.map((row) => (
            <li key={row.normalizedName} className="panel rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.displayName}</p>
                  <p className="text-xs mt-1 text-[rgba(26,36,28,0.55)]">
                    In {row.breakoutCount} breakout products
                  </p>
                </div>
              </div>
              <input
                className="field mt-3"
                placeholder="Optional note"
                value={noteDrafts[row.normalizedName] ?? row.note ?? ''}
                onChange={(e) =>
                  setNoteDrafts((prev) => ({
                    ...prev,
                    [row.normalizedName]: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-safe mt-3 w-full"
                onClick={() =>
                  void setIngredientCleared(
                    row.displayName,
                    true,
                    noteDrafts[row.normalizedName] ?? row.note,
                  )
                }
              >
                Mark cleared
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-xl">Cleared</h3>
        {cleared.length === 0 && (
          <div className="panel rounded-2xl p-4 text-sm text-[rgba(26,36,28,0.65)]">
            Cleared ingredients will show up here.
          </div>
        )}
        <ul className="space-y-3">
          {cleared.map((row) => (
            <li key={row.normalizedName} className="panel rounded-2xl p-4">
              <p className="font-semibold">{row.displayName}</p>
              {row.note && (
                <p className="text-sm mt-1 text-[rgba(26,36,28,0.65)]">{row.note}</p>
              )}
              <button
                type="button"
                className="btn btn-secondary mt-3 w-full"
                onClick={() => void setIngredientCleared(row.displayName, false)}
              >
                Undo cleared
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
