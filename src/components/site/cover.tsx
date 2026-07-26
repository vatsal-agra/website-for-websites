import { cn, hashString } from '@/lib/utils'

/**
 * Generated cover art.
 *
 * Not every website on the web ships an og:image, and hotlinking favicons makes
 * for an ugly grid. So when we have no artwork we draw some: a deterministic
 * abstract composition derived from the site's URL, tinted with its accent hue.
 * The same site always produces the same picture.
 */

interface CoverArtProps {
  seed: string
  hue: number
  className?: string
  /** letters drawn in the corner, usually the site initials */
  monogram?: string
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function CoverArt({ seed, hue, className, monogram }: CoverArtProps) {
  const h = hashString(seed)
  const rand = mulberry(h)
  const composition = h % 5
  const h1 = hue
  const h2 = (hue + 40 + (h % 60)) % 360
  const h3 = (hue + 180 + (h % 40)) % 360
  const id = `c${h.toString(36)}`

  const shapes: React.ReactNode[] = []

  if (composition === 0) {
    // concentric arcs radiating from a corner
    const cx = rand() > 0.5 ? 0 : 400
    const cy = rand() > 0.5 ? 0 : 250
    for (let i = 8; i >= 1; i--) {
      shapes.push(
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={i * 46}
          fill="none"
          stroke={`hsl(${i % 2 ? h1 : h2} 70% ${58 + i * 2}% / ${0.1 + i * 0.045})`}
          strokeWidth={1 + (i % 3) * 3}
        />,
      )
    }
  } else if (composition === 1) {
    // stacked horizontal bands with varying weight
    let y = 0
    let i = 0
    while (y < 250) {
      const height = 8 + rand() * 44
      shapes.push(
        <rect
          key={i}
          x={-10}
          y={y}
          width={420}
          height={height}
          fill={`hsl(${i % 3 === 0 ? h2 : h1} 68% ${52 + (i % 4) * 8}% / ${0.12 + rand() * 0.35})`}
        />,
      )
      y += height + 3 + rand() * 10
      i++
    }
  } else if (composition === 2) {
    // a scattered dot field with one dominant circle
    shapes.push(
      <circle
        key="big"
        cx={90 + rand() * 220}
        cy={40 + rand() * 170}
        r={60 + rand() * 55}
        fill={`hsl(${h2} 78% 62% / 0.5)`}
      />,
    )
    for (let i = 0; i < 46; i++) {
      shapes.push(
        <circle
          key={i}
          cx={rand() * 400}
          cy={rand() * 250}
          r={1.5 + rand() * 7}
          fill={`hsl(${rand() > 0.7 ? h3 : h1} 72% 64% / ${0.2 + rand() * 0.55})`}
        />,
      )
    }
  } else if (composition === 3) {
    // diagonal ribbons
    for (let i = 0; i < 9; i++) {
      const offset = i * 52 - 120
      shapes.push(
        <polygon
          key={i}
          points={`${offset},260 ${offset + 34},260 ${offset + 168},-10 ${offset + 134},-10`}
          fill={`hsl(${i % 2 ? h1 : h2} 70% ${50 + (i % 3) * 10}% / ${0.14 + (i % 4) * 0.1})`}
        />,
      )
    }
  } else {
    // soft mesh blobs
    for (let i = 0; i < 5; i++) {
      shapes.push(
        <ellipse
          key={i}
          cx={40 + rand() * 330}
          cy={20 + rand() * 210}
          rx={60 + rand() * 110}
          ry={50 + rand() * 90}
          fill={`hsl(${[h1, h2, h3][i % 3]} 74% 60% / ${0.22 + rand() * 0.3})`}
          filter={`url(#blur-${id})`}
        />,
      )
    }
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <svg
        viewBox="0 0 400 250"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${h1} 34% 14%)`} />
            <stop offset="100%" stopColor={`hsl(${h2} 30% 8%)`} />
          </linearGradient>
          <filter id={`blur-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>
        <rect width="400" height="250" fill={`url(#bg-${id})`} />
        {shapes}
      </svg>
      {monogram && (
        <span
          className="pointer-events-none absolute bottom-3 left-4 font-display text-3xl leading-none text-white/80 mix-blend-overlay"
          aria-hidden="true"
        >
          {monogram}
        </span>
      )}
    </div>
  )
}

/**
 * The cover slot used on every card: real artwork when we have it, generated
 * artwork when we do not.
 */
export function SiteCover({
  thumbKey,
  seed,
  hue,
  title,
  className,
  imgClassName,
  priority,
}: {
  thumbKey: string | null
  seed: string
  hue: number
  title: string
  className?: string
  imgClassName?: string
  priority?: boolean
}) {
  const monogram = title
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  if (!thumbKey) {
    return <CoverArt seed={seed} hue={hue} className={className} monogram={monogram} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/thumb/${thumbKey}`}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('h-full w-full object-cover', imgClassName, className)}
    />
  )
}
