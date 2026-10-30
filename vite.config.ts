import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Reads the `/*` block of Netlify's public/_headers so the preview server sends the same headers. */
function netlifyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  let inBlock = false
  for (const line of readFileSync(new URL('./public/_headers', import.meta.url), 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    if (!line.startsWith(' ')) {
      inBlock = line.trim() === '/*'
      continue
    }
    const colon = line.indexOf(':')
    if (inBlock && colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return headers
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The WebP encoder loads its .wasm file relative to its own module, so Vite
  // must serve it as-is instead of pre-bundling it.
  optimizeDeps: {
    exclude: ['@jsquash/webp'],
  },
  worker: {
    format: 'es',
  },
  // Only the production preview gets them: the dev server needs inline scripts for hot reloading.
  preview: {
    headers: netlifyHeaders(),
  },
})
