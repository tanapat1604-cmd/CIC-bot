import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/CIC-bot/',
  // Local models/runtimes and diagnostics do not change the frontend bundle.
  server: { watch: { ignored: ['**/.tools/**', '**/validation/**', '**/.backend-build/**', '**/test-results/**', '**/playwright-report/**'] } },
  build: { chunkSizeWarningLimit: 650 },
})
