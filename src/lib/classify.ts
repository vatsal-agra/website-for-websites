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
 * Deliberately conservative: it gates auto-approval of crawled sites.
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
    if (Math.abs(delta) >= 0.04) reasons.push(`${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${why}`)
  }

  if (meta.title && meta.title.length > 3) add(0.08, 'has a real title')
  if (meta.description.length >= 60) add(0.12, 'meaningful description')
  else if (meta.description.length >= 20) add(0.05, 'short description')
  else add(-0.1, 'no description')

  if (meta.imageUrl) add(0.08, 'social image')
  if (s.hasOpenGraph) add(0.04, 'open graph tags')
  if (s.hasViewport) add(0.05, 'mobile viewport')
  if (s.hasStructuredData) add(0.02, 'structured data')
  if (meta.feeds.length) add(0.04, 'publishes a feed')
  if (http.https) add(0.05, 'https')
  else add(-0.12, 'no https')

  if (s.wordCount > 250) add(0.07, 'substantive content')
  else if (s.wordCount < 60) add(-0.14, 'almost no content')

  if (s.headingCount >= 2) add(0.03, 'structured headings')
  if (s.interactiveCount >= 6) add(0.04, 'interactive elements')

  if (s.hasAdScripts) add(-0.14, 'ad networks present')
  if (s.hasPaywallHint) add(-0.1, 'paywall detected')
  if (s.hasLoginWall) add(-0.16, 'login wall')
  if (s.isParked) add(-0.6, 'looks like a parked domain')
  if (s.scriptCount > 60) add(-0.05, 'very script heavy')

  if (http.elapsedMs > 6000) add(-0.05, 'slow response')
  else if (http.elapsedMs < 900) add(0.03, 'fast response')

  if (http.status >= 400) add(-0.5, `http ${http.status}`)

  return { score: Number(clamp(score, 0, 1).toFixed(3)), reasons }
}
