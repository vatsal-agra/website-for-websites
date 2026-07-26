export interface SeedSite {
  url: string
  title: string
  tagline: string
  category: string
  tags: string[]
  attrs?: string[]
  /** override the default seed quality score */
  quality?: number
  /** editorial note shown on the site page */
  note?: string
}

export interface SeedCollection {
  slug: string
  title: string
  subtitle: string
  description: string
  hue: number
  /** urls of member sites, in display order */
  sites: string[]
}
