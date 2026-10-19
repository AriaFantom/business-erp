import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Browser tests boot their own Vite instance. Keep its optimized dependencies
  // from replacing the cache used by an already-running development server.
  cacheDir: process.env.NODE_ENV === 'test' ? 'node_modules/.vite-test' : 'node_modules/.vite',
  optimizeDeps: {
    // Both Modules and Production Floor lazy-load AnimatedBeam. Pre-bundle its
    // shared dependency at startup so first navigation cannot hit an outdated
    // optimizer URL while Vite discovers it in a page chunk.
    include: ['motion/react'],
  },
  plugins: [
    react(),
    tailwindcss(),
    inertia({ ssr: { enabled: false, entrypoint: 'inertia/ssr.tsx' } }),
    adonisjs({ entrypoints: ['inertia/app.tsx'], reload: ['resources/views/**/*.edge'] }),
  ],

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/inertia`,
      '~/': `${import.meta.dirname}/inertia/`,
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
    },
  },

  server: {
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})
