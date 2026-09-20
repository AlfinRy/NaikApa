import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  server: { port: 3000 },
  plugins: [tanstackStart(), react(), tsConfigPaths()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
