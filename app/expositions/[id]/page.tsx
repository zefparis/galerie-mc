'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { GalleryEvent, EventMedia } from '@/lib/types'
import { motion } from 'framer-motion'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

function MediaItem({ media }: { media: EventMedia }) {
  if (media.type === 'video') {
    const ytId = getYouTubeId(media.url)
    if (!ytId) return null
    return (
      <div>
        <div className="aspect-[16/9] rounded overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={media.caption || 'Vidéo'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        {media.caption && (
          <p className="font-body text-xs text-warm-gray mt-2 italic">{media.caption}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="rounded overflow-hidden bg-[var(--border)]">
        <img src={media.url} alt={media.caption || ''} className="w-full h-auto" />
      </div>
      {media.caption && (
        <p className="font-body text-xs text-warm-gray mt-2 italic">{media.caption}</p>
      )}
    </div>
  )
}

export default function ExpositionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState<GalleryEvent | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/events/${params.id}`)
      if (!res.ok) {
        router.replace('/expositions')
        return
      }
      setEvent(await res.json())
      setLoaded(true)
    }
    load()
  }, [params.id, router])

  if (!loaded || !event) return <div className="min-h-screen" />

  const photos = event.media.filter((m) => m.type === 'photo')
  const videos = event.media.filter((m) => m.type === 'video')

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-display text-2xl md:text-4xl text-charcoal">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
            {event.eventDate && (
              <span className="font-body text-sm text-warm-gray">
                📅 {formatDate(event.eventDate)}
              </span>
            )}
            {event.location && (
              <span className="font-body text-sm text-warm-gray">
                📍 {event.location}
              </span>
            )}
          </div>
        </motion.div>
      </section>

      {/* Cover */}
      {event.coverUrl && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-8">
          <div className="aspect-[16/9] rounded overflow-hidden bg-[var(--border)]">
            <img src={event.coverUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        </section>
      )}

      {/* Description */}
      {event.description && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-10">
          <p className="font-body text-sm md:text-base text-warm-gray leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </section>
      )}

      {/* Photos gallery */}
      {photos.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
          <h2 className="font-display text-xl md:text-2xl text-charcoal mb-6">Photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((m, i) => (
              <MediaItem key={i} media={m} />
            ))}
          </div>
        </section>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
          <h2 className="font-display text-xl md:text-2xl text-charcoal mb-6">Vidéos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((m, i) => (
              <MediaItem key={i} media={m} />
            ))}
          </div>
        </section>
      )}

      {/* Back */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <Link
          href="/expositions"
          className="inline-flex items-center gap-2 font-body text-sm text-warm-gray hover:text-charcoal transition-colors min-h-[44px]"
        >
          ← Toutes les expositions
        </Link>
      </section>
    </div>
  )
}
