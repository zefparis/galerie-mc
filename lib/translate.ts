import { z } from 'zod'
import type { TargetLocale } from './types'
import type { TranslateFn, TranslateOutcome } from './translations-core'

// Traduction automatique des contenus de l'artiste — serveur uniquement.
// Les clés restent côté serveur (jamais NEXT_PUBLIC), aucun texte complet
// ni secret n'est écrit dans les logs.

const TIMEOUT_MS = 30_000
const LONG_TEXT_CHARS = 3_000 // au-delà : découpage par paragraphes + relecture
const MAX_TOKENS_CAP = 8_192
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1_000

const MODEL_DEFAULT = 'claude-sonnet-5-5'
const LONGFORM_MODEL_DEFAULT = 'claude-opus-5-5'

// Noms propres qui ne doivent jamais être traduits (retirés avant de comparer
// une traduction à sa source : un texte identique sinon n'est pas traduit).
const PROPER_NOUNS = ['Marie-Claire Scandella', 'Marie Claire Scandella', 'Montreuil-aux-Lions']

const LOCALE_VOICE: Record<TargetLocale, string> = {
  en: 'sober, international English',
  es: 'neutral Spanish, understandable everywhere Spanish is spoken',
  de: 'German, always addressing the visitor with the formal "Sie"',
}

// Glossaire du vocabulaire de l'art, par langue — imposé au traducteur.
const GLOSSARY: Record<TargetLocale, string> = {
  en: [
    'acrylique sur toile → acrylic on canvas',
    'huile sur toile → oil on canvas',
    'collage sur papier → collage on paper',
    'technique mixte → mixed media',
    'aquarelle → watercolour',
    'encre sur papier → ink on paper',
    'fusain → charcoal',
    'pastel → pastel',
    'passe-partout → mount',
    'vernissage → opening',
    'œuvre → artwork',
    'atelier → studio',
    'Sans titre → Untitled',
  ].join(' ; '),
  es: [
    'acrylique sur toile → acrílico sobre lienzo',
    'huile sur toile → óleo sobre lienzo',
    'collage sur papier → collage sobre papel',
    'technique mixte → técnica mixta',
    'aquarelle → acuarela',
    'encre sur papier → tinta sobre papel',
    'fusain → carboncillo',
    'pastel → pastel',
    'passe-partout → paspartú',
    'vernissage → inauguración',
    'œuvre → obra',
    'atelier → taller',
    'Sans titre → Sin título',
  ].join(' ; '),
  de: [
    'acrylique sur toile → Acryl auf Leinwand',
    'huile sur toile → Öl auf Leinwand',
    'collage sur papier → Papiercollage',
    'technique mixte → Mischtechnik',
    'aquarelle → Aquarell',
    'encre sur papier → Tusche auf Papier',
    'fusain → Kohle',
    'pastel → Pastell',
    'passe-partout → Passepartout',
    'vernissage → Vernissage',
    'œuvre → Werk',
    'atelier → Atelier',
    'Sans titre → Ohne Titel',
  ].join(' ; '),
}

function systemPrompt(locale: TargetLocale): string {
  return `You are a literary translator for the website of Marie-Claire Scandella, a French abstract painter based in Montreuil-aux-Lions.

Target language: ${LOCALE_VOICE[locale]}.

Voice and style:
- Her writing is personal, sensitive and sober; she often speaks in the first person — keep that voice exactly.
- Preserve the imagery, the rhythm and the length of the source. Do not explain, embellish or add anything.
- Artwork titles are translated in a short, poetic way.

Rules:
- Never translate proper nouns (Marie-Claire Scandella, Montreuil-aux-Lions, names of people and places).
- Keep numbers, years, units, dimensions and prices unchanged.
- Keep paragraphs and line breaks exactly as in the source.
- Use this glossary, it is mandatory: ${GLOSSARY[locale]}.
- Reply ONLY with strict JSON: {"text": "..."} — the translation, nothing else.`
}

