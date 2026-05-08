'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import { motion } from 'framer-motion'

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="font-body text-warm-gray">Chargement...</p></div>}>
      <ContactContent />
    </Suspense>
  )
}

function ContactContent() {
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto px-5 md:px-6 py-10 md:py-16"
    >
      <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-charcoal mb-3 md:mb-4">
        Contact
      </h1>
      <p className="font-body text-sm md:text-base text-warm-gray mb-8 md:mb-12">
        Une question, un intérêt pour une œuvre ? N&apos;hésitez pas à me contacter.
      </p>

      {!emailjsConfigured && settings?.email && (
        <div className="mb-8 p-4 bg-[var(--white)] border border-[var(--border)]">
          <p className="font-body text-sm text-warm-gray">
            Contactez directement :{' '}
            <a href={`mailto:${settings.email}`} className="text-gold hover:text-gold-light transition-colors">
              {settings.email}
            </a>
          </p>
        </div>
      )}

      {status === 'success' ? (
        <div className="p-8 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 text-center">
          <p className="font-body text-lg text-[#2D6A4F] font-medium mb-2">
            Message envoyé avec succès
          </p>
          <p className="font-body text-sm text-warm-gray">
            Je vous répondrai dans les meilleurs délais.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-6 btn-gold"
          >
            Envoyer un autre message
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="label-field">Nom complet *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <label className="label-field">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="label-field">Sujet</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input-field"
              placeholder="Objet de votre message"
            />
          </div>

          <div>
            <label className="label-field">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="input-field min-h-[150px] resize-y"
              rows={5}
              placeholder="Votre message..."
            />
          </div>

          {status === 'error' && errorMessage && (
            <div className="p-4 bg-[#C0392B]/10 border border-[#C0392B]/30">
              <p className="font-body text-sm text-[#C0392B]">{errorMessage}</p>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={status === 'sending'}
            className="btn-gold w-full md:w-auto min-h-[56px] md:min-h-[44px] text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'sending' ? 'Envoi en cours...' : 'Envoyer le message'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
