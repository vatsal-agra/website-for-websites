import { ImageResponse } from 'next/og'
import { getCollection } from '@/lib/queries/collections'
import { pluralize } from '@/lib/utils'
import { Footline, Frame, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, Wordmark, clamp } from '@/lib/og'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A collection on web-amble'

/** The share card for a curated collection. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const collection = await getCollection(slug).catch(() => null)

  if (!collection) {
    return new ImageResponse(
      (
        <Frame seed={slug} hue={262}>
          <Wordmark />
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <span style={{ fontSize: 64 }}>Collection not found</span>
          </div>
        </Frame>
      ),
      size,
    )
  }

  return new ImageResponse(
    (
      <Frame seed={collection.slug} hue={collection.hue}>
        <Wordmark />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 22 }}>
          <span
            style={{
              fontSize: 22,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: `hsl(${collection.hue}, 60%, 68%)`,
            }}
          >
            {collection.is_editorial ? 'A web-amble collection' : 'A reader collection'}
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>{clamp(collection.title, 52)}</span>
          {collection.subtitle ? (
            <span style={{ fontSize: 30, lineHeight: 1.4, color: OG_COLORS.MUTED }}>
              {clamp(collection.subtitle, 130)}
            </span>
          ) : null}
        </div>
        <Footline left={pluralize(collection.count ?? 0, 'site')} />
      </Frame>
    ),
    size,
  )
}
