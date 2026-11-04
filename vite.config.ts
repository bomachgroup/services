import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const sharedHostBuild = process.env.BOMACH_SHARED_HOST_BUILD === '1'

export default defineConfig({
  base: sharedHostBuild ? '/services/' : '/',
  build: {
    outDir: sharedHostBuild ? 'dist/services' : 'dist',
    emptyOutDir: true,
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
