import { hashString } from './utils'

/**
 * Shared building blocks for the generated Open Graph cards.
 *
 * These render through Satori (`next/og`), which supports only a subset of CSS
 * — no gradients on text, no shorthand `background`, flex only. Everything here
 * is written to stay inside that subset, and deliberately uses no external
 * fonts so a card can be produced offline and without a network round trip on
 * every share.
 */

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const CANVAS = '#0a0a0c'
const INK = '#ededf0'
const MUTED = '#8a8a94'

/**
 * Satori does not parse `hsla()`, so colours are converted to `rgba()` here.
 * Everything else in the codebase thinks in hue, and this keeps it that way.
 */
export function hsl(h: number, s: number, l: number, a = 1) {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const to255 = (v: number) => Math.round((v + m) * 255)
  return `rgba(${to255(r1)}, ${to255(g1)}, ${to255(b1)}, ${a})`
}

/**
 * The same deterministic composition idea as the in-app cover art: a few soft
 * blobs positioned from a hash of the seed, so every card looks distinct but a
 * given site always produces the same one.
 */
export function Backdrop({ seed, hue }: { seed: string; hue: number }) {
  const h = hashString(seed)
  // Satori has no blur filter, but it does render radial gradients — which is
  // what produces the soft wash the in-app cover art gets from a blur.
  // One gradient per layer: Satori applies only the first of a comma-separated
  // backgroundImage list, so the wash is built by stacking divs instead.
  const layers = [0, 1, 2].map((i) => {
    const x = 8 + ((h >> (i * 5)) % 84)
    const y = 6 + ((h >> (i * 7 + 3)) % 78)
    const spread = 48 + ((h >> (i * 3)) % 26)
    const tint = (hue + i * 52) % 360
    // kept low: the chrome is meant to be quiet, and the text sits on top of it
    const alpha = 0.34 - i * 0.09
    return {
      key: i,
      image: `radial-gradient(${spread}% ${spread}% at ${x}% ${y}%, ${hsl(tint, 80, 56, alpha)} 0%, ${hsl(tint, 80, 56, 0)} 68%)`,
    }
  })

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' }}>
      {layers.map((layer) => (
        <div
          key={layer.key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundImage: layer.image,
          }}
        />
      ))}
    </div>
  )
}

/** The three-column mark, drawn inline because Satori cannot load components. */
export function Mark({ size = 34, color = INK }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 18c3.5 0 3.5-5 7-5s3.5-6 7-6c2 0 3 1 6 1"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="18" r="1.9" fill={color} />
      <circle cx="22" cy="8" r="1.9" fill={color} />
    </svg>
  )
}

export function Frame({ children, seed, hue }: { children: React.ReactNode; seed: string; hue: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: CANVAS,
        color: INK,
        fontFamily: 'sans-serif',
        padding: 72,
      }}
    >
      <Backdrop seed={seed} hue={hue} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
        {children}
      </div>
    </div>
  )
}

export function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <Mark />
      <span style={{ fontSize: 30, letterSpacing: -0.5, color: INK }}>web-amble</span>
    </div>
  )
}

export function Footline({ left, right }: { left: string; right?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: 24,
        color: MUTED,
      }}
    >
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  )
}

export const OG_COLORS = { CANVAS, INK, MUTED }

/** Satori has no line-clamp, so long copy is trimmed before it is rendered. */
export function clamp(text: string, max: number): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}
