/**
 * The shelf plan. Sixteen categories that between them can hold anything on the
 * open web, each with a hue that drives its generative artwork, and a weighted
 * lexicon used by the auto-classifier.
 */

export interface CategorySeed {
  slug: string
  name: string
  tagline: string
  description: string
  hue: number
  glyph: string
  /** term -> weight. Terms are matched as whole words against title+desc+url+tags. */
  lexicon: Record<string, number>
}

const w = (terms: string[], weight: number): Record<string, number> =>
  Object.fromEntries(terms.map((t) => [t, weight]))

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    slug: 'tools',
    name: 'Tools & Utilities',
    tagline: 'Small software that does one thing well.',
    description:
      'Converters, calculators, generators, cleaners and single-purpose utilities. The kind of page you bookmark once and use for years.',
    hue: 262,
    glyph: 'wrench',
    lexicon: {
      ...w(['tool', 'utility', 'converter', 'generator', 'calculator', 'formatter'], 3),
      ...w(['compress', 'convert', 'resize', 'editor', 'cleaner', 'checker', 'validator'], 2),
      ...w(['online', 'free tool', 'no signup', 'browser based', 'instantly'], 1),
    },
  },
  {
    slug: 'developer',
    name: 'Developer',
    tagline: 'For the people who build the thing.',
    description:
      'Documentation, libraries, playgrounds, APIs, devtools and engineering writing.',
    hue: 205,
    glyph: 'terminal',
    lexicon: {
      ...w(['developer', 'programming', 'javascript', 'typescript', 'python', 'rust', 'golang'], 3),
      ...w(['api', 'sdk', 'framework', 'library', 'open source', 'github', 'cli', 'docs'], 2),
      ...w(['database', 'devops', 'kubernetes', 'compiler', 'regex', 'terminal', 'git'], 2),
      ...w(['code', 'software', 'engineering', 'backend', 'frontend'], 1),
    },
  },
  {
    slug: 'design',
    name: 'Design & Type',
    tagline: 'Colour, form, letterform, layout.',
    description:
      'Type foundries, colour tools, icon sets, design systems, portfolios and inspiration galleries.',
    hue: 330,
    glyph: 'palette',
    lexicon: {
      ...w(['design', 'typography', 'typeface', 'font', 'foundry', 'colour', 'color palette'], 3),
      ...w(['icons', 'ui kit', 'figma', 'illustration', 'mockup', 'gradient', 'css'], 2),
      ...w(['inspiration', 'portfolio', 'brand', 'layout', 'aesthetic', 'visual'], 1),
    },
  },
  {
    slug: 'learning',
    name: 'Learning',
    tagline: 'Places to get better at something.',
    description:
      'Courses, tutorials, explainers, practice drills and interactive lessons across every discipline.',
    hue: 32,
    glyph: 'graduation',
    lexicon: {
      ...w(['learn', 'course', 'tutorial', 'lesson', 'teach', 'education', 'study'], 3),
      ...w(['explainer', 'guide', 'exercises', 'practice', 'flashcards', 'curriculum', 'university'], 2),
      ...w(['beginner', 'how to', 'academy', 'school', 'training'], 1),
    },
  },
  {
    slug: 'reading',
    name: 'Reading & Writing',
    tagline: 'Long sentences, good paragraphs.',
    description:
      'Personal blogs, essay collections, magazines, newsletters and writing tools.',
    hue: 12,
    glyph: 'book',
    lexicon: {
      ...w(['blog', 'essay', 'writing', 'newsletter', 'magazine', 'journal', 'zine'], 3),
      ...w(['articles', 'longform', 'author', 'poetry', 'fiction', 'notebook', 'digital garden'], 2),
      ...w(['thoughts', 'notes', 'reading', 'stories'], 1),
    },
  },
  {
    slug: 'art',
    name: 'Art & Visual',
    tagline: 'Things made to be looked at.',
    description:
      'Galleries, generative art, photography, museums online and visual experiments.',
    hue: 300,
    glyph: 'frame',
    lexicon: {
      ...w(['art', 'gallery', 'museum', 'photography', 'painting', 'generative art', 'exhibition'], 3),
      ...w(['artist', 'sculpture', 'collage', 'drawing', 'prints', 'visual art', 'creative coding'], 2),
      ...w(['images', 'portfolio', 'photo'], 1),
    },
  },
  {
    slug: 'music',
    name: 'Music & Audio',
    tagline: 'For the ears.',
    description:
      'Radio, sound toys, music discovery, instruments in the browser, podcasts and audio tools.',
    hue: 285,
    glyph: 'waveform',
    lexicon: {
      ...w(['music', 'audio', 'radio', 'sound', 'podcast', 'synth', 'record'], 3),
      ...w(['album', 'playlist', 'listening', 'drum machine', 'sampler', 'vinyl', 'song'], 2),
      ...w(['band', 'track', 'noise', 'ambient'], 1),
    },
  },
  {
    slug: 'games',
    name: 'Games & Play',
    tagline: 'Ten minutes that become an hour.',
    description:
      'Browser games, puzzles, daily challenges, toys and interactive playthings.',
    hue: 148,
    glyph: 'joystick',
    lexicon: {
      ...w(['game', 'puzzle', 'play', 'daily challenge', 'wordle', 'arcade', 'chess'], 3),
      ...w(['multiplayer', 'idle game', 'roguelike', 'trivia', 'quiz', 'toy', 'sandbox'], 2),
      ...w(['fun', 'levels', 'score'], 1),
    },
  },
  {
    slug: 'science',
    name: 'Science & Data',
    tagline: 'Evidence, models, numbers.',
    description:
      'Datasets, visualisations, research portals, simulations and scientific explainers.',
    hue: 190,
    glyph: 'atom',
    lexicon: {
      ...w(['science', 'research', 'dataset', 'data', 'statistics', 'physics', 'biology'], 3),
      ...w(['visualisation', 'visualization', 'chart', 'astronomy', 'climate', 'simulation', 'paper'], 2),
      ...w(['study', 'model', 'analysis', 'math', 'mathematics'], 1),
    },
  },
  {
    slug: 'maps',
    name: 'Maps & Places',
    tagline: 'The world, rendered.',
    description:
      'Cartography, travel, transit, geography toys and location-shaped curiosities.',
    hue: 165,
    glyph: 'compass',
    lexicon: {
      ...w(['map', 'maps', 'atlas', 'geography', 'cartography', 'travel', 'transit'], 3),
      ...w(['city', 'country', 'globe', 'satellite', 'street', 'hiking', 'flights'], 2),
      ...w(['places', 'location', 'world'], 1),
    },
  },
  {
    slug: 'work',
    name: 'Money & Work',
    tagline: 'Making a living, made legible.',
    description:
      'Careers, freelancing, business tooling, personal finance and productivity systems.',
    hue: 100,
    glyph: 'briefcase',
    lexicon: {
      ...w(['job', 'jobs', 'career', 'hiring', 'freelance', 'salary', 'invoice'], 3),
      ...w(['startup', 'business', 'finance', 'investing', 'budget', 'tax', 'productivity'], 2),
      ...w(['remote work', 'resume', 'client', 'money'], 1),
    },
  },
  {
    slug: 'health',
    name: 'Health & Body',
    tagline: 'Sleep, move, breathe, rest.',
    description:
      'Fitness, nutrition, mental health, medical reference and calm-down corners of the web.',
    hue: 350,
    glyph: 'heart',
    lexicon: {
      ...w(['health', 'fitness', 'workout', 'nutrition', 'meditation', 'sleep', 'mental health'], 3),
      ...w(['exercise', 'yoga', 'running', 'therapy', 'wellbeing', 'medical', 'anxiety'], 2),
      ...w(['body', 'calm', 'breathing'], 1),
    },
  },
  {
    slug: 'food',
    name: 'Food & Home',
    tagline: 'Kitchen, garden, four walls.',
    description:
      'Recipes, cooking technique, gardening, repair guides and everything domestic.',
    hue: 24,
    glyph: 'bowl',
    lexicon: {
      ...w(['recipe', 'recipes', 'cooking', 'food', 'baking', 'kitchen', 'garden'], 3),
      ...w(['coffee', 'tea', 'restaurant', 'gardening', 'diy', 'repair', 'home'], 2),
      ...w(['meal', 'ingredients', 'plants'], 1),
    },
  },
  {
    slug: 'news',
    name: 'News & Culture',
    tagline: 'What is happening, and what it means.',
    description:
      'Independent journalism, aggregators, criticism, film, television and internet culture.',
    hue: 222,
    glyph: 'radio',
    lexicon: {
      ...w(['news', 'journalism', 'reporting', 'culture', 'film', 'cinema', 'television'], 3),
      ...w(['review', 'criticism', 'aggregator', 'headlines', 'media', 'politics', 'books'], 2),
      ...w(['daily', 'weekly', 'coverage'], 1),
    },
  },
  {
    slug: 'archives',
    name: 'Archives & Reference',
    tagline: 'The long memory of the web.',
    description:
      'Libraries, encyclopedias, digitised collections, dictionaries and lookup tables.',
    hue: 240,
    glyph: 'archive',
    lexicon: {
      ...w(['archive', 'library', 'encyclopedia', 'reference', 'dictionary', 'collection'], 3),
      ...w(['catalogue', 'catalog', 'digitised', 'digitized', 'public domain', 'history', 'index'], 2),
      ...w(['lookup', 'database of', 'records'], 1),
    },
  },
  {
    slug: 'curios',
    name: 'Web Curios',
    tagline: 'Gloriously unnecessary.',
    description:
      'Single-serving sites, oddities, experiments and things that exist purely because someone felt like it.',
    hue: 55,
    glyph: 'sparkle',
    lexicon: {
      ...w(['weird', 'useless', 'random', 'single serving', 'oddity', 'strange', 'silly'], 3),
      ...w(['experiment', 'pointless', 'absurd', 'nonsense', 'curious', 'bizarre'], 2),
      ...w(['just because', 'for fun'], 1),
    },
  },
]

export const DEFAULT_CATEGORY_SLUG = 'curios'

/** Attributes surfaced as filter chips across the product. */
export const ATTRIBUTE_DEFS = [
  { key: 'free', label: 'Free to use', hint: 'No paywall on the core experience' },
  { key: 'noSignup', label: 'No signup', hint: 'Works without an account' },
  { key: 'openSource', label: 'Open source', hint: 'Source code is public' },
  { key: 'noAds', label: 'Ad-free', hint: 'No advertising detected' },
  { key: 'interactive', label: 'Interactive', hint: 'Something to play with, not just read' },
  { key: 'longform', label: 'Longform', hint: 'Substantial writing' },
  { key: 'hasFeed', label: 'Has a feed', hint: 'RSS or Atom available' },
] as const

export type AttributeKey = (typeof ATTRIBUTE_DEFS)[number]['key']
