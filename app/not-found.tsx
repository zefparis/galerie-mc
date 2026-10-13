import Link from 'next/link'

// 404 racine : sert les routes hors préfixe de langue (ex. /admin/...).
// La page 404 localisée et traduite vit dans app/[locale]/not-found.tsx.
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 pt-16 text-center">
      <p className="eyebrow">Page introuvable</p>
      <h1 className="font-display text-6xl md:text-8xl text-[var(--ink)] mt-4">404</h1>
      <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-md">
        Cette œuvre n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/galerie" className="btn-accent mt-8">
        Retour à la galerie
      </Link>
    </div>
  )
}
