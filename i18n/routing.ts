import { defineRouting } from 'next-intl/routing'

// Français sans préfixe (/galerie), autres langues préfixées (/en, /es, /de).
export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'de'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  // Pas de détection Accept-Language : le français par défaut sert
  // d'accueil, le choix de langue est explicite (next-intl 4 : l'option
  // quitte createMiddleware pour defineRouting).
  localeDetection: false,
})

export type Locale = (typeof routing.locales)[number]
