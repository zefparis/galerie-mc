import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://scandellart.fr'

// L'atelier et l'API ne sont jamais indexés.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
