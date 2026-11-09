import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const sharedHost = mode === 'shared' || process.env.BOMACH_SHARED_HOST_BUILD === '1'

  return {
    base: sharedHost ? '/services/' : '/',
    build: {
      outDir: sharedHost ? 'dist/services' : 'dist',
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
      port: mode === 'shared' ? 5175 : 5174,
      strictPort: mode === 'shared',
      watch: {
        ignored: ['**/dist/**'],
      },
      ...(mode === 'shared' ? { hmr: { clientPort: 5173 } } : {}),
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
  }
})
