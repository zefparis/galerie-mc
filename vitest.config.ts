import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig pose jsx: "preserve" (convention Next.js) : il faut le
  // runtime automatique pour rendre les composants dans les tests.
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Même alias « @/ » que tsconfig — nécessaire pour les imports
    // runtime des composants testés (les « import type » étaient effacés).
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    server: {
      deps: {
        // Le build ESM de next-intl importe 'next/server' sans extension :
        // Node natif échoue à le résoudre, le resolver Vite le gère.
        inline: ['next-intl', 'next'],
      },
    },
  },
})