function reviewPrompt(locale: TargetLocale): string {
  return `You proofread a ${LOCALE_VOICE[locale]} translation of a French text written by Marie-Claire Scandella, an abstract painter.

Compare the translation with the original and fix, only where needed:
- missing or added meaning, mistranslations, false friends;
- register: keep the personal, sensitive, sober first-person voice; no embellishment;
- ${locale === 'de' ? 'formal "Sie" only.' : 'natural, sober tone.'}
- proper nouns must never be translated; numbers, years and dimensions unchanged;
- line breaks exactly as in the original; glossary: ${GLOSSARY[locale]}.

Reply ONLY with strict JSON: {"text": "the corrected translation"} — if the translation was already good, return it unchanged.`
}

// ─── Helpers exportés pour les tests ───────────────────────────────────────

/** Découpe un long texte en morceaux ≤ maxChars, aux frontières de paragraphes,
 *  séparateurs inclus dans chaque morceau : la simple concaténation des
 *  traductions restitue les retours à la ligne d'origine. */
export function splitForTranslation(text: string, maxChars = LONG_TEXT_CHARS): string[] {
  if (text.length <= maxChars) return [text]
  const parts = text.split(/(\n+)/)
  const chunks: string[] = []
  let cur = ''
  for (const part of parts) {
    if (part.length > maxChars) {
      // Paragraphe seul trop long : coupe à la dernière phrase ou espace.
      if (cur) {
        chunks.push(cur)
        cur = ''
      }
      let rest = part
      while (rest.length > maxChars) {
        let cut = rest.lastIndexOf('. ', maxChars)
        if (cut < maxChars / 2) cut = rest.lastIndexOf(' ', maxChars)
        if (cut < maxChars / 2) cut = maxChars
        chunks.push(rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)))
        rest = rest.slice(cut + (rest[cut] === '.' ? 1 : 0))
      }
      cur = rest
      continue
    }
    if (cur.length + part.length > maxChars && cur.trim()) {
      chunks.push(cur)
      cur = ''
    }
    cur += part
  }
  if (cur) chunks.push(cur)
  return chunks.filter((c) => c.length > 0)
}

/** Normalise pour la comparaison : noms propres, casse, espaces et ponctuation
 *  retirés — un texte qui ne diffère que par un nom propre est « identique ». */
function normalized(text: string): string {
  let s = text
  for (const noun of PROPER_NOUNS) s = s.split(noun).join('')
  return s
    .toLowerCase()
    .replace(/[^\wàâäéèêëîïôöùûüçœæ]+/g, ' ')
    .trim()
}

/**
 * Refuse une traduction qui n'en est pas une :
 * - vide ou identique au français (hors noms propres et très courts libellés) ;
 * - longueur anormale (moins de 40 % ou plus de 250 % de la source).
 * Retourne la raison en français, ou null si la traduction est valide.
 */
export function validateTranslation(source: string, translated: string): string | null {
  const out = translated.trim()
  if (!out) return 'La traduction est revenue vide'
  const src = normalized(source)
  const dst = normalized(out)
  if (src.length >= 12 && dst === src) return 'La traduction est restée en français'
  if (source.trim().length >= 30) {
    const ratio = out.length / source.trim().length
    if (ratio < 0.4 || ratio > 2.5) return 'La traduction a une longueur anormale'
  }
  return null
}

/** Seules les erreurs temporaires méritent une nouvelle tentative :
 *  429, 5xx, surcharge, timeout, réponse tronquée ou illisible du modèle.
 *  400/401/403/404 (clé, modèle, requête) échouent tout de suite. */
export function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (typeof status === 'number') {
    return status === 408 || status === 409 || status === 429 || status >= 500
  }
  return true // timeout, coupure réseau, JSON invalide, troncature → temporaire
}

