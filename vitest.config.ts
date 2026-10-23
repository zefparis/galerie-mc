import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig pose jsx: "preserve" (convention Next.js) : il faut le
  // runtime automatique pour rendre les composants dans les tests.
  esbuild: { jsx: 'automatic' },
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
