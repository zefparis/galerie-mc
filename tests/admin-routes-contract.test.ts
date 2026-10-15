import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { settingsBodySchema } from '../lib/validation'
import { readSaveError } from '../lib/storage'

const ROOT = process.cwd()

function collectFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...collectFiles(full))
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

interface FetchCall {
  file: string
  urlPattern: string
  methods: string[]
}

/** Extrait tous les appels fetch('/api/...') et leurs méthodes HTTP dans
 *  les fichiers admin + lib/storage.ts. */
function extractAdminFetchCalls(): FetchCall[] {
  const files = [
    ...collectFiles(join(ROOT, 'components/admin')),
    ...collectFiles(join(ROOT, 'app/admin')),
    join(ROOT, 'lib/storage.ts'),
  ]
  const calls: FetchCall[] = []

  // Capture fetch('/api/...' | `/api/...`, { ... } optionnel)
  const fetchRegex =
    /fetch\(\s*(?:['"](\/api\/[^'"]+)['"]|`(\/api\/[^`]+)`)\s*(?:,\s*\{([\s\S]*?)\})?\s*\)/g

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    let match: RegExpExecArray | null
    while ((match = fetchRegex.exec(src)) !== null) {
      const rawUrl = match[1] || match[2] || ''
      const optsBlock = match[3] || ''

      // Normalise l'URL : retire query string (${qs}, ?all=true...) et
      // remplace les segments dynamiques ${...} par [id].
      const withoutQs = rawUrl.split('?')[0].replace(/\$\{qs\}/g, '')
      const routePath = withoutQs.replace(/\$\{[^}]+\}/g, '[id]')

      let methods: string[] = ['GET']
      const methodMatch = /method\s*:\s*([^\n,}]+)/.exec(optsBlock)
      if (methodMatch) {
        const expr = methodMatch[1].trim()
        const literals = Array.from(
          expr.matchAll(/['"](GET|POST|PUT|PATCH|DELETE)['"]/g)
        ).map((m) => m[1])
        if (literals.length > 0) {
          methods = literals
        }
      }

      calls.push({
        file: file.replace(ROOT + '/', ''),
        urlPattern: routePath,
        methods,
      })
    }
  }
  return calls
}

describe('contrat des routes API appelées par l’admin (méthode + handler + dynamique)', () => {
  it('chaque appel fetch(/api/...) de l’admin correspond à un handler exporté par route.ts', () => {
    const calls = extractAdminFetchCalls()
    expect(calls.length).toBeGreaterThan(10)

    for (const call of calls) {
      const routeFile = join(ROOT, 'app', call.urlPattern, 'route.ts')
      expect(
        existsSync(routeFile),
        `${call.file} appelle ${call.urlPattern} mais ${routeFile} n'existe pas`
      ).toBe(true)

      const routeSrc = readFileSync(routeFile, 'utf8')
      for (const method of call.methods) {
        const hasHandler = new RegExp(
          `export\\s+async\\s+function\\s+${method}\\b`
        ).test(routeSrc)
        expect(
          hasHandler,
          `${call.file} appelle ${method} ${call.urlPattern}, mais app${call.urlPattern}/route.ts n'exporte pas ${method}`
        ).toBe(true)
      }
    }
  })

  it('aucune route API ayant une méthode d’écriture (POST/PUT/PATCH/DELETE) ne peut être pré-rendue en statique (405 sur Vercel)', () => {
    const apiFiles = collectFiles(join(ROOT, 'app/api')).filter((f) =>
      f.endsWith('/route.ts')
    )
    expect(apiFiles.length).toBeGreaterThan(5)

    for (const routeFile of apiFiles) {
      const src = readFileSync(routeFile, 'utf8')
      const rel = routeFile.replace(ROOT + '/', '')
      const hasMutation =
        /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(src)
      // Un GET() sans argument Request dans le même fichier qu'un PUT/PATCH/DELETE
      // provoque le pré-rendu statique par Next.js si force-dynamic est absent,
      // ce qui fait répondre 405 Method Not Allowed sur Vercel.
      const hasZeroArgGet = /export\s+async\s+function\s+GET\s*\(\s*\)/.test(src)
      const hasForceDynamic =
        /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src)

      if (hasMutation && hasZeroArgGet) {
        expect(
          hasForceDynamic,
          `${rel} exporte GET() sans argument ET une méthode d'écriture sans export const dynamic = 'force-dynamic' (risque de 405 sur Vercel)`
        ).toBe(true)
      }
    }
  })
})

describe('validation de /api/settings (photos Cloudinary ≤10 + messages lisibles)', () => {
  const prevCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  afterEach(() => {
    if (prevCloud === undefined) {
      delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    } else {
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = prevCloud
    }
  })

  it('accepte jusqu’à 10 photos de notre cloud Cloudinary (publicId ou public_id)', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo'
    const photos = Array.from({ length: 10 }, (_, i) => ({
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/p-${i}`,
      publicId: `galerie-mc/p-${i}`,
    }))
    const parsed = settingsBodySchema.safeParse({
      artistName: 'Marie-Claire Scandella',
      photos,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.photos).toHaveLength(10)
    }
  })

  it('rejette une 11e photo ou une photo d’un autre cloud', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo'
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/p-${i}`,
      publicId: `galerie-mc/p-${i}`,
    }))
    expect(
      settingsBodySchema.safeParse({
        artistName: 'Marie-Claire Scandella',
        photos: tooMany,
      }).success
    ).toBe(false)

    expect(
      settingsBodySchema.safeParse({
        artistName: 'Marie-Claire Scandella',
        photos: [
          {
            url: 'https://res.cloudinary.com/autre-cloud/image/upload/f_auto,q_auto/galerie-mc/p-1',
            publicId: 'galerie-mc/p-1',
          },
        ],
      }).success
    ).toBe(false)
  })

  it('readSaveError produit des messages clairs en français selon le code HTTP', async () => {
    const r401 = new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401,
    })
    expect(await readSaveError(r401)).toBe(
      "Je n'ai pas pu enregistrer : session expirée, reconnectez-vous."
    )

    const r400 = new Response(
      JSON.stringify({
        error: "Une photo n'est pas valide (L'image doit venir de l'espace photo du site)",
      }),
      { status: 400 }
    )
    expect(await readSaveError(r400)).toContain("Une photo n'est pas valide")

    const r405 = new Response('', { status: 405 })
    expect(await readSaveError(r405)).toContain('405')
  })
})
