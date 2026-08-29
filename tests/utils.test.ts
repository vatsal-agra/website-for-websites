import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunk, escapeXml, foreignLanguage, formatNumber, hashString, hslToHex, pluralize, seededShuffle, slugify, timeAgo, truncate, uniqueBy } from '../src/lib/utils'

describe('slugify', () => {
  it('makes url-safe slugs', () => {
    assert.equal(slugify('The Public Domain Review'), 'the-public-domain-review')
    assert.equal(slugify('musicForProgramming();'), 'musicforprogramming')
    assert.equal(slugify("Butterick's Practical Typography"), 'buttericks-practical-typography')
  })

  it('never returns an empty slug', () => {
    assert.equal(slugify(''), 'site')
    assert.equal(slugify('!!!'), 'site')
  })

  it('never leaves a trailing dash after truncation', () => {
    const s = slugify('a very long title that will certainly be cut somewhere in the middle of it', 20)
    assert.ok(s.length <= 20)
    assert.doesNotMatch(s, /-$/)
  })
})

describe('truncate', () => {
  it('leaves short strings alone', () => {
    assert.equal(truncate('short', 20), 'short')
  })

  it('cuts on a word boundary when it can', () => {
    const out = truncate('the quick brown fox jumps over', 20)
    assert.ok(out.length <= 20)
    assert.match(out, /…$/)
    assert.doesNotMatch(out, / …$/)
  })
})

describe('formatNumber', () => {
  it('abbreviates large numbers', () => {
    assert.equal(formatNumber(42), '42')
    assert.equal(formatNumber(1200), '1.2k')
    assert.equal(formatNumber(15_000), '15k')
    assert.equal(formatNumber(2_000_000), '2M')
  })

  it('copes with rubbish input rather than printing NaN', () => {
    assert.equal(formatNumber(Number.NaN), '0')
    assert.equal(formatNumber(Infinity), '0')
  })
})

describe('pluralize', () => {
  it('agrees with the count', () => {
    assert.equal(pluralize(1, 'site'), '1 site')
    assert.equal(pluralize(2, 'site'), '2 sites')
    assert.equal(pluralize(0, 'entry', 'entries'), '0 entries')
  })
})

describe('timeAgo', () => {
  it('reads the database timestamp format as UTC', () => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000)
    const stamp = twoHoursAgo.toISOString().replace('T', ' ').slice(0, 19)
    assert.match(timeAgo(stamp), /2 hours ago/)
  })

  it('says "just now" for the present', () => {
    assert.equal(timeAgo(new Date()), 'just now')
  })

  it('handles missing values without throwing', () => {
    assert.equal(timeAgo(null), '—')
    assert.equal(timeAgo(undefined), '—')
    assert.equal(timeAgo('not a date'), '—')
  })
})

describe('hashString / hslToHex', () => {
  it('is deterministic, so a site always gets the same artwork', () => {
    assert.equal(hashString('https://a.dev'), hashString('https://a.dev'))
    assert.notEqual(hashString('https://a.dev'), hashString('https://b.dev'))
  })

  it('produces valid hex colours', () => {
    for (const h of [0, 90, 200, 359]) {
      assert.match(hslToHex(h, 60, 55), /^#[0-9a-f]{6}$/)
    }
  })
})

describe('seededShuffle', () => {
  it('is stable for a given seed and keeps every item', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = seededShuffle(items, 42)
    const b = seededShuffle(items, 42)
    assert.deepEqual(a, b)
    assert.deepEqual([...a].sort((x, y) => x - y), items)
  })

  it('does not mutate the input', () => {
    const items = [1, 2, 3]
    seededShuffle(items, 7)
    assert.deepEqual(items, [1, 2, 3])
  })
})

describe('uniqueBy / chunk', () => {
  it('keeps the first of each key', () => {
    const out = uniqueBy([{ id: 1, n: 'a' }, { id: 1, n: 'b' }, { id: 2, n: 'c' }], (x) => x.id)
    assert.deepEqual(out.map((x) => x.n), ['a', 'c'])
  })

  it('chunks without losing anything', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
    assert.deepEqual(chunk([], 3), [])
  })
})

describe('escapeXml', () => {
  it('escapes everything that would break a feed', () => {
    assert.equal(escapeXml('a & b <c> "d" \'e\''), 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;')
  })
})

describe('foreignLanguage', () => {
  it('says nothing about English, or about a page that did not say', () => {
    for (const lang of ['en', 'EN', 'en-gb', 'en-US', '', null, undefined, 'x']) {
      assert.equal(foreignLanguage(lang), null, String(lang))
    }
  })

  it('names the language for everything else', () => {
    assert.deepEqual(foreignLanguage('fr'), { code: 'FR', name: 'French' })
    assert.deepEqual(foreignLanguage('uk'), { code: 'UK', name: 'Ukrainian' })
    assert.deepEqual(foreignLanguage('pt-BR'), { code: 'PT', name: 'Portuguese' })
  })

  it('stays quiet rather than echoing a code it does not know', () => {
    assert.equal(foreignLanguage('zz'), null)
    assert.equal(foreignLanguage('qqq'), null)
  })
})
