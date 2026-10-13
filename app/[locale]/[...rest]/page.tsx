import { notFound } from 'next/navigation'

// Attrape toute URL non matchée sous /[locale] → rend not-found.tsx localisé
// (sans ce catch-all, Next remonte à la 404 racine, qui est en français).
export default function CatchAll() {
  notFound()
}
