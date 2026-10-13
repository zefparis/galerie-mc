import { z } from 'zod'
import type { TargetLocale } from './types'
import type { TranslateFn } from './translations-core'

// Traduction automatique des contenus de l'artiste — serveur uniquement.
// Les clés restent côté serveur (jamais NEXT_PUBLIC), aucun texte complet
// ni secret n'est écrit dans les logs.

const TIMEOUT_MS = 45_000
const MAX_FIELD_CHARS = 8_000
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 800

const LOCALE_INSTRUCTIONS: Record<TargetLocale, string> = {
  en: 'British or sober international English.',
  es: 'Neutral Spanish, understandable in Spain.',
  de: 'German, formal address (Sie).',
}

const SYSTEM_PROMPT = `You are a literary translator for the website of a contemporary abstract painter (Marie-Claire Scandella, Montreuil-aux-Lions).

Rules:
- Respect the author's voice and tone: elegant, sober, first-person where present.
- Keep paragraphs and line breaks exactly as in the source.
- Never translate proper nouns (Marie-Claire Scandella, Montreuil-aux-Lions, place names).
- Keep numbers, units, dimensions and prices unchanged.
- Use precise art vocabulary (e.g. "acrylique sur toile" → "acrylic on canvas" / "acrílico sobre lienzo" / "Acryl auf Leinwand" ; "collage sur papier" → "paper collage" / "collage sobre papel" / "Papiercollage" ; "Sans titre" → "Untitled" / "Sin título" / "Ohne Titel").
- Reply ONLY with strict JSON: {"champ": "translation", ...} using exactly the same keys as the input.`

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no-json')
  return raw.slice(start, end + 1)
}

const responseSchema = z.record(z.string(), z.string())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Rate limit doux : une requête à la fois, ~400 ms entre deux appels.
let queue: Promise<unknown> = Promise.resolve()
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn)
  queue = run.catch(() => {}).then(() => sleep(400))
  return run
}

async function claudeTranslate(
  texts: Record<string, string>,
  locale: TargetLocale
): Promise<Record<string, string>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 })
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Translate into ${LOCALE_INSTRUCTIONS[locale]}\n\n${JSON.stringify(texts)}`,
          },
        ],
      })
      const raw = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
      const parsed = responseSchema.parse(JSON.parse(extractJson(raw)))
      const out: Record<string, string> = {}
      for (const key of Object.keys(texts)) {
        if (typeof parsed[key] === 'string' && parsed[key].trim()) out[key] = parsed[key]
      }
      return out
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

async function deeplTranslate(
  texts: Record<string, string>,
  locale: TargetLocale
): Promise<Record<string, string>> {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) throw new Error('DEEPL_API_KEY manquante')
  const base = process.env.DEEPL_API_URL || 'https://api-free.deepl.com'
  const target = { en: 'EN-GB', es: 'ES', de: 'DE' }[locale]

  const out: Record<string, string> = {}
  for (const [key, text] of Object.entries(texts)) {
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${base}/v2/translate`, {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: [text], source_lang: 'FR', target_lang: target }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) throw new Error(`deepl-${res.status}`)
        const data = z
          .object({ translations: z.array(z.object({ text: z.string() })) })
          .parse(await res.json())
        if (data.translations[0]?.text) out[key] = data.translations[0].text
        lastError = undefined
        break
      } catch (err) {
        lastError = err
        if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
    if (lastError) throw lastError
  }
  return out
}

/**
 * Traducteur configuré par TRANSLATION_PROVIDER ('claude' par défaut,
 * 'deepl' possible). Les champs trop longs sont ignorés plutôt que bloquants.
 */
export function getTranslator(): TranslateFn {
  const provider = process.env.TRANSLATION_PROVIDER || 'claude'
  const impl = provider === 'deepl' ? deeplTranslate : claudeTranslate
  return (texts, locale) =>
    throttle(() => {
      const capped = Object.fromEntries(
        Object.entries(texts).filter(([, v]) => v.length <= MAX_FIELD_CHARS)
      )
      if (Object.keys(capped).length === 0) return Promise.resolve({})
      return impl(capped, locale)
    })
}

export function isTranslationConfigured(): boolean {
  const provider = process.env.TRANSLATION_PROVIDER || 'claude'
  return provider === 'deepl' ? !!process.env.DEEPL_API_KEY : !!process.env.ANTHROPIC_API_KEY
}
