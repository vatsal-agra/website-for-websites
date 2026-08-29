import { CATEGORY_SEEDS, DEFAULT_CATEGORY_SLUG } from './taxonomy'
import type { PageMetadata } from './metadata'
import type { SiteAttributes } from './types'
import { normalizeUrl } from './url'
import { clamp } from './utils'

/**
 * Canonical tag vocabulary. Auto-tagging only ever emits tags from this list,
 * which keeps the tag cloud clean instead of turning into meta-keyword soup.
 */
const TAG_LEXICON: Record<string, string[]> = {
  'ai': ['artificial intelligence', ' ai ', 'machine learning', 'llm', 'neural network', 'gpt'],
  'accessibility': ['accessibility', 'a11y', 'screen reader', 'wcag'],
  'animation': ['animation', 'animated', 'motion design', 'easing'],
  'archive': ['archive', 'archival', 'digitised', 'digitized', 'preservation'],
  'astronomy': ['astronomy', 'space', 'telescope', 'nasa', 'planets', 'cosmos'],
  'audio': ['audio', 'sound', 'listening'],
  'beautiful': ['beautifully', 'gorgeous', 'stunning visuals'],
  'books': ['books', 'book', 'reading list', 'bibliography', 'novel'],
  'browser-game': ['browser game', 'play in your browser', 'html5 game'],
  'calculator': ['calculator', 'compute', 'estimator'],
  'charts': ['chart', 'charts', 'graphing', 'dataviz', 'data visualisation', 'data visualization'],
  'cli': ['command line', 'cli', 'terminal'],
  'climate': ['climate', 'carbon', 'emissions', 'sustainability'],
  'colour': ['color palette', 'colour palette', 'color picker', 'hex code'],
  'community': ['community', 'forum', 'members'],
  'converter': ['converter', 'convert to', 'transcode'],
  'cooking': ['cooking', 'recipe', 'kitchen', 'baking'],
  'css': ['css', 'stylesheet', 'tailwind'],
  'daily': ['daily puzzle', 'new every day', 'once a day', 'daily challenge'],
  'database': ['database', 'sql', 'postgres', 'sqlite'],
  'dictionary': ['dictionary', 'definition', 'thesaurus', 'etymology'],
  'documentation': ['documentation', 'docs', 'reference manual', 'api reference'],
  'education': ['education', 'curriculum', 'classroom'],
  'email': ['email', 'newsletter', 'inbox'],
  'encyclopedia': ['encyclopedia', 'encyclopaedia', 'wiki'],
  'fediverse': ['fediverse', 'activitypub', 'mastodon'],
  'film': ['film', 'movies', 'cinema', 'documentary'],
  'fonts': ['font', 'typeface', 'foundry', 'typography'],
  'games': ['game', 'gaming', 'gameplay'],
  'generative': ['generative', 'procedural', 'creative coding'],
  'geography': ['geography', 'atlas', 'cartography'],
  'graphics': ['graphics', 'webgl', 'shader', 'three.js', 'rendering'],
  'history': ['history', 'historical', 'archaeology', 'century'],
  'icons': ['icon set', 'icons', 'iconography', 'svg icons'],
  'illustration': ['illustration', 'illustrator', 'drawing'],
  'indie-web': ['indieweb', 'indie web', 'personal site', 'webring', 'small web'],
  'interactive': ['interactive', 'explorable', 'play with'],
  'javascript': ['javascript', 'typescript', 'node.js', 'react'],
  'jobs': ['jobs', 'hiring', 'careers', 'vacancies'],
  'language': ['language learning', 'vocabulary', 'grammar', 'translation'],
  'maps': ['map', 'mapping', 'openstreetmap'],
  'minimal': ['minimal', 'minimalist', 'no clutter', 'distraction free'],
  'music': ['music', 'song', 'album', 'playlist'],
  'newsletter': ['newsletter', 'subscribe for updates'],
  'nostalgia': ['nostalgia', 'retro', 'vintage', '90s web', 'geocities'],
  'notes': ['note taking', 'notes app', 'zettelkasten', 'digital garden'],
  'open-data': ['open data', 'public dataset', 'csv download'],
  'open-source': ['open source', 'github.com', 'mit license', 'gpl'],
  'photography': ['photography', 'photographer', 'photo essay'],
  'physics': ['physics', 'quantum', 'relativity', 'mechanics'],
  'podcast': ['podcast', 'episodes'],
  'privacy': ['privacy', 'no tracking', 'encrypted', 'anonymous'],
  'productivity': ['productivity', 'todo', 'task manager', 'focus timer', 'pomodoro'],
  'programming': ['programming', 'coding', 'developer'],
  'puzzle': ['puzzle', 'riddle', 'crossword', 'sudoku'],
  'radio': ['radio', 'live stream', 'broadcast'],
  'science': ['science', 'scientific', 'research'],
  'search': ['search engine', 'searchable', 'find anything'],
  'security': ['security', 'cybersecurity', 'infosec', 'vulnerability'],
  'self-hosted': ['self hosted', 'self-hosting', 'homelab', 'docker compose'],
  'simulation': ['simulation', 'simulator', 'sandbox model'],
  'statistics': ['statistics', 'statistical', 'probability'],
  'templates': ['template', 'boilerplate', 'starter kit'],
  'timeline': ['timeline', 'chronology'],
  'tools': ['tool', 'utility', 'toolkit'],
  'travel': ['travel', 'trip', 'itinerary', 'flights'],
  'typography': ['typography', 'lettering', 'kerning'],
  'video': ['video', 'streaming', 'watch'],
  'weather': ['weather', 'forecast', 'meteorology'],
  'weird': ['weird', 'bizarre', 'strange', 'oddity', 'useless'],
  'writing': ['writing', 'writer', 'essays', 'prose'],
}

