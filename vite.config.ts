import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
})
