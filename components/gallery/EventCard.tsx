import { getLocale } from 'next-intl/server'
import { GalleryEvent } from '@/lib/types'
import { formatEventDate, type Locale } from '@/lib/i18n'
import EventCardView from './EventCardView'

export { formatEventDate }

export default async function EventCard({ event }: { event: GalleryEvent }) {
  const locale = (await getLocale()) as Locale
  return (
    <EventCardView
      event={event}
      dateLabel={formatEventDate(event.eventDate || '', 'short', locale)}
    />
  )
}