export class TruncatedResponseError extends Error {
  constructor() {
    super('truncated')
    this.name = 'TruncatedResponseError'
  }
}

/** Raison courte en français, sans secret ni texte complet — pour les logs
 *  serveur et l'affichage « Échec » du panneau d'administration. */
export function failureReason(err: unknown): string {
  if (err instanceof TruncatedResponseError) return 'La réponse du traducteur a été coupée'
  const status = (err as { status?: number })?.status
  if (status === 401 || status === 403) return 'La clé de traduction est absente ou invalide'
  if (status === 404) return 'Le modèle de traduction est introuvable'
  if (status === 429) return 'Trop de demandes — réessayez dans un instant'
  if (typeof status === 'number' && status >= 500) return 'Le service de traduction est indisponible'
  const name = (err as Error)?.name || ''
  const message = (err as Error)?.message || ''
  if (name === 'APIConnectionTimeoutError' || name === 'TimeoutError' || /timeout/i.test(message)) {
    return 'Le service a mis trop de temps à répondre'
  }
  if (err instanceof z.ZodError || /no-json|json/i.test(message)) {
    return 'La réponse du traducteur était illisible'
  }
  return 'La traduction a échoué'
}

/** Log serveur sobre : champ, langue, modèle, raison — jamais de clé ni de texte. */
function logFailure(locale: TargetLocale, field: string, model: string, reason: string) {
  console.error(`[translate] ${locale} ${field} — ${reason} (${model})`)
}

// ─── Fournisseurs ──────────────────────────────────────────────────────────

const responseSchema = z.object({ text: z.string() })

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no-json')
  return raw.slice(start, end + 1)
}

interface ClaudeClient {
  messages: {
    create: (args: {
      model: string
      max_tokens: number
      system: string
      messages: { role: 'user'; content: string }[]
    }) => Promise<{
      stop_reason?: string | null
      content: { type: string; text?: string }[]
    }>
  }
}

async function askClaude(
  client: ClaudeClient,
  model: string,
  system: string,
  userContent: string
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: Math.min(MAX_TOKENS_CAP, Math.max(2048, Math.ceil(userContent.length * 2.5))),
    system,
    messages: [{ role: 'user', content: userContent }],
  })
  if (res.stop_reason === 'max_tokens') throw new TruncatedResponseError()
  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('')
  const parsed = responseSchema.parse(JSON.parse(extractJson(raw)))
  if (!parsed.text.trim()) throw new Error('empty-translation')
  return parsed.text
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Traduit un morceau avec retries progressifs sur les erreurs temporaires. */
async function translateChunk(
  client: ClaudeClient,
  model: string,
  locale: TargetLocale,
  chunk: string
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await askClaude(
        client,
        model,
        systemPrompt(locale),
        `Translate this French text:\n\n${chunk}`
      )
    } catch (err) {
      lastError = err
      if (!isRetryableError(err)) throw err
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

/** Seconde passe : le modèle relit sa traduction face à l'original et la corrige.
 *  Best-effort : si la relecture échoue, on garde la première version. */
async function reviewLongText(
  client: ClaudeClient,
  model: string,
  locale: TargetLocale,
  french: string,
  draft: string
): Promise<string> {
  try {
    const reviewed = await askClaude(
      client,
      model,
      reviewPrompt(locale),
      `ORIGINAL (French):\n${french}\n\nDRAFT TRANSLATION:\n${draft}`
    )
    return validateTranslation(french, reviewed) === null ? reviewed : draft
  } catch {
    return draft
  }
}

/** Traduit un champ entier : découpe les longs textes par paragraphes,
 *  recolle en préservant les sauts de ligne, relit les longs textes. */
async function translateField(
  client: ClaudeClient,
  locale: TargetLocale,
  field: string,
  source: string
): Promise<string> {
  const longForm = source.trim().length > LONG_TEXT_CHARS
  const model = longForm
    ? process.env.TRANSLATION_MODEL_LONGFORM || LONGFORM_MODEL_DEFAULT
    : process.env.ANTHROPIC_MODEL || MODEL_DEFAULT

  const chunks = splitForTranslation(source)
  const translated: string[] = []
  for (const chunk of chunks) {
    const t = await translateChunk(client, model, locale, chunk)
    translated.push(t)
  }
  let out = translated.join('')

  if (longForm) out = await reviewLongText(client, model, locale, source, out)

  const invalid = validateTranslation(source, out)
  if (invalid) {
    logFailure(locale, field, model, invalid)
    throw new Error(invalid)
  }
  return out
}

async function claudeTranslate(
  texts: Record<string, string>,
  locale: TargetLocale
): Promise<TranslateOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const outcome: TranslateOutcome = { ok: {}, failed: {} }
  if (!apiKey) {
    const reason = 'La clé de traduction est absente ou invalide'
    for (const field of Object.keys(texts)) outcome.failed[field] = reason
    return outcome
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 })

  for (const [field, source] of Object.entries(texts)) {
    if (!source.trim()) continue
    const longForm = source.trim().length > LONG_TEXT_CHARS
    const model = longForm
      ? process.env.TRANSLATION_MODEL_LONGFORM || LONGFORM_MODEL_DEFAULT
      : process.env.ANTHROPIC_MODEL || MODEL_DEFAULT
    try {
      outcome.ok[field] = await translateField(client, locale, field, source)
    } catch (err) {
      const reason = failureReason(err)
      logFailure(locale, field, model, reason)
      outcome.failed[field] = reason
    }
  }
  return outcome
}

