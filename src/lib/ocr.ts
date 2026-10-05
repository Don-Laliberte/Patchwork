/** Downscale large images so OCR stays responsive on phones. */
export async function prepareImageForOcr(file: Blob, maxWidth = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', 0.92)
  })
}

export async function recognizeIngredientsImage(
  file: Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const prepared = await prepareImageForOcr(file)
  onProgress?.(10)
  const worker = await createWorker('eng', 1, {
    logger: () => undefined,
  })
  try {
    const result = await worker.recognize(prepared)
    onProgress?.(100)
    return result.data.text ?? ''
  } finally {
    await worker.terminate()
  }
}
