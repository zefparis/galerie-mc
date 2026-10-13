'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Reveal from '@/components/ui/Reveal'

export default function ContactForm({ artistEmail }: { artistEmail: string }) {
  const t = useTranslations('contact')
  const searchParams = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const sujet = searchParams.get('sujet')
    if (sujet) {
      setForm((prev) => ({ ...prev, subject: sujet }))
    }
  }, [searchParams])

  const emailjsConfigured =
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID &&
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID &&
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

  const handleSend = async () => {
    if (!form.name || !form.email || !form.message) {
      setErrorMessage(t('required'))
      setStatus('error')
      return
    }

    if (!emailjsConfigured) {
      setErrorMessage(t('notConfigured'))
      setStatus('error')
      return
    }

    setStatus('sending')
    setErrorMessage('')

    try {
      const emailjs = await import('@emailjs/browser')
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        {
          from_name: form.name,
          from_email: form.email,
          subject: form.subject,
          message: form.message,
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      )
      setStatus('success')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch {
      setErrorMessage(t('sendError'))
      setStatus('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-20 md:pb-32">
      <Reveal>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
          {t('title')}
        </h1>
        <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-5 mb-10 md:mb-14">
          {t('intro')}
        </p>
      </Reveal>

      {!emailjsConfigured && artistEmail && (
        <div className="mb-10 p-5 bg-[var(--surface)] border border-[var(--line)]">
          <p className="font-body text-sm text-[var(--ink-soft)]">
            {t('direct')}{' '}
            <a href={`mailto:${artistEmail}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
              {artistEmail}
            </a>
          </p>
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
