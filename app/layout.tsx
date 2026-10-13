import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import Navbar from "@/components/ui/Navbar"
import Footer from "@/components/ui/Footer"

// Fonts auto-hébergées : évite tout appel réseau à Google Fonts au build.
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-garamond.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
})

const dmSans = localFont({
  src: [
    { path: "./fonts/dm-sans.woff2", weight: "300 1000", style: "normal" },
    { path: "./fonts/dm-sans-italic.woff2", weight: "300 1000", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://galerie-marie-claire.vercel.app"),
  title: "Marie-Claire Scandella — Artiste Peintre",
  description: "Découvrez les œuvres originales de Marie-Claire Scandella, peintre française basée à Alès.",
  openGraph: {
    title: "Marie-Claire Scandella — Artiste Peintre",
    description: "Galerie en ligne — Huile, Acrylique, Aquarelle",
    images: ["/og-image.jpg"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