async function deeplTranslate(
  texts: Record<string, string>,
  locale: TargetLocale
): Promise<TranslateOutcome> {
  const apiKey = process.env.DEEPL_API_KEY
  const outcome: TranslateOutcome = { ok: {}, failed: {} }
  const reasonNoKey = 'La clé de traduction est absente ou invalide'
  if (!apiKey) {
    for (const field of Object.keys(texts)) outcome.failed[field] = reasonNoKey
    return outcome
  }
  const base = process.env.DEEPL_API_URL || 'https://api-free.deepl.com'
  const target = { en: 'EN-GB', es: 'ES', de: 'DE' }[locale]

  for (const [field, source] of Object.entries(texts)) {
    if (!source.trim()) continue
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${base}/v2/translate`, {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: splitForTranslation(source),
            source_lang: 'FR',
            target_lang: target,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) {
          const err = Object.assign(new Error(`deepl-${res.status}`), { status: res.status })
          throw err
        }
        const data = z
          .object({ translations: z.array(z.object({ text: z.string() })) })
          .parse(await res.json())
        const out = data.translations.map((t) => t.text).join('')
        const invalid = validateTranslation(source, out)
        if (invalid) throw new Error(invalid)
        outcome.ok[field] = out
        lastError = undefined
        break
      } catch (err) {
        lastError = err
        if (!isRetryableError(err)) break
        if (attempt < MAX_RETRIES - 1) await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
    if (lastError) {
      const reason = failureReason(lastError)
      logFailure(locale, field, 'deepl', reason)
      outcome.failed[field] = reason
    }
  }
  return outcome
}

/**
 * Traducteur configuré par TRANSLATION_PROVIDER ('claude' par défaut,
 * 'deepl' possible). Renvoie, par champ, une traduction ou une raison
 * d'échec — jamais de silence.
 */
export function getTranslator(): TranslateFn {
  const provider = process.env.TRANSLATION_PROVIDER || 'claude'
  return provider === 'deepl' ? deeplTranslate : claudeTranslate
}

export function isTranslationConfigured(): boolean {
  const provider = process.env.TRANSLATION_PROVIDER || 'claude'
  return provider === 'deepl' ? !!process.env.DEEPL_API_KEY : !!process.env.ANTHROPIC_API_KEY
}
