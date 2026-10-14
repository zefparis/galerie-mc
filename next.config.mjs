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

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async rewrites() {
    // beforeFiles : intercepte /sw.js AVANT le fichier public/ — sinon le
    // worker normal continuerait d'être servi.
    if (!swDisabled) return []
    return {
      beforeFiles: [{ source: '/sw.js', destination: '/sw-kill.js' }],
    }
  },
  async headers() {
    // HSTS : le site est en HTTPS-only sur scandellart.fr.
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
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
      },
    ],
  },
};

export default withNextIntl(nextConfig);
