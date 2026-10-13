import { defineRouting } from 'next-intl/routing'

// Français sans préfixe (/galerie), autres langues préfixées (/en, /es, /de).
export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'de'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]
