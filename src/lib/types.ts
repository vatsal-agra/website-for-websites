export type SiteStatus = 'pending' | 'approved' | 'rejected' | 'archived'
export type ThumbSource = 'og' | 'screenshot' | 'none'
export type UserRole = 'user' | 'admin'

export interface SiteAttributes {
  free?: boolean
  openSource?: boolean
  noSignup?: boolean
  hasFeed?: boolean
  noAds?: boolean
  interactive?: boolean
  longform?: boolean
  [key: string]: boolean | undefined
}

export interface SiteRow {
  id: number
  slug: string
  url: string
  domain: string
  domain_key: string
  title: string
  tagline: string
  description: string
  category_id: number | null
  favicon_url: string | null
  thumb_key: string | null
  favicon_key: string | null
  thumb_source: ThumbSource
  accent_hue: number
  accent_hex: string
  lang: string
  status: SiteStatus
  reject_reason: string | null
  source: string
  source_ref: string | null
  submitted_by: number | null
  is_featured: number
  featured_on: string | null
  editor_note: string
  attributes: string
  quality: number
  votes: number
  clicks: number
  views: number
  trending: number
  http_status: number | null
  dead_strikes: number
  published_at: string | null
  checked_at: string | null
  created_at: string
  updated_at: string
}

export interface Site extends Omit<SiteRow, 'attributes'> {
  attributes: SiteAttributes
  category: Category | null
  tags: Tag[]
  viewerVoted?: boolean
  viewerSaved?: boolean
  /** present when the site was loaded as part of a collection */
  collectionNote?: string
}

export interface Category {
  id: number
  slug: string
  name: string
  tagline: string
  description: string
  hue: number
  glyph: string
  position: number
  count?: number
}

export interface Tag {
  id: number
  slug: string
  name: string
  uses: number
}

export interface Collection {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  hue: number
  curator_id: number | null
  is_editorial: number
  is_public: number
  position: number
  created_at: string
  updated_at: string
  curator?: PublicUser | null
  count?: number
  sites?: Site[]
}

export interface PublicUser {
  id: number
  username: string
  display_name: string
  bio: string
  role: UserRole
  created_at: string
}

export interface JobRow {
  id: number
  type: string
  payload: string
  dedupe_key: string | null
  status: 'queued' | 'running' | 'done' | 'failed'
  attempts: number
  max_attempts: number
  priority: number
  run_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  result: string | null
  created_at: string
}

export interface SourceRow {
  id: number
  kind: 'hackernews' | 'rss' | 'linkgraph'
  name: string
  url: string
  config: string
  enabled: number
  interval_min: number
  last_run_at: string | null
  last_result: string
  found_total: number
  created_at: string
}

export interface CandidateRow {
  id: number
  url: string
  url_key: string
  source: string
  source_ref: string | null
  found_from: string | null
  weight: number
  status: 'queued' | 'done' | 'skipped' | 'failed'
  note: string
  created_at: string
}

export type SortKey = 'trending' | 'new' | 'top' | 'random' | 'alpha'

export interface BrowseFilters {
  q?: string
  category?: string
  tag?: string
  sort?: SortKey
  attrs?: string[]
  page?: number
  perPage?: number
}