function haystack(meta: PageMetadata): string {
  const n = normalizeUrl(meta.url)
  return [
    meta.title,
    meta.siteName,
    meta.description,
    meta.keywords.join(' '),
    n ? n.domain.replace(/[.-]/g, ' ') : '',
    n ? n.path.replace(/[/-]/g, ' ') : '',
    meta.textSample.slice(0, 2500),
  ]
    .join(' \n ')
    .toLowerCase()
}

const termCache = new Map<string, RegExp>()

/**
 * Whole-word match with light inflection, so "startup" also matches "startups"
 * and "map" matches "maps"/"mapping". Without this a page whose whole pitch is
 * "funding early stage startups" scores zero for the term "startup", which is
 * how Y Combinator once ended up filed under Science & Data.
 */
function countTerm(text: string, term: string): number {
  if (!term) return 0
  let re = termCache.get(term)
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = term.includes(' ')
      ? new RegExp(escaped, 'g')
      : // optional plural / gerund / simple verb endings
        new RegExp(`\\b${escaped}(?:s|es|ing|ed)?\\b`, 'g')
    termCache.set(term, re)
  }
  re.lastIndex = 0
  return (text.match(re) ?? []).length
}

export interface Classification {
  categorySlug: string
  categoryConfidence: number
  tags: string[]
  scores: Record<string, number>
}

