/**
 * web-amble database schema (Postgres).
 *
 * Everything is expressed as idempotent DDL so `migrate()` can run on every
 * boot without a migration ledger. Column additions go through `ALTER_STEPS`.
 *
 * Two deliberate choices worth knowing about:
 *
 *  · Timestamps are `text` in `YYYY-MM-DD HH:MM:SS`, not `timestamptz`. Every
 *    comparison and rollup in the app works on that shape, and one
 *    representation of time beats two. `nowIso()` produces it.
 *
 *  · Full-text search is a `tsvector` column on `sites`, maintained by
 *    `reindexSite()`, rather than a trigger — reindexing already happens
 *    explicitly whenever a site's text or tags change.
 */

const TS_NOW = `to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`

export const SCHEMA_SQL = /* sql */ `
-- ---------------------------------------------------------------- taxonomy --
CREATE TABLE IF NOT EXISTS categories (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  tagline     text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  hue         integer NOT NULL DEFAULT 240,
  glyph       text NOT NULL DEFAULT 'square',
  position    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug  text NOT NULL UNIQUE,
  name  text NOT NULL,
  uses  integer NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------- users --
CREATE TABLE IF NOT EXISTS users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  email         text UNIQUE,
  password_hash text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  bio           text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'user',
  created_at    text NOT NULL DEFAULT ${TS_NOW}
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at text NOT NULL DEFAULT ${TS_NOW},
  expires_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ------------------------------------------------------------------- sites --
CREATE TABLE IF NOT EXISTS sites (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  url             text NOT NULL,
  domain          text NOT NULL,
  domain_key      text NOT NULL UNIQUE,
  title           text NOT NULL,
  tagline         text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  category_id     integer REFERENCES categories(id) ON DELETE SET NULL,
  category_locked integer NOT NULL DEFAULT 0,
  favicon_url     text,
  thumb_key       text,
  favicon_key     text,
  thumb_source    text NOT NULL DEFAULT 'none',
  accent_hue      integer NOT NULL DEFAULT 240,
  accent_hex      text NOT NULL DEFAULT '#6f6cf0',
  lang            text NOT NULL DEFAULT 'en',
  status          text NOT NULL DEFAULT 'pending',
  reject_reason   text,
  source          text NOT NULL DEFAULT 'submission',
  source_ref      text,
  submitted_by    integer REFERENCES users(id) ON DELETE SET NULL,
  is_featured     integer NOT NULL DEFAULT 0,
  featured_on     text,
  editor_note     text NOT NULL DEFAULT '',
  attributes      text NOT NULL DEFAULT '{}',
  quality         double precision NOT NULL DEFAULT 0.5,
  votes           integer NOT NULL DEFAULT 0,
  clicks          integer NOT NULL DEFAULT 0,
  views           integer NOT NULL DEFAULT 0,
  trending        double precision NOT NULL DEFAULT 0,
  http_status     integer,
  dead_strikes    integer NOT NULL DEFAULT 0,
  search_tsv      tsvector,
  published_at    text,
  checked_at      text,
  created_at      text NOT NULL DEFAULT ${TS_NOW},
  updated_at      text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_sites_status    ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_category  ON sites(category_id, status);
CREATE INDEX IF NOT EXISTS idx_sites_trending  ON sites(status, trending DESC);
CREATE INDEX IF NOT EXISTS idx_sites_published ON sites(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sites_votes     ON sites(status, votes DESC);
CREATE INDEX IF NOT EXISTS idx_sites_domain    ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_sites_featured  ON sites(featured_on);
CREATE INDEX IF NOT EXISTS idx_sites_search    ON sites USING GIN (search_tsv);

CREATE TABLE IF NOT EXISTS site_tags (
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tag_id  integer NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (site_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_site_tags_tag ON site_tags(tag_id);

-- ------------------------------------------------------------- collections --
CREATE TABLE IF NOT EXISTS collections (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  subtitle     text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  hue          integer NOT NULL DEFAULT 240,
  curator_id   integer REFERENCES users(id) ON DELETE CASCADE,
  is_editorial integer NOT NULL DEFAULT 0,
  is_public    integer NOT NULL DEFAULT 1,
  position     integer NOT NULL DEFAULT 0,
  created_at   text NOT NULL DEFAULT ${TS_NOW},
  updated_at   text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_collections_curator ON collections(curator_id);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id integer NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  site_id       integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  note          text NOT NULL DEFAULT '',
  position      integer NOT NULL DEFAULT 0,
  created_at    text NOT NULL DEFAULT ${TS_NOW},
  PRIMARY KEY (collection_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_items_site ON collection_items(site_id);

-- ------------------------------------------------------------ interactions --
CREATE TABLE IF NOT EXISTS votes (
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at text NOT NULL DEFAULT ${TS_NOW},
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_site ON votes(site_id);

CREATE TABLE IF NOT EXISTS saves (
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id    integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at text NOT NULL DEFAULT ${TS_NOW},
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_saves_site ON saves(site_id);

CREATE TABLE IF NOT EXISTS reports (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id    integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  detail     text NOT NULL DEFAULT '',
  reporter   text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'open',
  created_at text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS site_stats (
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  day     text NOT NULL,
  views   integer NOT NULL DEFAULT 0,
  clicks  integer NOT NULL DEFAULT 0,
  votes   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day)
);
CREATE INDEX IF NOT EXISTS idx_site_stats_day ON site_stats(day);

-- -------------------------------------------------------------- discovery --
CREATE TABLE IF NOT EXISTS sources (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,
  name         text NOT NULL,
  url          text NOT NULL DEFAULT '',
  config       text NOT NULL DEFAULT '{}',
  enabled      integer NOT NULL DEFAULT 1,
  interval_min integer NOT NULL DEFAULT 180,
  last_run_at  text,
  last_result  text NOT NULL DEFAULT '',
  found_total  integer NOT NULL DEFAULT 0,
  created_at   text NOT NULL DEFAULT ${TS_NOW}
);

CREATE TABLE IF NOT EXISTS candidates (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url        text NOT NULL,
  url_key    text NOT NULL UNIQUE,
  source     text NOT NULL DEFAULT 'linkgraph',
  source_ref text,
  found_from text,
  weight     double precision NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'queued',
  note       text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status, weight DESC);

CREATE TABLE IF NOT EXISTS blocklist (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pattern    text NOT NULL UNIQUE,
  reason     text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT ${TS_NOW}
);

-- --------------------------------------------------------------- job queue --
CREATE TABLE IF NOT EXISTS jobs (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type         text NOT NULL,
  payload      text NOT NULL DEFAULT '{}',
  dedupe_key   text UNIQUE,
  status       text NOT NULL DEFAULT 'queued',
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  priority     integer NOT NULL DEFAULT 0,
  run_at       text NOT NULL DEFAULT ${TS_NOW},
  started_at   text,
  finished_at  text,
  error        text,
  result       text,
  created_at   text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_jobs_pick ON jobs(status, run_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type, status);

-- ---------------------------------------------------------------- plumbing --
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket    text NOT NULL,
  subject   text NOT NULL,
  window_at text NOT NULL,
  hits      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor      text NOT NULL DEFAULT 'system',
  action     text NOT NULL,
  target     text NOT NULL DEFAULT '',
  detail     text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT ${TS_NOW}
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`

/** Additive column migrations for databases created by older builds. */
export const ALTER_STEPS: { table: string; column: string; ddl: string }[] = [
  { table: 'sites', column: 'editor_note', ddl: `ALTER TABLE sites ADD COLUMN editor_note text NOT NULL DEFAULT ''` },
  { table: 'sites', column: 'featured_on', ddl: `ALTER TABLE sites ADD COLUMN featured_on text` },
  { table: 'sites', column: 'favicon_key', ddl: `ALTER TABLE sites ADD COLUMN favicon_key text` },
  {
    table: 'sites',
    column: 'category_locked',
    ddl: `ALTER TABLE sites ADD COLUMN category_locked integer NOT NULL DEFAULT 0`,
  },
  { table: 'sites', column: 'search_tsv', ddl: `ALTER TABLE sites ADD COLUMN search_tsv tsvector` },
]
