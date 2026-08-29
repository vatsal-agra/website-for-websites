# web-amble

**A storefront for the whole web.**

App stores gave software a place to be browsed. Websites never got one. Search engines are excellent
when you already know what you want and useless when you do not — web-amble exists for the second case.

People publish their site's URL to web-amble, or web-amble finds it on its own. Each entry gets a cover, a
one-line description, a category, tags and a quality score. Readers browse the shelves, follow curated
collections, search, or press **Shuffle** and land somewhere they would never have searched for.

---

## Running it

```bash
npm install
npm run setup      # create the database, seed 240+ hand-catalogued sites
npm run dev        # http://localhost:3000
```

In a second terminal, start the engine that keeps the catalogue alive:

```bash
npm run worker
```

The worker fetches cover art, polls discovery sources, ingests new sites, re-checks old ones and
recomputes trending. Without it the site works fine — it just stops growing.

Admin console at **/admin**. Default credentials are in `.env.local` (`admin` / `webamble-admin`).
Change them before putting this anywhere public.

---

## How it works

### The pipeline

Every URL — submitted or discovered — goes through the same path:

| Stage | What happens | Code |
| --- | --- | --- |
| **Normalise** | Strip tracking params, resolve the host, build a dedupe key | `src/lib/url.ts` |
| **Screen** | Blocklist, platform hosts, file extensions, suspicious TLDs | `src/lib/safety.ts` |
| **Fetch** | One polite request: robots.txt respected, per-host delay, byte cap, timeout | `src/lib/fetcher.ts` |
| **Parse** | Title, description, og:image, favicon, feeds, language, outbound links, ad/paywall/parked signals | `src/lib/metadata.ts` |
| **Classify** | Weighted lexicon picks 1 of 16 categories and up to 6 tags from a fixed vocabulary | `src/lib/classify.ts` |
| **Score** | Quality 0–1 from page evidence — what there is to read, whether the page links out, whether it reads like a sales funnel | `src/lib/classify.ts` |
| **Store** | Insert, build the search vector, queue cover art, harvest outbound links as new candidates | `src/lib/ingest.ts` |

Discovered sites scoring above `AUTO_APPROVE_QUALITY` go live automatically. Everything else — and
every human submission — waits in the moderation queue.

### Discovery

Three source types, all free and keyless, managed at `/admin/sources`:

- **Hacker News** — top, best and Show HN, filtered by score
- **RSS/Atom** — link blogs (Lobsters, Kottke, Waxy, Sidebar), optionally harvesting links inside each entry
- **Link graph** — re-reads sites already in the catalogue and follows their outbound links

Good sites link to good sites. That turns out to be most of the signal you need — with one
correction. Draining candidates strictly by score walks the graph breadth-first out of whichever
neighbourhood happens to rank highest, and a directory fills up with twelve variations on the same
documentation site. Each drain takes at most two candidates per discovering domain, so every
neighbourhood gets a turn.

### What the quality score is for

It gates auto-listing, and it is a ranking input for the category shelves and hidden gems. That
second job is why its balance matters as much as its threshold.

An earlier version paid +0.31 for social metadata — description, `og:image`, viewport, structured
data — against +0.07 for having anything to read. Corporate landing pages have a marketing team and
therefore perfect metadata, so they scored above 0.90; the Encyclopedia of Integer Sequences scored
0.45, below the floor for appearing on a shelf at all. The directory was ranking adverts above the
things people come to a directory to find.

Now metadata buys almost nothing, substance buys a lot, sales-funnel vocabulary is a penalty, and
word count is never read on its own — a one-page marketing app inlines 17,000 words behind six links
while OEIS has 140 words and seventy-two, so depth only counts when a page is navigable too.

```bash
npm run score -- https://oeis.org https://some-saas.com
```

prints the score, the category and every term that contributed, against the live page. What it still
cannot do is tell an excellent company website from an excellent independent one. That is what the
review queue is for.

### Ranking

```
trending = (votes·5 + clicks·1.5 + views·0.2 + quality·3) / (days_listed + 3)^0.3
```

Engagement first, with a quality floor and gentle time decay. The gentle decay is
deliberate: with a young catalogue almost nothing has been voted on, and a steep decay would make
"Trending" a duplicate of "Newest" — burying curated entries under whatever the crawler found ten
minutes ago. Public, simple, and the only thing that decides order. No paid placement.

**Every number on the site is a real one.** Votes, clicks and views start at zero and only move when
somebody actually does something. The founding catalogue carries the date it was really catalogued.
Nothing is back-dated or padded to make a fresh install look busier than it is.

### Cover art

