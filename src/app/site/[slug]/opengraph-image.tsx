import { ImageResponse } from 'next/og'
import { getSiteBySlug } from '@/lib/queries/sites'
import { displayUrl } from '@/lib/url'
import { Footline, Frame, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, Wordmark, clamp } from '@/lib/og'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'A site listed on web-amble'

/** The share card for a single listing. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await getSiteBySlug(slug).catch(() => null)

  if (!site) {
    return new ImageResponse(
      (
        <Frame seed={slug} hue={240}>
          <Wordmark />
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            <span style={{ fontSize: 64 }}>Not in the catalogue</span>
          </div>
        </Frame>
      ),
      size,
    )
  }

  const tagline = clamp(site.tagline || site.description, 150)

  return new ImageResponse(
    (
      <Frame seed={site.url} hue={site.accent_hue}>
        <Wordmark />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: 22,
            paddingRight: 40,
          }}
        >
          {site.category ? (
            <span
              style={{
                fontSize: 22,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: `hsl(${site.accent_hue}, 60%, 68%)`,
              }}
            >
              {site.category.name}
            </span>
          ) : null}

          <span style={{ fontSize: site.title.length > 30 ? 68 : 84, lineHeight: 1.05, letterSpacing: -2 }}>
            {clamp(site.title, 60)}
          </span>

          {tagline ? (
            <span style={{ fontSize: 30, lineHeight: 1.4, color: OG_COLORS.MUTED }}>{tagline}</span>
          ) : null}
        </div>

        <Footline left={displayUrl(site.url, 52)} right={site.tags.slice(0, 3).map((t) => t.name).join(' · ')} />
      </Frame>
    ),
    size,
  )
}
