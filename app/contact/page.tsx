import type { Metadata } from 'next'
import { Suspense } from 'react'
import ContactForm from '@/components/contact/ContactForm'
import { getGallerySettings } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contacter Marie-Claire Scandella — question sur une œuvre, commande ou visite d\u2019atelier.',
  openGraph: {
    title: 'Contact — Marie-Claire Scandella',
    description: 'Contacter Marie-Claire Scandella.',
  },
}

export default async function ContactPage() {
  const settings = await getGallerySettings()
  return (
    <div className="pt-16 md:pt-20">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <p className="font-body text-sm text-[var(--muted)]">Chargement...</p>
          </div>
        }
      >
        <ContactForm artistEmail={settings.email} />
      </Suspense>
    </div>
  )
}
