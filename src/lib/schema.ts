/**
 * Portico database schema.
 *
 * Everything is expressed as idempotent DDL so `migrate()` can run on every
 * boot without a migration ledger. Column additions go through `ALTER_STEPS`.
 */

export const SCHEMA_SQL = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ---------------------------------------------------------------- taxonomy --
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  hue         INTEGER NOT NULL DEFAULT 240,
  glyph       TEXT NOT NULL DEFAULT 'square',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  uses  INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------- users --
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user',   -- user | admin
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ------------------------------------------------------------------- sites --
CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  url           TEXT NOT NULL,
  domain        TEXT NOT NULL,
  domain_key    TEXT NOT NULL UNIQUE,       -- dedupe key: host w/o www (+ path for sub-pages)
  title         TEXT NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  -- set when a human picks the shelf, so re-crawls never undo curation
  category_locked INTEGER NOT NULL DEFAULT 0,
  favicon_url   TEXT,
  thumb_key     TEXT,                        -- file under data/thumbs
  favicon_key   TEXT,                        -- cached favicon under data/thumbs
  thumb_source  TEXT NOT NULL DEFAULT 'none',-- og | screenshot | none
  accent_hue    INTEGER NOT NULL DEFAULT 240,
  accent_hex    TEXT NOT NULL DEFAULT '#6f6cf0',
  lang          TEXT NOT NULL DEFAULT 'en',
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | archived
  reject_reason TEXT,
  source        TEXT NOT NULL DEFAULT 'submission',
  source_ref    TEXT,
  submitted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_featured   INTEGER NOT NULL DEFAULT 0,
  featured_on   TEXT,                        -- YYYY-MM-DD when it was site of the day
  editor_note   TEXT NOT NULL DEFAULT '',
  attributes    TEXT NOT NULL DEFAULT '{}',  -- json flags: free, openSource, noSignup, hasFeed...
  quality       REAL NOT NULL DEFAULT 0.5,
  votes         INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  views         INTEGER NOT NULL DEFAULT 0,
  trending      REAL NOT NULL DEFAULT 0,
  http_status   INTEGER,
  dead_strikes  INTEGER NOT NULL DEFAULT 0,
  published_at  TEXT,
  checked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sites_status      ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_category    ON sites(category_id, status);
CREATE INDEX IF NOT EXISTS idx_sites_trending    ON sites(status, trending DESC);
CREATE INDEX IF NOT EXISTS idx_sites_published   ON sites(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sites_votes       ON sites(status, votes DESC);
CREATE INDEX IF NOT EXISTS idx_sites_domain      ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_sites_featured    ON sites(featured_on);

CREATE TABLE IF NOT EXISTS site_tags (
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (site_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_site_tags_tag ON site_tags(tag_id);

-- full-text search (contentless; kept in sync by lib/queries/sites#reindexSite)
CREATE VIRTUAL TABLE IF NOT EXISTS sites_fts USING fts5(
  title, tagline, description, domain, tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- ------------------------------------------------------------- collections --
CREATE TABLE IF NOT EXISTS collections (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  subtitle     TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  hue          INTEGER NOT NULL DEFAULT 240,
  curator_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_editorial INTEGER NOT NULL DEFAULT 0,
  is_public    INTEGER NOT NULL DEFAULT 1,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collections_curator ON collections(curator_id);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  note          TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_items_site ON collection_items(site_id);

-- ------------------------------------------------------------ interactions --
CREATE TABLE IF NOT EXISTS votes (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_site ON votes(site_id);

CREATE TABLE IF NOT EXISTS saves (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_saves_site ON saves(site_id);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY,
  site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  reporter   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- daily rollup so the trending score has a time window to work with
CREATE TABLE IF NOT EXISTS site_stats (
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  views   INTEGER NOT NULL DEFAULT 0,
  clicks  INTEGER NOT NULL DEFAULT 0,
  votes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day)
);
CREATE INDEX IF NOT EXISTS idx_site_stats_day ON site_stats(day);

-- ------------------------------------------------------------- discovery ----
CREATE TABLE IF NOT EXISTS sources (
  id            INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL,               -- hackernews | rss | linkgraph
  name          TEXT NOT NULL,
  url           TEXT NOT NULL DEFAULT '',
  config        TEXT NOT NULL DEFAULT '{}',
  enabled       INTEGER NOT NULL DEFAULT 1,
  interval_min  INTEGER NOT NULL DEFAULT 180,
  last_run_at   TEXT,
  last_result   TEXT NOT NULL DEFAULT '',
  found_total   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- candidate URLs waiting to be fetched + evaluated
CREATE TABLE IF NOT EXISTS candidates (
  id          INTEGER PRIMARY KEY,
  url         TEXT NOT NULL,
  url_key     TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'linkgraph',
  source_ref  TEXT,
  found_from  TEXT,
  weight      REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | done | skipped | failed
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status, weight DESC);

CREATE TABLE IF NOT EXISTS blocklist (
  id         INTEGER PRIMARY KEY,
  pattern    TEXT NOT NULL UNIQUE,   -- host suffix match
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------- job queue --
CREATE TABLE IF NOT EXISTS jobs (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',
  dedupe_key  TEXT UNIQUE,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  attempts    INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  priority    INTEGER NOT NULL DEFAULT 0,
  run_at      TEXT NOT NULL DEFAULT (datetime('now')),
  started_at  TEXT,
  finished_at TEXT,
  error       TEXT,
  result      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_pick ON jobs(status, run_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type, status);

-- ---------------------------------------------------------------- plumbing --
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  window_at  TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY,
  actor      TEXT NOT NULL DEFAULT 'system',
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`

/** Additive column migrations for databases created by older builds. */
export const ALTER_STEPS: { table: string; column: string; ddl: string }[] = [
  { table: 'sites', column: 'editor_note', ddl: `ALTER TABLE sites ADD COLUMN editor_note TEXT NOT NULL DEFAULT ''` },
  { table: 'sites', column: 'featured_on', ddl: `ALTER TABLE sites ADD COLUMN featured_on TEXT` },
  { table: 'sites', column: 'favicon_key', ddl: `ALTER TABLE sites ADD COLUMN favicon_key TEXT` },
  {
    table: 'sites',
    column: 'category_locked',
    ddl: `ALTER TABLE sites ADD COLUMN category_locked INTEGER NOT NULL DEFAULT 0`,
  },
]
