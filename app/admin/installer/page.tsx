import type { Metadata } from 'next'
import InstallGuide from '@/components/admin/InstallGuide'

// Page guide publique (pas de session requise) : partageable par WhatsApp
// pour installer « Mon atelier » sur le téléphone.
export const metadata: Metadata = {
  title: 'Installer Mon atelier',
}

export default function InstallerPage() {
  return <InstallGuide />
}
