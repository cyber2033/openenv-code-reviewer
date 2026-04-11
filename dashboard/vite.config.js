import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' ensures all asset paths are relative (e.g. ./assets/index.js)
// This is required when the app is served from a sub-path like /ui/ on HuggingFace
export default defineConfig({
  plugins: [react()],
  base: './',
})
