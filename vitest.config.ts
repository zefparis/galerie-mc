import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig pose jsx: "preserve" (convention Next.js) : il faut le
  // runtime automatique pour rendre les composants dans les tests.
  esbuild: { jsx: 'automatic' },
})
