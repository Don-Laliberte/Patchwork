export type BarcodeStop = () => void

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[]
    }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
    }
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '')
}

async function scanWithBarcodeDetector(
  video: HTMLVideoElement,
  onDetected: (code: string) => void,
): Promise<BarcodeStop | null> {
  if (!window.BarcodeDetector) return null

  const detector = new window.BarcodeDetector({ formats: FORMATS })
  let active = true
  let last = ''

  const tick = async () => {
    if (!active) return
    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video)
        const value = codes[0]?.rawValue
        if (value) {
          const normalized = normalizeBarcode(value)
          if (normalized && normalized !== last) {
            last = normalized
            onDetected(normalized)
          }
        }
      }
    } catch {
      // keep polling
    }
    if (active) requestAnimationFrame(() => void tick())
  }

  void tick()
  return () => {
    active = false
  }
}

export async function startBarcodeScan(
  video: HTMLVideoElement,
  onDetected: (code: string) => void,
): Promise<BarcodeStop> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  })
  video.srcObject = stream
  await video.play()

  try {
    const nativeStop = await scanWithBarcodeDetector(video, onDetected)
    if (nativeStop) {
      return () => {
        nativeStop()
        stream.getTracks().forEach((t) => t.stop())
        video.srcObject = null
      }
    }

    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    const { BarcodeFormat, DecodeHintType } = await import('@zxing/library')
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
    ])
    const reader = new BrowserMultiFormatReader(hints)
    let last = ''
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      const text = result?.getText()
      if (!text) return
      const normalized = normalizeBarcode(text)
      if (normalized && normalized !== last) {
        last = normalized
        onDetected(normalized)
      }
    })

    return () => {
      controls.stop()
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
    throw err
  }
}
