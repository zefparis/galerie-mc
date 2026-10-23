import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

// « next lint » ne scannait que app/ components/ lib/ : même périmètre,
// le reste (scripts, tests, i18n, build, racine) reste hors lint.
export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'public/**',
      'scripts/**',
      'tests/**',
      'i18n/**',
      'messages/**',
      'middleware.ts',
      'next-env.d.ts',
      '*.config.{js,mjs,ts}',
      '*.mjs',
      '*.js',
    ],
  },
  {
    files: ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'],
    ignores: ['app/admin/**', 'components/admin/**'],
    rules: {
      // Côté public, la navigation passe obligatoirement par i18n/navigation
      // (Link/useRouter/usePathname/redirect localisés). Les imports nus de
      // next/link et next/navigation empilent les préfixes de langue.
      // Point d'entrée unique autorisé : i18n/pathname.ts.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              importNames: ['default'],
              message: 'Utiliser Link de @/i18n/navigation (conserve la langue).',
            },
            {
              name: 'next/navigation',
              importNames: [
                'usePathname',
                'useRouter',
                'redirect',
                'permanentRedirect',
              ],
              message:
                "Utiliser l'équivalent de @/i18n/navigation ou @/i18n/pathname.",
            },
          ],
        },
      ],
    },
  },
]
