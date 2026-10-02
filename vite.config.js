import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps the built dashboard portable (open dist/index.html directly
// or host it in any sub-folder) together with the HashRouter in App.jsx.
export default defineConfig({
  base: './',
  plugins: [react()],
})
