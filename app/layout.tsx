import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import Navbar from "@/components/ui/Navbar"
import Footer from "@/components/ui/Footer"

// Fonts auto-hébergées : aucun appel réseau au build, rendu instantané.
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-garamond.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
})

const inter = localFont({
  src: [
    { path: "./fonts/inter.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://galerie-marie-claire.vercel.app"),
  title: {
    default: "Marie-Claire Scandella — Artiste Peintre",
    template: "%s — Marie-Claire Scandella",
  },
  description:
    "Galerie en ligne de Marie-Claire Scandella, artiste peintre abstraite à Montreuil-aux-Lions. Œuvres originales : huile, acrylique, aquarelle.",
  openGraph: {
    title: "Marie-Claire Scandella — Artiste Peintre",
    description:
      "Galerie en ligne de Marie-Claire Scandella, artiste peintre abstraite à Montreuil-aux-Lions.",
    images: ["/og-image.jpg"],
    locale: "fr_FR",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
