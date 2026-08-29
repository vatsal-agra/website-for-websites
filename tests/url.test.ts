import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  displayUrl,
  isIndexableUrl,
  isServiceSubdomain,
  normalizeUrl,
  rootDomain,
} from '../src/lib/url'

describe('normalizeUrl', () => {
  it('adds a scheme when one is missing', () => {
    assert.equal(normalizeUrl('example.dev')?.href, 'https://example.dev/')
  })

  it('strips tracking parameters but keeps meaningful ones', () => {
    const n = normalizeUrl('https://a.dev/x?utm_source=hn&fbclid=1&page=2&q=cats')
    assert.equal(n?.href, 'https://a.dev/x?page=2&q=cats')
  })

  it('sorts query parameters so the dedupe key is stable', () => {
    const a = normalizeUrl('https://a.dev/x?b=2&a=1')
    const b = normalizeUrl('https://a.dev/x?a=1&b=2')
    assert.equal(a?.key, b?.key)
  })

  it('treats www and bare hosts as the same site', () => {
    assert.equal(normalizeUrl('https://www.a.dev')?.key, normalizeUrl('https://a.dev')?.key)
  })

  it('drops a trailing slash but keeps the root path', () => {
    assert.equal(normalizeUrl('https://a.dev/blog/')?.href, 'https://a.dev/blog')
    assert.equal(normalizeUrl('https://a.dev/')?.href, 'https://a.dev/')
  })

  it('rejects things that are not public web pages', () => {
    for (const bad of [
      'mailto:me@a.dev',
      'javascript:alert(1)',
      'http://localhost:3000',
      'https://192.168.0.1',
      'not a url at all',
      '',
    ]) {
      assert.equal(normalizeUrl(bad), null, `expected ${bad} to be rejected`)
    }
  })

  it('handles protocol-relative urls', () => {
    assert.equal(normalizeUrl('//a.dev/x')?.href, 'https://a.dev/x')
  })
})

describe('rootDomain', () => {
  it('finds the registrable domain', () => {
    assert.equal(rootDomain('a.dev'), 'a.dev')
    assert.equal(rootDomain('eyes.nasa.gov'), 'nasa.gov')
    assert.equal(rootDomain('deep.sub.example.org'), 'example.org')
  })

  it('understands multi-part public suffixes', () => {
    assert.equal(rootDomain('shop.example.co.uk'), 'example.co.uk')
    assert.equal(rootDomain('example.com.au'), 'example.com.au')
  })
})

describe('isServiceSubdomain', () => {
  it('flags facilities of a site rather than destinations', () => {
    for (const host of ['shop.brand.com', 'help.brand.com', 'careers.brand.com', 'status.brand.com']) {
      assert.equal(isServiceSubdomain(host), true, host)
    }
  })

  it('leaves real destinations alone', () => {
    for (const host of ['brand.com', 'www.brand.com', 'eyes.nasa.gov', 'lobste.rs']) {
      assert.equal(isServiceSubdomain(host), false, host)
    }
  })
})

describe('isIndexableUrl', () => {
  const check = (url: string) => isIndexableUrl(normalizeUrl(url)!)

  it('accepts ordinary sites and shallow pages', () => {
    assert.equal(check('https://a.dev').ok, true)
    assert.equal(check('https://a.dev/about').ok, true)
  })

  it('rejects file downloads', () => {
    assert.equal(check('https://a.dev/paper.pdf').ok, false)
    assert.equal(check('https://a.dev/build.zip').ok, false)
  })

  it('rejects social profiles and other platforms', () => {
    assert.equal(check('https://twitter.com/someone').ok, false)
    assert.equal(check('https://www.youtube.com/watch?v=1').ok, false)
  })

  it('rejects account and checkout pages', () => {
    assert.equal(check('https://a.dev/login').ok, false)
    assert.equal(check('https://a.dev/checkout').ok, false)
  })

  it('rejects deep sub-pages, which are articles rather than sites', () => {
    assert.equal(check('https://a.dev/2024/03/11/some-post').ok, false)
  })
})

describe('displayUrl', () => {
  it('drops the scheme and truncates', () => {
    assert.equal(displayUrl('https://www.example.dev/tools'), 'example.dev/tools')
    assert.ok(displayUrl('https://example.dev/' + 'x'.repeat(80), 20).length <= 20)
  })
})
