import type { SeedSite } from './types'

/**
 * Third wave, aimed squarely at the shelves the crawler cannot reach.
 *
 * Automatic discovery follows links from sites already listed, and the web's
 * link graph is thick around software and design and thin everywhere else. Left
 * to itself the catalogue drifts towards more of what it already has: Developer
 * had sixty entries here while Health & Body had twenty-two, and no amount of
 * crawling was going to close that.
 *
 * Every entry below was fetched through `npm run score` before it was written
 * down — the score, the category and the signals are what the ingester actually
 * made of the live page, not what I assumed. Two candidates that returned 403
 * to the crawler were dropped rather than listed on faith, and two more turned
 * out to be catalogued already.
 *
 * Categories are stated explicitly where the classifier disagreed with the
 * obvious answer: it files pain science under Science and typeset ebooks under
 * Design, both defensible and both wrong for a reader looking for them.
 */
export const SEED_SITES_E: SeedSite[] = [
  // ----------------------------------------------------------------- health --
  { url: 'https://www.painscience.com', title: 'PainScience.com', tagline: 'One writer reading the pain research so you do not have to, and saying plainly when the evidence is thin.', category: 'health', tags: ['health', 'research', 'writing', 'reference'], attrs: ['free', 'noSignup', 'noAds', 'longform'] },
  { url: 'https://www.mhanational.org', title: 'Mental Health America', tagline: 'Screening tools and plain-language guidance from the oldest mental health non-profit in the country.', category: 'health', tags: ['health', 'reference', 'education'], attrs: ['free', 'noSignup', 'noAds'] },
  { url: 'https://www.sleepeducation.org', title: 'Sleep Education', tagline: 'The American Academy of Sleep Medicine explaining what is actually known about sleep, disorder by disorder.', category: 'health', tags: ['health', 'education', 'reference'], attrs: ['free', 'noSignup', 'noAds'] },
  { url: 'https://www.eatright.org', title: 'EatRight', tagline: 'Nutrition advice from the dietitians’ professional body — unglamorous, sourced, and free of a product to sell.', category: 'health', tags: ['health', 'cooking', 'reference'], attrs: ['free', 'noSignup'] },
  { url: 'https://www.arthritis.org', title: 'Arthritis Foundation', tagline: 'What arthritis is, what helps, and what the evidence says about everything people try.', category: 'health', tags: ['health', 'reference', 'education'], attrs: ['free', 'noSignup'] },

  // -------------------------------------------------------------------- art --
  { url: 'https://www.spoon-tamago.com', title: 'Spoon & Tamago', tagline: 'Japanese art, design and architecture, covered in English since 2007 by somebody who actually goes.', category: 'art', tags: ['design', 'inspiration', 'writing'], attrs: ['free', 'noSignup', 'hasFeed'] },
  { url: 'https://50watts.com', title: '50 Watts', tagline: 'A private museum of book covers, illustration and graphic oddities from places you have never heard of.', category: 'art', tags: ['illustration', 'books', 'archive', 'inspiration'], attrs: ['free', 'noSignup'] },
  { url: 'https://hyperallergic.com', title: 'Hyperallergic', tagline: 'Art criticism that argues with the art world rather than advertising for it.', category: 'art', tags: ['journalism', 'writing', 'inspiration'], attrs: ['free', 'hasFeed'] },
  { url: 'https://www.cooperhewitt.org', title: 'Cooper Hewitt', tagline: 'The Smithsonian’s design museum, with a collection of 200,000 objects put online properly.', category: 'art', tags: ['design', 'archive', 'history'], attrs: ['free', 'noSignup'] },

  // ------------------------------------------------------------------- food --
  { url: 'https://www.seedsavers.org', title: 'Seed Savers Exchange', tagline: 'A non-profit seed bank keeping thousands of heirloom varieties in circulation by giving them away.', category: 'food', tags: ['plants', 'archive', 'community'], attrs: ['free', 'noSignup'] },
  { url: 'https://www.foodtimeline.org', title: 'The Food Timeline', tagline: 'When did people start eating this? A librarian’s answer, cited, for four thousand years of food.', category: 'food', tags: ['history', 'reference', 'archive', 'cooking'], attrs: ['free', 'noSignup', 'noAds'] },
  { url: 'https://www.chefsteps.com', title: 'ChefSteps', tagline: 'Technique explained like engineering — why the method works, not just the order of the steps.', category: 'food', tags: ['cooking', 'education', 'video'], attrs: ['free', 'interactive'] },
  { url: 'https://www.gardenorganic.org.uk', title: 'Garden Organic', tagline: 'Fifty years of organic growing research from a British charity, including a heritage seed library.', category: 'food', tags: ['plants', 'research', 'education'], attrs: ['free', 'noSignup'] },
  { url: 'https://www.gardenersworld.com', title: 'Gardeners’ World', tagline: 'What to plant, when, and what is going wrong — for the specific weather Britain has.', category: 'food', tags: ['plants', 'reference', 'video'], attrs: ['free', 'hasFeed'] },

  // ---------------------------------------------------------------- reading --
  { url: 'https://www.poetryfoundation.org', title: 'Poetry Foundation', tagline: 'Tens of thousands of poems, free, with the archive of Poetry magazine going back to 1912.', category: 'reading', tags: ['books', 'archive', 'writing'], attrs: ['free', 'noSignup'] },
  { url: 'https://www.thebrowser.com', title: 'The Browser', tagline: 'Five things worth reading, chosen by a person, every day since 2008.', category: 'reading', tags: ['aggregator', 'writing', 'daily'], attrs: ['hasFeed'] },
  { url: 'https://thepointmag.com', title: 'The Point', tagline: 'A magazine that asks what philosophy is for, and answers at essay length.', category: 'reading', tags: ['writing', 'research'], attrs: ['free', 'longform', 'hasFeed'] },
  { url: 'https://www.nplusonemag.com', title: 'n+1', tagline: 'Politics, literature and culture, argued at length and without a house line.', category: 'reading', tags: ['writing', 'journalism'], attrs: ['longform', 'hasFeed'] },

  // --------------------------------------------------------------- archives --
  { url: 'https://www.openculture.com', title: 'Open Culture', tagline: 'Free courses, films, audiobooks and textbooks, indexed by hand for nearly twenty years.', category: 'archives', tags: ['archive', 'education', 'aggregator', 'film'], attrs: ['free', 'noSignup', 'hasFeed'] },
]
