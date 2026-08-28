import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/atl/',
  plugins: [react()],
  build: {
    sourcemap: true,
  },
})
