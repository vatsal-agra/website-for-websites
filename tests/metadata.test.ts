import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cleanTitle, makeTagline, parseMetadata } from '../src/lib/metadata'

const html = (body: string, head = '') => `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`

describe('cleanTitle', () => {
  it('drops a trailing brand that just repeats the domain', () => {
    assert.equal(cleanTitle('Compress images fast | Squoosh', 'squoosh.app'), 'Compress images fast')
    assert.equal(cleanTitle('Learn CSS — MDN', 'mdn.example'), 'Learn CSS — MDN')
  })

  it('replaces a generic page title with something identifying', () => {
    // "Home" names a page, not a site
    assert.equal(cleanTitle('Home', 'oeglobal.org'), 'Oeglobal')
    assert.equal(cleanTitle('Welcome', 'kottke.org'), 'Kottke')
    assert.equal(cleanTitle('Untitled Document', 'someplace.dev'), 'Someplace')
  })

  it('prefers the declared site name over the domain when a title is generic', () => {
    assert.equal(cleanTitle('Home', 'example.dev', 'Open Education Global'), 'Open Education Global')
  })

  it('leaves a good title alone', () => {
    assert.equal(cleanTitle('The Public Domain Review', 'publicdomainreview.org'), 'The Public Domain Review')
  })
})

describe('parseMetadata', () => {
  it('reads the basics a listing needs', () => {
    const meta = parseMetadata(
      html(
        '<h1>Hello</h1><p>Some words here.</p>',
        `<title>A Site</title>
         <meta name="description" content="What the site is for.">
         <meta property="og:image" content="/cover.png">
         <link rel="icon" href="/favicon.ico">
         <link rel="alternate" type="application/rss+xml" href="/feed.xml">`,
      ),
      'https://a.dev',
    )
    assert.equal(meta.title, 'A Site')
    assert.equal(meta.description, 'What the site is for.')
    assert.equal(meta.imageUrl, 'https://a.dev/cover.png')
    assert.equal(meta.faviconUrl, 'https://a.dev/favicon.ico')
    assert.deepEqual(meta.feeds, ['https://a.dev/feed.xml'])
    assert.equal(meta.lang, 'en')
  })

  it('never mistakes an svg <title> for the page title', () => {
    const meta = parseMetadata(
      html(
        `<svg viewBox="0 0 16 16"><title>Slash forward icon</title><path d="M0 0"/></svg>
         <h1>Flags SDK</h1><p>Feature flags for anything.</p>`,
        '', // no document <title>, as on a client-rendered page
      ),
      'https://flags-sdk.dev',
    )
    assert.equal(meta.title, 'Flags SDK')
  })

  it('resolves relative urls against the page', () => {
    const meta = parseMetadata(html('', '<meta property="og:image" content="img/x.png">'), 'https://a.dev/blog/post')
    assert.equal(meta.imageUrl, 'https://a.dev/blog/img/x.png')
  })

  it('separates outbound links from internal ones', () => {
    const meta = parseMetadata(
      html('<a href="/about">in</a><a href="https://other.dev">out</a><a href="https://other.dev/x">dupe</a>'),
      'https://a.dev',
    )
    assert.equal(meta.internalLinkCount, 1)
    assert.equal(meta.outboundLinks.length, 1, 'one entry per external domain')
    assert.match(meta.outboundLinks[0], /other\.dev/)
  })

  it('ignores links to platforms when harvesting the link graph', () => {
    const meta = parseMetadata(html('<a href="https://twitter.com/me">x</a>'), 'https://a.dev')
    assert.equal(meta.outboundLinks.length, 0)
  })

  it('detects ad networks and paywalls', () => {
    const ads = parseMetadata(
      html('<p>hi</p>', '<script src="https://pagead2.googlesyndication.com/x.js"></script>'),
      'https://a.dev',
    )
    assert.equal(ads.signals.hasAdScripts, true)

    const paywalled = parseMetadata(html('<p>Subscribe to continue reading this article.</p>'), 'https://a.dev')
    assert.equal(paywalled.signals.hasPaywallHint, true)
  })

  it('recognises a parked domain', () => {
    const parked = parseMetadata(html('<p>This domain may be for sale. Related searches.</p>'), 'https://a.dev')
    assert.equal(parked.signals.isParked, true)
  })

  it('survives malformed html without throwing', () => {
    assert.doesNotThrow(() => parseMetadata('<html><body><p>unclosed', 'https://a.dev'))
    assert.doesNotThrow(() => parseMetadata('', 'https://a.dev'))
  })
})

describe('makeTagline', () => {
  it('takes the first sentence when it stands alone', () => {
    const meta = parseMetadata(
      html('', '<meta name="description" content="A place to find good websites. And then some more text.">'),
      'https://a.dev',
    )
    assert.equal(makeTagline(meta), 'A place to find good websites.')
  })

  it('never exceeds the card width budget', () => {
    const meta = parseMetadata(
      html('', `<meta name="description" content="${'word '.repeat(80)}">`),
      'https://a.dev',
    )
    assert.ok(makeTagline(meta).length <= 120)
  })
})
