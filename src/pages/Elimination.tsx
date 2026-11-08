import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IngredientActionCard } from '../components/IngredientActionCard'
import { db } from '../db/schema'
import { clusterByIdentity, duplicateStatusConflict } from '../lib/productMatch'
import { saveIngredientNote, setIngredientCleared } from '../lib/products'
import { computeClearedList, computeSuspects } from '../lib/suspects'

export default function EliminationPage() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? []
  const metas = useLiveQuery(() => db.ingredients.toArray(), []) ?? []
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null)

  const suspects = computeSuspects(products, metas)
  const cleared = computeClearedList(products, metas)
  const conflictCount = clusterByIdentity(products).filter(duplicateStatusConflict).length

  function noteFor(key: string, fallback?: string) {
    return noteDrafts[key] ?? fallback ?? ''
  }

  function setNote(key: string, value: string) {
    setNoteDrafts((prev) => ({ ...prev, [key]: value }))
  }

  async function finishNote(displayName: string, key: string, fallback?: string) {
    await saveIngredientNote(displayName, noteFor(key, fallback))
    setNoteOpenId(null)
  }

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

      <div className="elimination-columns">
        <section className="space-y-3">
          <h3 className="font-display text-xl">Suspects</h3>
          {suspects.length === 0 && (
            <div className="panel rounded-2xl p-4 text-sm text-[rgba(26,36,28,0.65)]">
              No suspects yet. Add at least two breakout products that share an ingredient.
            </div>
          )}
          <ul className="space-y-2.5">
            {suspects.map((row) => {
              const key = `suspect:${row.normalizedName}`
              return (
                <IngredientActionCard
                  key={row.normalizedName}
                  id={key}
                  name={row.displayName}
                  subtitle={`In ${row.breakoutCount} breakout products`}
                  notePreview={noteFor(row.normalizedName, row.note)}
                  noteOpen={noteOpenId === key}
                  noteValue={noteFor(row.normalizedName, row.note)}
                  primary="clear"
                  onPrimary={() =>
                    void setIngredientCleared(
                      row.displayName,
                      true,
                      noteFor(row.normalizedName, row.note),
                    )
                  }
                  onToggleNote={() =>
                    setNoteOpenId((prev) => (prev === key ? null : key))
                  }
                  onNoteChange={(value) => setNote(row.normalizedName, value)}
                  onNoteDone={() =>
                    void finishNote(row.displayName, row.normalizedName, row.note)
                  }
                />
              )
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="font-display text-xl">Cleared</h3>
          {cleared.length === 0 && (
            <div className="panel rounded-2xl p-4 text-sm text-[rgba(26,36,28,0.65)]">
              Cleared ingredients will show up here.
            </div>
          )}
          <ul className="space-y-2.5">
            {cleared.map((row) => {
              const key = `cleared:${row.normalizedName}`
              const manual = row.reason === 'manual'
              return (
                <IngredientActionCard
                  key={row.normalizedName}
                  id={key}
                  name={row.displayName}
                  subtitle={
                    manual
                      ? 'Manually cleared'
                      : 'Found in a tolerated product'
                  }
                  notePreview={noteFor(row.normalizedName, row.note)}
                  noteOpen={noteOpenId === key}
                  noteValue={noteFor(row.normalizedName, row.note)}
                  primary={manual ? 'undo' : undefined}
                  onPrimary={
                    manual
                      ? () => void setIngredientCleared(row.displayName, false)
                      : undefined
                  }
                  onToggleNote={() =>
                    setNoteOpenId((prev) => (prev === key ? null : key))
                  }
                  onNoteChange={(value) => setNote(row.normalizedName, value)}
                  onNoteDone={() =>
                    void finishNote(row.displayName, row.normalizedName, row.note)
                  }
                />
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
