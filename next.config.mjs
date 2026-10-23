import createNextIntlPlugin from 'next-intl/plugin'
import { execSync } from 'node:child_process'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Identifiant de déploiement cuit dans le bundle : versionne les caches du
// service worker (/sw.js?v=<build>) pour qu'un redéploiement ne laisse
// jamais de fichiers périmés.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  (() => {
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return 'dev'
    }
  })()

// Bouton d'arrêt d'urgence : NEXT_PUBLIC_SW_DISABLED=1 → /sw.js sert le
// worker-suicide (vide les caches, se désinscrit, recharge les pages).
// Un rollback de déploiement ne retire pas un worker déjà installé chez
// les visiteurs — ce mode le fait.
const swDisabled = process.env.NEXT_PUBLIC_SW_DISABLED === '1'

// Nom du cloud Cloudinary : même résolution que lib/validation.ts. Sert à
// restreindre remotePatterns à NOTRE espace (pathname /<cloud>/**) : sans ça,
// l'optimiseur /_next/image accepterait les images de n'importe quel cloud
// hébergé sur res.cloudinary.com — dont celles d'un attaquant.
const cloudinaryCloud = (
  process.env.CLOUDINARY_CLOUD_NAME ||
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  ''
).trim()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    // En-têtes appliqués à toutes les routes (site public, admin, API).
    // Pas de CSP complète pour l'instant (script inline du thème, iframes
    // YouTube, Cloudinary) — chantier séparé avec nonce.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
  async rewrites() {
    // beforeFiles : intercepte /sw.js AVANT le fichier public/ — sinon le
    // worker normal continuerait d'être servi.
    if (!swDisabled) return []
    return {
      beforeFiles: [{ source: '/sw.js', destination: '/sw-kill.js' }],
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        // Restreint à notre cloud quand il est connu ; repli permissif
        // (hostname seul) seulement si aucun cloud n'est configuré.
        ...(cloudinaryCloud ? { pathname: `/${cloudinaryCloud}/**` } : {}),
      },
    ],
  },
};

export default withNextIntl(nextConfig);
