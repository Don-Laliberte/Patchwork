import { useEffect, useRef } from 'react'

interface Props {
  id: string
  name: string
  subtitle: string
  notePreview?: string
  noteOpen: boolean
  noteValue: string
  /** Omit when there is no clear/undo action (e.g. auto-cleared by tolerated). */
  primary?: 'clear' | 'undo'
  onPrimary?: () => void
  onToggleNote: () => void
  onNoteChange: (value: string) => void
  onNoteDone: () => void
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 14 4 9l5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 9h10.5a5.5 5.5 0 1 1 0 11H12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4.5h10.5L19 8v11.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5V8h3.5M8 12h8M8 16h5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IngredientActionCard({
  id,
  name,
  subtitle,
  notePreview,
  noteOpen,
  noteValue,
  primary,
  onPrimary,
  onToggleNote,
  onNoteChange,
  onNoteDone,
}: Props) {
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (noteOpen) noteRef.current?.focus()
  }, [noteOpen])

  const primaryLabel =
    primary === 'clear'
      ? `Mark ${name} cleared`
      : primary === 'undo'
        ? `Undo cleared for ${name}`
        : undefined
  const showPreview = Boolean(notePreview?.trim()) && !noteOpen

  return (
    <li className="ingredient-card panel">
      <div className="ingredient-card-row">
        <div className="ingredient-card-copy">
          <p className="font-semibold leading-snug">{name}</p>
          <p className="text-xs mt-1 text-[rgba(26,36,28,0.55)]">{subtitle}</p>
          {showPreview && (
            <p className="mt-2 text-sm text-[rgba(26,36,28,0.65)] line-clamp-2">
              {notePreview}
            </p>
          )}
        </div>

        <div
          id={`${id}-actions`}
          className="ingredient-card-actions"
          role="group"
          aria-label={`${name} actions`}
        >
          <button
            type="button"
            className="ingredient-action"
            onClick={onToggleNote}
            aria-label={`${noteOpen ? 'Hide' : 'Edit'} note for ${name}`}
            aria-expanded={noteOpen}
          >
            <NoteIcon />
          </button>
          {primary && onPrimary && (
            <button
              type="button"
              className={`ingredient-action ${primary === 'clear' ? 'ingredient-action-safe' : 'ingredient-action-undo'}`}
              onClick={onPrimary}
              aria-label={primaryLabel}
            >
              {primary === 'clear' ? <CheckIcon /> : <UndoIcon />}
            </button>
          )}
        </div>
      </div>

      {noteOpen && (
        <div className="ingredient-note-panel">
          <textarea
            ref={noteRef}
            className="field min-h-20"
            placeholder="Optional note"
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            aria-label={`Note for ${name}`}
          />
          <button
            type="button"
            className="btn btn-secondary mt-2 w-full"
            onClick={onNoteDone}
          >
            Done
          </button>
        </div>
      )}
    </li>
  )
}
