import { useEffect, useRef } from 'react'
import type { Product } from '../db/schema'
import { ProductThumb } from './ProductThumb'

const SOURCE_LABEL: Record<Product['source'], string> = {
  manual: 'Paste',
  url: 'URL',
  ocr: 'Photo',
  barcode: 'Barcode',
}

interface Props {
  product: Product
  actionsOpen: boolean
  onToggleActions: () => void
  onCloseActions: () => void
  onEdit: () => void
  onDelete: () => void
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProductCard({
  product,
  actionsOpen,
  onToggleActions,
  onCloseActions,
  onEdit,
  onDelete,
}: Props) {
  const rootRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!actionsOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onCloseActions()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseActions()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [actionsOpen, onCloseActions])

  const statusClass = product.flaggedBreakout
    ? 'product-status product-status-breakout'
    : 'product-status product-status-tolerated'

  return (
    <li
      ref={rootRef}
      className={`product-card panel ${actionsOpen ? 'actions-open' : ''}`}
    >
      <div
        className="product-card-body"
        onClick={onToggleActions}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleActions()
          }
        }}
        tabIndex={0}
        aria-expanded={actionsOpen}
        aria-label={`${product.name}. Tap to ${actionsOpen ? 'hide' : 'show'} edit and delete`}
      >
        <ProductThumb name={product.name} imageUrl={product.imageUrl} size={48} />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start gap-1.5">
            <p className="font-semibold leading-snug line-clamp-2">{product.name}</p>
            {product.sourceUrl && (
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="product-source-link shrink-0 mt-0.5"
                aria-label={`Open data source for ${product.name}`}
                title="Open data source"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon />
              </a>
            )}
          </div>
          <span className={statusClass}>
            {product.flaggedBreakout ? 'Breakout' : 'Tolerated'}
          </span>
          <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-[rgba(26,36,28,0.5)]">
            {SOURCE_LABEL[product.source]}
            {product.barcode ? ` · ${product.barcode}` : ''}
          </p>
          <p className="mt-1.5 text-sm text-[rgba(26,36,28,0.72)] line-clamp-2">
            {product.ingredients.slice(0, 8).join(', ')}
            {product.ingredients.length > 8 ? '…' : ''}
          </p>
          <p className="mt-1 text-xs text-[rgba(26,36,28,0.5)]">
            {product.ingredients.length} ingredients
          </p>
        </div>
      </div>

      <div className="product-card-actions" role="group" aria-label="Product actions">
        <button
          type="button"
          className="product-action product-action-edit"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          aria-label={`Edit ${product.name}`}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="product-action product-action-delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${product.name}`}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  )
}
