import { useState } from 'react'

interface Props {
  name: string
  imageUrl?: string
  size?: number
}

/** Pack-shot thumbnail with letter fallback when missing or broken. */
export function ProductThumb({ name, imageUrl, size = 56 }: Props) {
  const [broken, setBroken] = useState(false)
  const letter = (name.trim().charAt(0) || '?').toUpperCase()
  const showImage = Boolean(imageUrl) && !broken

  return (
    <div
      className="shrink-0 overflow-hidden rounded-xl border border-[rgba(26,36,28,0.08)] bg-[rgba(26,36,28,0.06)]"
      style={{ width: size, height: size }}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-lg text-[rgba(26,36,28,0.4)]">
          {letter}
        </div>
      )}
    </div>
  )
}
