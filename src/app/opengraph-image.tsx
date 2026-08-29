import { ImageResponse } from 'next/og'
import { getStats } from '@/lib/queries/stats'
import { formatNumber } from '@/lib/utils'
import { Footline, Frame, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, Wordmark } from '@/lib/og'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'web-amble — a storefront for the whole web'

/** The default card, used for the home page and anything without its own. */
export default async function Image() {
  const stats = await getStats().catch(() => null)

  return new ImageResponse(
    (
      <Frame seed="web-amble-home" hue={262}>
        <Wordmark />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 24 }}>
          <span style={{ fontSize: 88, lineHeight: 1.02, letterSpacing: -3 }}>There is a whole web out there.</span>
          <span style={{ fontSize: 88, lineHeight: 1.02, letterSpacing: -3, color: OG_COLORS.MUTED }}>
            This is the front door.
          </span>
        </div>
        <Footline
          left="Browse, search, or press shuffle"
          right={stats && stats.approved > 0 ? `${formatNumber(stats.approved)} sites catalogued` : undefined}
        />
      </Frame>
    ),
    size,
  )
}