Preference order: opt-in screenshot → the site's own `og:image` → **generated artwork**. The generator
derives a composition (arcs, bands, dot fields, ribbons, mesh) and palette from a hash of the URL, so
every site has a distinctive cover and the same site always produces the same picture.

---

## Deploying to Netlify

Netlify Functions have no persistent disk and no long-running process, so two things live
off the filesystem. Everything else deploys as-is.

| Concern | How it works |
| --- | --- |
| Database | Postgres over a pooled connection (Supabase, Neon, or any Postgres) |
| Cover art | Netlify Blobs in production, `data/thumbs/` locally |
| Background work | `npm run worker` loop locally; a scheduled function poking `/api/worker` every 5 minutes on Netlify |

**1. Get a Postgres database.** Any provider works. On Supabase, take the **Transaction pooler**
string from Project Settings → Database — port `6543`, not the direct `5432` connection. A
serverless deploy opens and drops connections constantly and will exhaust a direct pool.

**2. Populate it once** from your machine:

```bash
DATABASE_URL='postgresql://…@…pooler.supabase.com:6543/postgres' npm run setup
```

**3. Set the environment variables** in Netlify → Site configuration → Environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the pooled connection string from step 1 |
| `WORKER_TOKEN` | any long random string — **required**, or the worker refuses to run |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | change these from the defaults |
| `NEXT_PUBLIC_SITE_URL` | optional; detected from Netlify's `$URL` if unset |

**4. Deploy.** `netlify.toml` and `@netlify/plugin-nextjs` handle the rest. The scheduled
function in `netlify/functions/worker-tick.mts` starts discovering sites on its own within
five minutes.

Nothing else is required — no Docker, no separate worker dyno, no object storage account.

> The Supabase project and its database role are still named `portico`, from before
> the rename. They are infrastructure identifiers that appear only in `DATABASE_URL`,
> so they were left alone rather than risk a live connection string for cosmetics.

### Keeping it awake

Free-tier Supabase projects **pause themselves when idle**, and a paused database takes the
whole site down with a confusing "tenant/user not found" from the pooler. The scheduled worker
hits the database every five minutes, which is enough to keep a deployed site active — but a
project you only touch during local development will pause overnight. Resume it from the
Supabase dashboard, or upgrade the plan if the site needs to be reliably up.

web-amble detects this case and says so plainly rather than surfacing the driver's error.

### Before you deploy

```bash
npm test          # 80 unit tests over the pure logic
npm run typecheck
npm run build     # succeeds even with no DATABASE_URL set
npm run smoke     # every route type against a running server, read to the last byte
npm run audit     # accessibility and markup over the rendered HTML of every page
```

Then check, in order:

- [ ] `DATABASE_URL` points at a **pooled** connection (port 6543 on Supabase), not the direct one.
- [ ] `WORKER_TOKEN` is set. Without it the scheduled function refuses to run and the catalogue silently stops updating.
- [ ] `ADMIN_PASSWORD` is not the default.
- [ ] `npm run setup` has been run **against the production database**, not just locally.
- [ ] The database is not paused (see below).
- [ ] After the first deploy, `npm run smoke -- https://your-site` and `npm run audit -- https://your-site` both pass.

### Verifying a deploy

```bash
curl -X POST "https://your-site.netlify.app/api/worker?max=3" -H "x-worker-token: $WORKER_TOKEN"
```

It returns what it scheduled, promoted and ran. `/admin/jobs` shows the same queue in the UI.

### Deploying somewhere else

Any Node host works. On a VPS or Fly machine, point `DATABASE_URL` at a Postgres on the same host and run `npm run worker` as a second process. That is the simpler setup and the faster one, since the database round trip stays local.

---

## Layout

```
src/
  app/                 routes — public pages, /admin console, /api endpoints
  components/          UI: cards, shelves, command palette, filters, cover art
  lib/
    db.ts schema.ts    Postgres connection + idempotent DDL
    storage.ts         cover art: local disk or Netlify Blobs
    ingest.ts          the pipeline
    classify.ts        category + tag + quality scoring
    metadata.ts        HTML parsing
    fetcher.ts         polite fetching, robots.txt, concurrency pool
    thumbs.ts          cover art + favicon caching (sharp)
    jobs.ts handlers.ts  job queue and its handlers
    sources/           discovery adapters
    queries/           all SQL
    seed/              the 240-site founding catalogue
workers/worker.ts      the background loop (local / VPS)
netlify/functions/     scheduled worker tick (serverless)
scripts/               migrate · seed · reset · repair · dedupe · ingest · discover · inspect
data/                  generated cover art in development (gitignored)
```

Stack: Next.js 16 (App Router, React 19, server actions), TypeScript, Tailwind, Postgres with
full-text search, `sharp` for images. No API keys, no analytics, no telemetry.