export function classify(meta: PageMetadata): Classification {
  const text = haystack(meta)
  // Weight the title heavily — it is the strongest single signal.
  const titleText = `${meta.title} ${meta.siteName} ${meta.keywords.join(' ')}`.toLowerCase()

  const scores: Record<string, number> = {}
  for (const cat of CATEGORY_SEEDS) {
    let score = 0
    for (const [term, weight] of Object.entries(cat.lexicon)) {
      const inBody = countTerm(text, term)
      const inTitle = countTerm(titleText, term)
      if (inBody) score += weight * Math.min(inBody, 4) * 0.5
      if (inTitle) score += weight * 3
    }
    scores[cat.slug] = Number(score.toFixed(2))
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [bestSlug, bestScore] = ranked[0] ?? [DEFAULT_CATEGORY_SLUG, 0]
  const runnerUp = ranked[1]?.[1] ?? 0
  const confidence = bestScore <= 0 ? 0 : clamp((bestScore - runnerUp) / Math.max(bestScore, 1) + 0.25, 0, 1)

  const categorySlug = bestScore < 3 ? DEFAULT_CATEGORY_SLUG : bestSlug

  // ------------------------------------------------------------------- tags
  const tagScores: [string, number][] = []
  for (const [tag, terms] of Object.entries(TAG_LEXICON)) {
    let s = 0
    for (const term of terms) {
      s += countTerm(text, term) * 1 + countTerm(titleText, term) * 4
    }
    if (s > 0) tagScores.push([tag, s])
  }
  tagScores.sort((a, b) => b[1] - a[1])
  const tags = tagScores.slice(0, 6).map(([t]) => t)

  return { categorySlug, categoryConfidence: Number(confidence.toFixed(2)), tags, scores }
}

export function deriveAttributes(meta: PageMetadata): SiteAttributes {
  const s = meta.signals
  const text = `${meta.description} ${meta.textSample.slice(0, 3000)}`.toLowerCase()
  return {
    free: !s.hasPaywallHint && !/\b(pricing|per month|\$\d+\/mo|subscription required)\b/.test(text),
    noSignup: !s.hasLoginWall && !/\b(create an account|sign up to get started|start free trial)\b/.test(text),
    openSource: /\b(open source|github\.com|source code|mit license|apache-2|gpl)\b/.test(text) ||
      meta.outboundLinks.some((l) => l.includes('github.com')),
    noAds: !s.hasAdScripts,
    interactive: s.interactiveCount >= 6,
    longform: s.wordCount > 900,
    hasFeed: meta.feeds.length > 0,
  }
}

/**
 * A 0..1 estimate of "is this worth a slot on the shelf".
 *
 * Two jobs: it gates auto-approval of crawled sites, and it is a ranking input
 * for the trending and hidden-gems shelves. The second is why the balance
 * matters as much as the threshold.
 *
 * An earlier version handed out +0.31 for social metadata — a description, an
 * OG image, OG tags, a viewport, structured data — against +0.07 for having
 * anything to read. The result was exactly backwards. Corporate landing pages,
 * which have a marketing team and therefore perfect metadata, scored 0.90 and
 * above; the Online Encyclopedia of Integer Sequences scored 0.45, and
 * neal.fun 0.46. The catalogue was ranking adverts above the things people
 * actually come here to find.
 *
 * So: metadata now buys almost nothing, substance buys a lot, and a page that
 * reads like a sales funnel is penalised for it. A well-made plain page should
 * beat a beautifully-tagged brochure, because to a reader it does.
 *
 * What this still cannot do is tell an excellent company website from an
 * excellent independent one — a genuinely good product page scores like a good
 * page, because it is one. That is what the review queue is for, and why the
 * auto-approve threshold stays where it is rather than being lowered to catch
 * more of the crawl.
 */
export function scoreQuality(meta: PageMetadata, http: { status: number; elapsedMs: number; https: boolean }): {
  score: number
  reasons: string[]
} {
  const s = meta.signals
  const reasons: string[] = []
  let score = 0.34

  const add = (delta: number, why: string) => {
    score += delta
    if (Math.abs(delta) >= 0.03) reasons.push(`${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${why}`)
  }

  // --- is this a real page at all -----------------------------------------
  if (meta.title && meta.title.length > 3) add(0.06, 'has a real title')
  if (http.https) add(0.05, 'https')
  else add(-0.12, 'no https')
  if (http.status >= 400) add(-0.5, `http ${http.status}`)
  if (s.isParked) add(-0.6, 'looks like a parked domain')
  if (s.hasLoginWall) add(-0.16, 'login wall')
  if (s.hasPaywallHint) add(-0.1, 'paywall detected')
  if (s.hasAdScripts) add(-0.14, 'ad networks present')

  // --- is there anything here ---------------------------------------------
  //
  // Word count alone reads two very different pages as blank. The front door
  // of the Encyclopedia of Integer Sequences is a search box and 140 words;
  // neal.fun's is a wall of links and 51. Both are doorways to an enormous
  // amount of work. Meanwhile a single-page marketing app inlines seventeen
  // thousand words of copy behind six links and looks like a library.
  //
  // Internal links tell those apart: 72 and 44 for the first two, 6 for the
  // third. So depth counts only when the page is also navigable, and a page
  // with little text but many of its own pages is an index, not an empty room.
  const isIndex = meta.internalLinkCount >= 30
  const isDeep = s.wordCount >= 900 && meta.internalLinkCount >= 10

  if (isDeep) add(0.13, 'a lot to read')
  else if (s.wordCount >= 250) add(0.1, 'substantive content')
  else if (isIndex) add(0.12, 'an index of its own work')
  else if (s.wordCount < 60) add(-0.14, 'almost no content')

  if (isIndex) add(0.05, 'many pages of its own')

  if (s.headingCount >= 3) add(0.06, 'structured headings')
  else if (s.headingCount >= 1) add(0.02, 'has a heading')

  // A page that links out is part of the web rather than a destination trying
  // to keep you. Cheap to fake, but nobody bothers.
  if (meta.outboundLinks.length >= 8) add(0.07, 'links out generously')
  else if (meta.outboundLinks.length >= 3) add(0.03, 'links out')

  if (meta.feeds.length) add(0.07, 'publishes a feed')
  if (s.interactiveCount >= 6) add(0.04, 'interactive elements')

  // --- is it a thing, or an advert for a thing ----------------------------
  if (s.funnelPhrases >= 5) add(-0.2, 'reads like a sales funnel')
  else if (s.funnelPhrases >= 3) add(-0.12, 'marketing-heavy')
  else if (s.funnelPhrases >= 2) add(-0.05, 'some marketing copy')

  // --- presentation: worth a little, because the card looks better ---------
  if (meta.description.length >= 60) add(0.05, 'meaningful description')
  else if (meta.description.length >= 20) add(0.02, 'short description')
  else add(-0.04, 'no description')

  if (meta.imageUrl) add(0.03, 'social image')
  if (s.hasViewport) add(0.02, 'mobile viewport')
  if (s.hasOpenGraph) add(0.01, 'open graph tags')
  if (s.hasStructuredData) add(0.01, 'structured data')

  if (s.scriptCount > 60) add(-0.05, 'very script heavy')
  if (http.elapsedMs > 6000) add(-0.05, 'slow response')
  else if (http.elapsedMs < 900) add(0.03, 'fast response')

  return { score: Number(clamp(score, 0, 1).toFixed(3)), reasons }
}
