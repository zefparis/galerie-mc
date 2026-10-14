import type { Metadata, Viewport } from 'next'

// L'admin a son propre manifeste (« Mon atelier ») : installé depuis une
// page /admin, l'écran d'accueil ouvre l'atelier, pas le site public.
// Jamais indexé.
export const metadata: Metadata = {
  manifest: '/admin/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'Atelier',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#1A1612',
  viewportFit: 'cover',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
