import type { Plugin } from 'vite'
import { onRequestGet } from './functions/api/fetch-product-url.ts'

/**
 * Dev-only middleware mirroring the Cloudflare Pages Function at
 * /api/fetch-product-url so URL ingest works during `npm run dev`.
 */
export function productUrlDevPlugin(): Plugin {
  return {
    name: 'patchwork-product-url-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/fetch-product-url')) {
          next()
          return
        }

        void (async () => {
          try {
            const host = req.headers.host || 'localhost:5173'
            const full = `http://${host}${req.url}`
            const response = await onRequestGet({ request: new Request(full) })
            res.statusCode = response.status
            response.headers.forEach((value: string, key: string) => {
              res.setHeader(key, value)
            })
            res.end(await response.text())
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Dev proxy failed',
              }),
            )
          }
        })()
      })
    },
  }
}
