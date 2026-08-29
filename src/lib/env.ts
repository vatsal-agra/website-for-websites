import path from 'node:path'

function str(key: string, fallback: string): string {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}

function num(key: string, fallback: number): number {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

/** Netlify sets these; they give us the real deploy URL without configuration. */
const netlifyUrl = str('URL', '') || str('DEPLOY_PRIME_URL', '')

export const env = {
  siteUrl: (str('NEXT_PUBLIC_SITE_URL', '') || netlifyUrl || 'http://localhost:3000').replace(/\/+$/, ''),
  siteName: str('NEXT_PUBLIC_SITE_NAME', 'web-amble'),
  dataDir: path.resolve(process.cwd(), str('WEBAMBLE_DATA_DIR', './data')),

  /**
   * Postgres connection string. Use a pooled connection (Supabase's transaction
   * pooler on port 6543, or PgBouncer) — serverless invocations open and drop
   * connections constantly and would exhaust a direct pool.
   */
  databaseUrl: str('DATABASE_URL', ''),
  /** Serverless wants a small pool per instance; a long-lived worker can use more. */
  dbPoolSize: num('DB_POOL_SIZE', 3),
  /** DB_TRACE=1 logs every statement with timing and in-flight count. */
  dbTrace: bool('DB_TRACE', false),

  /** Shared secret guarding the scheduled worker endpoint. */
  workerToken: str('WORKER_TOKEN', ''),

  /** True when running on Netlify — switches blob storage on. */
  isNetlify: Boolean(str('NETLIFY', '')),

  adminUsername: str('ADMIN_USERNAME', 'admin'),
  adminPassword: str('ADMIN_PASSWORD', 'webamble-admin'),
  adminEmail: str('ADMIN_EMAIL', 'admin@localhost'),

  crawlerUserAgent: str('CRAWLER_USER_AGENT', 'AmbleBot/1.0 (+https://webamble.local/about#bot)'),
  crawlerTimeoutMs: num('CRAWLER_TIMEOUT_MS', 12_000),
  crawlerMaxHtmlBytes: num('CRAWLER_MAX_HTML_BYTES', 1_500_000),
  crawlerConcurrency: num('CRAWLER_CONCURRENCY', 4),
  crawlerHostDelayMs: num('CRAWLER_HOST_DELAY_MS', 1500),
  crawlerRespectRobots: bool('CRAWLER_RESPECT_ROBOTS', true),

  workerTickMs: num('WORKER_TICK_MS', 4000),
  workerEnabled: bool('WORKER_ENABLED', true),
  autoApproveQuality: num('AUTO_APPROVE_QUALITY', 0.72),

  screenshotsEnabled: bool('SCREENSHOTS_ENABLED', false),
} as const

export const paths = {
  /** Local scratch space for generated cover art. Netlify Blobs replaces this in production. */
  thumbs: path.join(env.dataDir, 'thumbs'),
} as const
