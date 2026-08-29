# Things that will confuse you

Symptoms that took a long time to diagnose once, written down so they take
minutes the next time.

---

## A page hangs forever with no error

**First move: `DB_TRACE=1` in `.env.local`, restart, load the page once.**

Every statement is logged with its duration and the queue depth:

```
[db 12] -> (5 active, 3 queued) SELECT s.* FROM sites s WHERE s.status = 'appro
[db 12] <- 241ms 12 rows
```

Then compare the counts:

```bash
grep -c '^\[db .*->' dev.log   # started
grep -c '^\[db .*<-' dev.log   # finished
```

If fewer finished than started, list the ones that never came back:

```bash
comm -23 <(grep -oE '^\[db [0-9]+\] ->' dev.log | grep -oE '[0-9]+' | sort -n) \
         <(grep -oE '^\[db [0-9]+\] <-' dev.log | grep -oE '[0-9]+' | sort -n)
```

This is how the original hang was found: the home page fanned out ~20 queries at
once, the driver silently failed to dispatch four of them, and the request waited
forever on promises that would never settle. Hence the concurrency gate in
`src/lib/db.ts`, which caps in-flight statements at the pool size and queues the
rest in process where the behaviour is predictable.

**Do not diagnose this by hammering the server.** A page that takes 5s and a
retry loop with a 5s timeout produces a queue hundreds deep, and then *every*
route looks broken. Several hours went into chasing timings that were entirely
self-inflicted. Restart the server before trusting any measurement.

---

## "tenant or user not found", or everything times out at once

The Supabase project has **auto-paused**. Free-tier projects pause when idle,
and the pooler then reports what looks like a credentials failure. Resume it
from the dashboard. `explain()` in `src/lib/db.ts` detects this and says so in
plain language rather than passing the driver's error through.

A deployed site will not hit this — the scheduled worker touches the database
every five minutes — but a project you only use for local development will pause
overnight.

---

## Every page takes a minute, and the log says "statement timeout"

```
Error [PostgresError]: canceling statement due to statement timeout
 GET /browse 200 in 90s (next.js: 204ms, application-code: 90s)
```

`next.js: 204ms` against `application-code: 90s` is the tell: the framework is
fine, the database is not. Something else is using it. Nine times out of ten
that something is the worker — `npm run worker` takes a batch of jobs every few
seconds, each job is several statements, and a free-tier database has about one
core to share between that and the page you are loading.

Stop the worker and load the page again. If it comes back, that was it — lower
`WORKER_BATCH` (2 is comfortable locally) or leave the worker off while you
work on pages. On Netlify this is far gentler: the scheduled function ticks
every five minutes rather than continuously.

`application_name` will not help you here. Through Supabase's transaction
pooler every connection reports as `Supavisor`, so `pg_stat_activity` cannot
tell a page render apart from a job. Stopping one side and re-measuring can.

Then **restart the dev server** before believing any number. A server that has
absorbed a few timed-out requests keeps rendering them: it sits at two or three
gigabytes, answers `/robots.txt` instantly and every database-backed page not at
all, which looks exactly like a database outage and is not one.

---

## Suspense fallbacks never disappear

Skeletons stay on screen next to the real content, and headings appear twice.

Check whether the document is hidden:

```js
document.visibilityState        // 'hidden' in a headless or background pane
window.$RB.length               // > 0 means reveals are queued and unflushed
window.$RV(window.$RB)          // flushes them by hand
```

React buffers Suspense reveals in `$RB` and flushes them through `$RV` when the
document becomes visible — there is no point animating a reveal nobody can see.
In a permanently hidden pane that moment never arrives. **The served HTML is
complete and correct** (`curl` it and count `$RC(` calls against `aria-busy`
fallbacks); a visible browser tab reveals normally.

Verify against the HTML before concluding the app is broken:

```bash
curl -s localhost:3000/site/some-slug > page.html
grep -c 'aria-busy="true"' page.html   # fallbacks emitted
grep -c '\$RC(' page.html              # boundaries resolved — should be >= fallbacks
```

---

## Hydration failed (React #418)

Almost always something computed from the clock or the locale.

Two were found here and both are fixed, but the pattern recurs:

- **Relative times.** "4 minutes ago" on the server, "5 minutes ago" when the
  browser hydrates a second later. Render them through `<RelativeTime>`, which
  sets `suppressHydrationWarning`.
- **Locale and time zone.** `toLocaleDateString()` without an explicit
  `timeZone` renders in the server's zone and then the reader's. This only
  breaks in production, where those differ.

A hydration failure is not cosmetic on a streaming page: React stops managing
the tree, and any pending Suspense boundary is stranded.

---

## Postgres accepts SQL that SQLite rejected, and vice versa

The catalogue moved from SQLite to Postgres. These all failed silently or at
runtime rather than at build time:

| SQLite allowed | Postgres needs |
| --- | --- |
| `ORDER BY alias * 2` | the expression repeated, or a derived table |
| `SELECT t.*, (…) AS uses … ORDER BY uses` | explicit columns — `t.*` already had `uses`, so the name is ambiguous |
| unqualified `votes` in `UPDATE sites` | `sites.votes` — a `votes` **table** also exists |
| `COUNT(*)` read as a number | `COUNT(*)::int` — otherwise a bigint reaches React, which retries the render in a loop |
| `INSERT OR IGNORE` | `ON CONFLICT … DO NOTHING` |
| `datetime('now','-7 days')` | a parameter from `isoOffset()` |

`npm run smoke` exercises every route type against real records and would have
caught most of these. Run it after any query change.
