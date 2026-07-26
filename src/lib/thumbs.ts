import sharp from 'sharp'
import { env } from './env'
import { fetchBinary } from './fetcher'
import { deleteImage, imageExists, putImage } from './storage'
import { hashString, hslToHex } from './utils'

export interface ThumbResult {
  key: string | null
  source: 'og' | 'screenshot' | 'none'
  accentHex: string
  accentHue: number
  faviconKey: string | null
}

const COVER_WIDTH = 1200
const COVER_HEIGHT = 750
const FAVICON_SIZE = 64

export const thumbExists = imageExists
export const deleteThumb = deleteImage

/** Pull a pleasant accent colour out of an image, falling back to a hashed hue. */
async function accentFromImage(buffer: Buffer, fallbackSeed: string): Promise<{ hex: string; hue: number }> {
  try {
    const { dominant } = await sharp(buffer).stats()
    const { r, g, b } = dominant
    const max = Math.max(r, g, b) / 255
    const min = Math.min(r, g, b) / 255
    const l = (max + min) / 2
    let h = 0
    const d = max - min
    if (d !== 0) {
      const rn = r / 255
      const gn = g / 255
      const bn = b / 255
      if (max === rn) h = ((gn - bn) / d) % 6
      else if (max === gn) h = (bn - rn) / d + 2
      else h = (rn - gn) / d + 4
      h = Math.round(h * 60)
      if (h < 0) h += 360
    }
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
    // Normalise into a range that always reads well on both themes
    const hue = d < 0.05 ? hashString(fallbackSeed) % 360 : h
    const sat = Math.round(Math.min(78, Math.max(38, s * 100)))
    return { hex: hslToHex(hue, sat, 58), hue }
  } catch {
    const hue = hashString(fallbackSeed) % 360
    return { hex: hslToHex(hue, 62, 58), hue }
  }
}

export function fallbackAccent(seed: string): { hex: string; hue: number } {
  const hue = hashString(seed) % 360
  return { hex: hslToHex(hue, 62, 58), hue }
}

async function writeCover(buffer: Buffer, key: string): Promise<boolean> {
  try {
    const image = sharp(buffer, { failOn: 'none' })
    const meta = await image.metadata()
    if (!meta.width || !meta.height) return false
    if (meta.width < 240 || meta.height < 140) return false

    const out = await image
      .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'cover', position: 'attention', withoutEnlargement: false })
      .webp({ quality: 78, effort: 4 })
      .toBuffer()
    await putImage(key, out, 'image/webp')
    return true
  } catch {
    return false
  }
}

async function writeFavicon(buffer: Buffer, key: string): Promise<boolean> {
  try {
    const out = await sharp(buffer, { failOn: 'none' })
      .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    await putImage(key, out, 'image/png')
    return true
  } catch {
    return false
  }
}

/** Optional real screenshot. Only used when SCREENSHOTS_ENABLED=1 and playwright is installed. */
async function screenshot(url: string): Promise<Buffer | null> {
  if (!env.screenshotsEnabled) return null
  try {
    const mod: any = await import(/* webpackIgnore: true */ 'playwright' as string).catch(() => null)
    if (!mod?.chromium) return null
    const browser = await mod.chromium.launch({ args: ['--no-sandbox'] })
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        userAgent: env.crawlerUserAgent,
      })
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: env.crawlerTimeoutMs })
      await page.waitForTimeout(700)
      const buf: Buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1280, height: 800 } })
      return buf
    } finally {
      await browser.close().catch(() => {})
    }
  } catch {
    return null
  }
}

/**
 * Build the cover artwork + favicon for a site.
 *
 * Order of preference: real screenshot (opt-in) → og:image → nothing, in which
 * case the UI falls back to generated artwork derived from the accent hue.
 */
export async function buildThumbnail(input: {
  slug: string
  url: string
  imageUrl?: string | null
  faviconUrl?: string | null
}): Promise<ThumbResult> {
  const stamp = hashString(`${input.slug}:${input.url}`).toString(36)
  const coverKey = `${input.slug}-${stamp}.webp`
  const faviconKey = `${input.slug}-${stamp}-icon.png`

  let source: ThumbResult['source'] = 'none'
  let key: string | null = null
  let accent = fallbackAccent(input.url)

  const shot = await screenshot(input.url)
  if (shot && (await writeCover(shot, coverKey))) {
    source = 'screenshot'
    key = coverKey
    accent = await accentFromImage(shot, input.url)
  }

  if (!key && input.imageUrl) {
    const res = await fetchBinary(input.imageUrl)
    if (res.ok && res.buffer && /image\//i.test(res.contentType || 'image/')) {
      if (await writeCover(res.buffer, coverKey)) {
        source = 'og'
        key = coverKey
        accent = await accentFromImage(res.buffer, input.url)
      }
    }
  }

  let savedFavicon: string | null = null
  if (input.faviconUrl) {
    const res = await fetchBinary(input.faviconUrl, 1_500_000)
    if (res.ok && res.buffer && res.buffer.length > 60) {
      if (await writeFavicon(res.buffer, faviconKey)) {
        savedFavicon = faviconKey
        if (source === 'none') {
          const iconAccent = await accentFromImage(res.buffer, input.url)
          accent = iconAccent
        }
      }
    }
  }

  return { key, source, accentHex: accent.hex, accentHue: accent.hue, faviconKey: savedFavicon }
}
