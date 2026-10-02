import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps the built dashboard portable (open dist/index.html directly
// or host it in any sub-folder) together with the HashRouter in App.jsx.
// The /api proxy forwards frontend SQL calls to the node:sqlite server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
