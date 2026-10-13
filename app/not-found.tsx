import NotFoundContent from '@/components/ui/NotFoundContent'

// 404 racine : sert les URL non matchées (le catch-all de [locale] y renvoie)
// et les routes hors préfixe (admin). Le contenu est traduit via la requête —
// le middleware pose la langue avant le routage ; repli français hors site
// public.
export default function NotFound() {
  return <NotFoundContent />
}
