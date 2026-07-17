import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/heritage-guardian/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
}))
