'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import Reveal from '@/components/ui/Reveal'

export default function ContactForm() {
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setSettings(getSettings())
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
      setErrorMessage('Veuillez remplir tous les champs obligatoires.')
      setStatus('error')
      return
    }

    if (!emailjsConfigured) {
      setErrorMessage('Le formulaire n\'est pas configuré. Veuillez contacter l\'artiste directement par email.')
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
      setErrorMessage('Erreur lors de l\'envoi. Veuillez réessayer ou contacter l\'artiste directement.')
      setStatus('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-20 md:pb-32">
      <Reveal>
        <p className="eyebrow">Écrire</p>
        <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
          Contact
        </h1>
        <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-5 mb-10 md:mb-14">
          Une question, un intérêt pour une œuvre, une visite d&apos;atelier ?
          N&apos;hésitez pas à me contacter.
        </p>
      </Reveal>

      {!emailjsConfigured && settings?.email && (
        <div className="mb-10 p-5 bg-[var(--surface)] border border-[var(--line)]">
          <p className="font-body text-sm text-[var(--ink-soft)]">
            Contactez directement :{' '}
            <a href={`mailto:${settings.email}`} className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
              {settings.email}
            </a>
          </p>
        </div>
      )}

      {status === 'success' ? (
        <div className="p-8 md:p-12 bg-[var(--surface)] border border-[var(--line)] text-center">
          <p className="font-display text-3xl text-[var(--ink)]">
            Message envoyé
          </p>
          <p className="font-body text-sm text-[var(--ink-soft)] mt-3">
            Merci — je vous répondrai dans les meilleurs délais.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-8 btn-outline"
          >
            Envoyer un autre message
          </button>
        </div>
      ) : (
        <Reveal delay={100}>
          <div className="space-y-7">
            <div>
              <label htmlFor="contact-name" className="label-field">Nom complet *</label>
              <input
                id="contact-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Votre nom"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="label-field">Email *</label>
              <input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
                placeholder="votre@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="label-field">Sujet</label>
              <input
                id="contact-subject"
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="input-field"
                placeholder="Objet de votre message"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="label-field">Message *</label>
              <textarea
                id="contact-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input-field min-h-[170px] resize-y"
                rows={6}
                placeholder="Votre message..."
              />
            </div>

            {status === 'error' && errorMessage && (
              <div className="p-4 bg-[#B3402F]/10 border border-[#B3402F]/30" role="alert">
                <p className="font-body text-sm text-[#B3402F]">{errorMessage}</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={status === 'sending'}
              className="btn-accent w-full sm:w-auto min-h-[52px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? 'Envoi en cours...' : 'Envoyer le message'}
            </button>
          </div>
        </Reveal>
      )}
    </div>
  )
}
