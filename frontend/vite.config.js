import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url))),
        fileURLToPath(new URL('../ml/output', import.meta.url)),
        fileURLToPath(new URL('../ml_aerosols/output', import.meta.url)),
        fileURLToPath(new URL('../ml_co2/output', import.meta.url)),
      ],
    },
  },
})
