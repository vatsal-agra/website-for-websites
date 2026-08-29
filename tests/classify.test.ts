import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classify, deriveAttributes, scoreQuality } from '../src/lib/classify'
import type { PageMetadata, PageSignals } from '../src/lib/metadata'

const signals = (over: Partial<PageSignals> = {}): PageSignals => ({
  hasAdScripts: false,
  hasAnalytics: false,
  hasPaywallHint: false,
  hasLoginWall: false,
  isParked: false,
  scriptCount: 5,
  wordCount: 400,
  headingCount: 3,
  interactiveCount: 2,
  hasViewport: true,
  hasManifest: false,
  hasOpenGraph: true,
  hasStructuredData: false,
  ...over,
})

const page = (over: Partial<PageMetadata> = {}): PageMetadata => ({
  url: 'https://example.dev',
  title: '',
  siteName: '',
  description: '',
  imageUrl: null,
  faviconUrl: null,
  lang: 'en',
  keywords: [],
  feeds: [],
  outboundLinks: [],
  internalLinkCount: 10,
  canonical: null,
  themeColor: null,
  textSample: '',
  signals: signals(),
  ...over,
})

describe('classify', () => {
  it('files a typeface site under design', () => {
    const result = classify(
      page({ title: 'Klim Type Foundry', description: 'Retail and custom typefaces, and writing about type design.' }),
    )
    assert.equal(result.categorySlug, 'design')
  })

  it('files a browser game under games', () => {
    const result = classify(
      page({ title: 'Daily Chess Puzzle', description: 'A new chess puzzle to play in your browser every day.' }),
    )
    assert.equal(result.categorySlug, 'games')
  })

  it('matches inflected forms, not just exact words', () => {
    // "funding early stage startups" must count for the term "startup".
    // Without this, Y Combinator was filed under Science & Data.
    const result = classify(
      page({
        title: 'Y Combinator',
        description: 'We created a new model for funding early stage startups. Jobs and careers at our companies.',
      }),
    )
    assert.equal(result.categorySlug, 'work')
  })

  it('falls back to curios rather than guessing when there is no signal', () => {
    const result = classify(page({ title: 'aaa', description: 'bbb' }))
    assert.equal(result.categorySlug, 'curios')
  })

  it('only ever emits tags from the fixed vocabulary', () => {
    const result = classify(
      page({ title: 'Open source mapping tools', description: 'Maps, cartography and open data for everyone.' }),
    )
    assert.ok(result.tags.length > 0)
    for (const tag of result.tags) {
      assert.match(tag, /^[a-z0-9-]+$/, `tag "${tag}" is not a clean slug`)
    }
    assert.ok(result.tags.length <= 6, 'never more than six tags')
  })
})

describe('deriveAttributes', () => {
  it('spots an open-source project from its links', () => {
    const attrs = deriveAttributes(page({ outboundLinks: ['https://github.com/someone/thing'] }))
    assert.equal(attrs.openSource, true)
  })

  it('marks a site with ad networks as not ad-free', () => {
    assert.equal(deriveAttributes(page({ signals: signals({ hasAdScripts: true }) })).noAds, false)
    assert.equal(deriveAttributes(page()).noAds, true)
  })

  it('marks a login wall as requiring signup', () => {
    assert.equal(deriveAttributes(page({ signals: signals({ hasLoginWall: true }) })).noSignup, false)
  })

  it('reports a feed when one is advertised', () => {
    assert.equal(deriveAttributes(page({ feeds: ['https://a.dev/rss'] })).hasFeed, true)
  })
})

describe('scoreQuality', () => {
  const http = { status: 200, elapsedMs: 500, https: true }

  it('scores a well-made page highly', () => {
    const { score } = scoreQuality(
      page({
        title: 'A Real Site',
        description: 'A description long enough to actually tell you what this website is for and why.',
        imageUrl: 'https://a.dev/og.png',
        feeds: ['https://a.dev/rss'],
        signals: signals({ wordCount: 900, headingCount: 6, interactiveCount: 8 }),
      }),
      http,
    )
    assert.ok(score > 0.75, `expected a high score, got ${score}`)
  })

  it('scores a parked domain near zero', () => {
    const { score } = scoreQuality(
      page({ title: 'example', signals: signals({ isParked: true, wordCount: 5 }) }),
      http,
    )
    assert.ok(score < 0.2, `expected a very low score, got ${score}`)
  })

  it('penalises ad networks, paywalls and login walls', () => {
    const base = scoreQuality(page({ description: 'x'.repeat(80) }), http).score
    const adverts = scoreQuality(
      page({ description: 'x'.repeat(80), signals: signals({ hasAdScripts: true }) }),
      http,
    ).score
    const wall = scoreQuality(
      page({ description: 'x'.repeat(80), signals: signals({ hasLoginWall: true }) }),
      http,
    ).score
    assert.ok(adverts < base)
    assert.ok(wall < base)
  })

  it('always returns a value between 0 and 1', () => {
    for (const status of [200, 404, 500]) {
      const { score } = scoreQuality(page(), { status, elapsedMs: 20_000, https: false })
      assert.ok(score >= 0 && score <= 1, `score ${score} out of range`)
    }
  })
})
