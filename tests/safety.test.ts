import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { screenContent } from '../src/lib/safety'
import type { PageMetadata, PageSignals } from '../src/lib/metadata'

const signals = (over: Partial<PageSignals> = {}): PageSignals => ({
  hasAdScripts: false,
  hasAnalytics: false,
  hasPaywallHint: false,
  hasLoginWall: false,
  isParked: false,
  scriptCount: 3,
  wordCount: 300,
  headingCount: 2,
  interactiveCount: 1,
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
  internalLinkCount: 5,
  canonical: null,
  themeColor: null,
  textSample: '',
  signals: signals(),
  ...over,
})

/**
 * The filter is deliberately narrow: this is a directory of the open web, so
 * the cost of a false positive (a good site refused) is as real as the cost of
 * a false negative. These tests pin both edges.
 */
describe('screenContent', () => {
  it('blocks piracy and malware services', () => {
    const verdict = screenContent(page({ textSample: 'download the latest crack keygen and nulled script here' }))
    assert.equal(verdict.allowed, false)
    assert.equal(verdict.action, 'block')
  })

  it('blocks obvious scams', () => {
    const verdict = screenContent(page({ textSample: 'double your bitcoin in 24 hours, guaranteed profit' }))
    assert.equal(verdict.allowed, false)
  })

  it('blocks a parked domain', () => {
    const verdict = screenContent(page({ signals: signals({ isParked: true }) }))
    assert.equal(verdict.allowed, false)
    assert.match(verdict.reason, /parked/)
  })

  it('sends borderline content to a human rather than deciding itself', () => {
    const verdict = screenContent(page({ textSample: 'our guide to betting odds this season' }))
    assert.equal(verdict.allowed, true)
    assert.equal(verdict.action, 'review')
  })

  it('does not refuse ordinary sites that merely mention a flagged word', () => {
    // a security researcher writing about cracking passwords is not piracy,
    // and a museum page about nudes in art is not adult content
    const research = screenContent(
      page({
        title: 'Password security research',
        textSample: 'We analyse how attackers approach password cracking and what defends against it.',
      }),
    )
    assert.equal(research.allowed, true, research.reason)

    const museum = screenContent(
      page({
        title: 'The Rijksmuseum collection',
        textSample: 'Paintings, drawings and prints from the Dutch Golden Age.',
      }),
    )
    assert.equal(museum.allowed, true)
    assert.equal(museum.action, 'allow')
  })

  it('lets a completely ordinary page through untouched', () => {
    const verdict = screenContent(
      page({
        title: 'Squoosh',
        description: 'Compress and compare images in the browser.',
        textSample:
          'Drag an image in and compare codecs side by side. Everything happens locally in your browser; ' +
          'nothing is uploaded. Supports WebP, AVIF, JPEG XL and the usual formats.',
      }),
    )
    assert.equal(verdict.allowed, true)
    assert.equal(verdict.action, 'allow')
    assert.equal(verdict.reason, '')
  })
})