---

## When something looks broken

`docs/debugging.md` collects the symptoms that were expensive to diagnose the
first time — hanging pages, a paused database, a dev server wedged by a
cancelled stream, stranded Suspense fallbacks, hydration failures, and the SQL
that SQLite accepted but Postgres does not. Start there.

`docs/launch.md` has the launch copy: what to post where, and the two rules for
writing about this project — never quote a catalogue number you have not just
checked, and never call the classifier AI, because it is a weighted lexicon.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server. Runs through `scripts/dev.mjs`, which gives Next a 6 GB heap — see the note in that file for why |
| `npm run build` / `npm start` | Production build and serve |
| `npm run worker` | Background worker — discovery, ingest, cover art, maintenance |
| `npm run setup` | `db:migrate` + `db:seed` |
| `npm run db:reset` | Drop every table and clear generated cover art |
| `npm run db:repair` | Housekeeping: restore curated copy, tidy crawled titles, rebuild the index (`-- --prune` also retires ineligible entries) |
| `npm run db:dedupe` | Collapse organisations listed more than once (`-- --dry` to preview) |
| `npm run reclassify` | Re-file crawled sites against the current lexicon |
| `npm run ingest -- <url> [--approve]` | Catalogue specific URLs from the CLI |
| `npm run discover -- --jobs 40` | Run every source once and process the queue |
| `npm run rescore` | Queue a re-crawl of anything without an evidence-based quality score (`-- --all` for everything) |
| `npm run score -- <url>` | Fetch a page and print what the ingester would make of it — score, category and every contributing term |
| `npm run audit` | Accessibility and markup audit of every route type: alt text, link and control names, heading order, duplicate ids |
| `npm run triage -- <file>` | Work the review queue from a file of `id verdict reason` decisions (`-- --dry` to preview). See `docs/triage-2026-08-29.txt` for a worked example |
| `npm run inspect` | Health readout: counts, cover art coverage, category spread, current top of the catalogue |
| `npm run typecheck` | `tsc --noEmit` |

## Configuration

Everything in `.env.local`, all with working defaults — see `.env.example`. The ones worth knowing:

- `AUTO_APPROVE_QUALITY` — quality threshold for auto-listing discovered sites (`0` to review everything)
- `WORKER_BATCH` — jobs the worker takes per tick. The throttle that keeps background work from
  starving page renders; on a small shared database, six is enough to make pages time out
- `CRAWLER_HOST_DELAY_MS`, `CRAWLER_CONCURRENCY`, `CRAWLER_RESPECT_ROBOTS` — crawler politeness
- `SCREENSHOTS_ENABLED=1` — real screenshots, after `npm i -D playwright && npx playwright install chromium`

## Public endpoints

- `/api/sites` — read-only JSON API with the same filters as `/browse`
- `/api/search?q=` — the same search the command palette uses
- `/feed.xml` — RSS of newest listings
- `/category/<slug>/feed.xml`, `/tag/<slug>/feed.xml`, `/collections/<slug>/feed.xml` — RSS for one
  shelf, so you can follow the corner of the catalogue you care about rather than all of it. Each
  page advertises its own through `<link rel="alternate">`.
- `/sitemap.xml`, `/robots.txt`

## Accounts, and the one thing they cannot do

An account is optional — browsing, searching and shuffling all work signed out.
With one you can upvote, save sites and build collections, and `/settings` lets
you change your display name, bio and password, or delete the account outright.

There is **no password reset**, because there is no email. Adding one would mean
an SMTP provider, an API key and a deliverability problem, none of which this
project has or wants. The consequence is real and the site says so on the sign-in
page: somebody locked out needs an editor to issue them a new password from
`/admin/people`. That is the trade — one fewer moving part in exchange for a
manual step that happens rarely.

## Being a good citizen

The crawler identifies as `AmbleBot`, requests one page per site, obeys `robots.txt` including
wildcards, never logs in and never submits forms. To opt out entirely:

```
User-agent: AmbleBot
Disallow: /
```

There is no analytics script, no third-party embed and no tracking cookie — the only cookie is the
session. Outbound clicks pass through `/go/[slug]`, which increments a counter and strips the referrer.

### Share cards

Every listing, collection and the home page generate their own Open Graph image
at `/…/opengraph-image` — a 1200×630 PNG with the site name, category, tagline
and a colour wash derived from the same hue as its in-app cover art.

They are generated rather than reusing the listed site's own `og:image`, which
is often a webp social platforms refuse to render, is missing entirely for a
large share of sites, and carries none of the context that makes a shared link
legible. No external fonts are fetched, so a card renders offline.
