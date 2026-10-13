import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Link/usePathname/useRouter qui conservent la langue courante et
// n'ajoutent le préfixe que pour les langues non-françaises.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
