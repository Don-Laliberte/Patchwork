const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DISCOVERY: string[] = []

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
        }
      }
    }
  }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GIS load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.gis = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('GIS load failed'))
    document.head.appendChild(script)
  })
}

export function getGoogleClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  return id?.trim() || undefined
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getGoogleClientId())
}

async function getAccessToken(): Promise<string> {
  const clientId = getGoogleClientId()
  if (!clientId) {
    throw new Error('Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID.')
  }
  await loadGis()
  void DISCOVERY

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Failed to get Google access token'))
          return
        }
        resolve(response.access_token)
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export async function uploadCsvToGoogleDrive(
  filename: string,
  content: string,
): Promise<{ id: string; webViewLink?: string }> {
  const token = await getAccessToken()
  const metadata = {
    name: filename,
    mimeType: 'text/csv',
  }
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  form.append('file', new Blob([content], { type: 'text/csv' }))

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive upload failed: ${res.status} ${text}`)
  }

  return (await res.json()) as { id: string; webViewLink?: string }
}
