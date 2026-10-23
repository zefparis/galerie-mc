'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Reveal from '@/components/ui/Reveal'
import InstagramLink from '@/components/ui/InstagramLink'

interface Props {
  artistEmail: string
  /** Lien Instagram canonique des réglages — null = rien affiché. */
  instagramUrl?: string | null
  /** aria-label traduit pour le lien Instagram (nouvel onglet). */
  instagramAria: string
  /** Envoi serveur configuré (RESEND_API_KEY) — calculé côté serveur. */
  mailConfigured: boolean
}

export default function ContactForm({ artistEmail, instagramUrl, instagramAria, mailConfigured }: Props) {
  const t = useTranslations('contact')
  const searchParams = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    website: '', // pot-de-miel : doit rester vide
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const sujet = searchParams.get('sujet')
    if (sujet) {
      setForm((prev) => ({ ...prev, subject: sujet }))
    }
  }, [searchParams])

  const handleSend = async () => {
    if (!form.name || !form.email || !form.message) {
      setErrorMessage(t('required'))
      setStatus('error')
      return
    }

    if (!mailConfigured) {
      setErrorMessage(t('notConfigured'))
      setStatus('error')
      return
    }

    setStatus('sending')
    setErrorMessage('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        configured?: boolean
      }
      if (res.ok) {
        setStatus('success')
        setForm({ name: '', email: '', subject: '', message: '', website: '' })
        return
      }
      if (res.status === 503 || data.configured === false) {
        setErrorMessage(t('notConfigured'))
      } else if (res.status === 400) {
        setErrorMessage(
          /email/i.test(data.error || '') ? t('invalidEmail') : t('required')
        )
      } else {
        setErrorMessage(t('sendError'))
      }
      setStatus('error')
    } catch {
      setErrorMessage(t('sendError'))
      setStatus('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto gutter-x pt-10 md:pt-20 pb-20 md:pb-32">
      <Reveal>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display title-page text-[var(--ink)] mt-3">
          {t('title')}
        </h1>
        <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-5 mb-10 md:mb-14">
          {t('intro')}
        </p>
      </Reveal>

      {((!mailConfigured && artistEmail) || instagramUrl) && (
        <div className="mb-10 p-5 bg-[var(--surface)] border border-[var(--line)] space-y-2">
          {!mailConfigured && artistEmail && (
            <p className="font-body text-sm text-[var(--ink-soft)]">
              {t('direct')}{' '}
              <a href={`mailto:${artistEmail}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                {artistEmail}
              </a>
            </p>
          )}
          {instagramUrl && (
            <InstagramLink
              url={instagramUrl}
              ariaLabel={instagramAria}
              className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent-hover)] transition-colors"
            />
          )}
        </div>
      )}

      {status === 'success' ? (
        <div className="p-8 md:p-12 bg-[var(--surface)] border border-[var(--line)] text-center">
          <p className="font-display text-3xl text-[var(--ink)]">
            {t('successTitle')}
          </p>
          <p className="font-body text-sm text-[var(--ink-soft)] mt-3">
            {t('successBody')}
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-8 btn-outline"
          >
            {t('another')}
          </button>
        </div>
      ) : (
        <Reveal delay={100}>
          <div className="space-y-7">
            <div>
              <label htmlFor="contact-name" className="label-field">{t('name')}</label>
              <input
                id="contact-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder={t('namePh')}
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="label-field">{t('email')}</label>
              <input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
                placeholder={t('emailPh')}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="label-field">{t('subject')}</label>
              <input
                id="contact-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input-field"
                placeholder={t('subjectPh')}
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="label-field">{t('message')}</label>
              <textarea
                id="contact-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input-field min-h-[170px] resize-y"
                rows={6}
                placeholder={t('messagePh')}
              />
            </div>

            {/* Pot-de-miel anti-robots : invisible, jamais rempli par un
                humain, exclu de la tabulation et des lecteurs d'écran.
                Pas de label textuel : tout libellé ressortirait dans
                l'audit i18n des pages traduites. */}
            <div
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
              <input
                id="contact-website"
                name="website"
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {status === 'error' && errorMessage && (
              <div className="p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
                <p className="font-body text-sm text-[var(--danger)]">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={status === 'sending'}
              className="btn-accent w-full sm:w-auto min-h-[52px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? t('sending') : t('send')}
            </button>
          </div>
        </Reveal>
      )}
    </div>
  )
}
