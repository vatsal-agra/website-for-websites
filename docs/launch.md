# Launch material

Copy for announcing web-amble. Everything here is written to be true on the day
you publish it — check the numbers against `npm run inspect` first and change
them if they have moved.

Two rules for all of it:

- **Never claim a number you have not checked.** The catalogue counts, the
  "added this week" figure and the vote totals are all real and all visible on
  the site. If a post says 400 sites and the footer says 260, that is the first
  thing a reader will notice.
- **Do not describe the crawler as AI.** It is a weighted keyword classifier and
  a quality heuristic. Saying otherwise invites a category of scrutiny the
  product does not need and cannot survive.

---

## The one-liner

> A storefront for the whole web.

Longer, when you have a sentence:

> App stores gave software a place to be browsed. Websites never got one.
> web-amble is a directory you can wander through — by category, by collection,
> or by pressing shuffle.

---

## Show HN

Hacker News rewards specificity about how a thing works and honesty about what
it does not do yet. Lead with the mechanism, not the mission.

**Title**

```
Show HN: web-amble – a browsable storefront for websites, not a search engine
```

**Body**

```
Search engines are great when you know what you want and useless when you
don't. App stores solved browsing for software; nothing does it for websites.
So I built a directory you can amble through.

Every entry has a cover, a one-line description, a category and a quality
score. You can browse 16 shelves, follow curated collections, filter by things
like "no signup" or "ad-free", or press shuffle and land somewhere at random.

How entries get in:

- Discovery: a worker polls Hacker News, Lobsters and a handful of link blogs,
  then follows outbound links from sites already catalogued. Good sites link to
  good sites, and that turns out to be most of the signal you need.
- Every candidate is fetched once, politely — robots.txt respected, one request
  per host at a time, byte-capped.
- A weighted keyword classifier files it into one of 16 categories and up to
  six tags from a fixed vocabulary. The fixed vocabulary is the important part;
  it's what stops the tag list turning into meta-keyword soup.
- A quality score comes from evidence on the page: is there anything here to
  read or use, does it link out to the rest of the web, is it drowning in ad
  networks, is it a parked domain — and does it read like a sales funnel, which
  counts against it. Polished social metadata counts for almost nothing, on
  purpose: a company with a marketing team has perfect metadata and that tells
  you nothing about whether the site is worth your time. Above a threshold a
  discovered site goes live automatically; everything else, and every human
  submission, waits for review.

Ranking is public and boring on purpose:

  trending = (votes·5 + clicks·1.5 + views·0.2 + quality·3) / (days + 3)^0.3

No paid placement, no sponsored slots. Every number on the site is real —
counters start at zero and only move when somebody does something.

Stack: Next.js, Postgres, sharp. No API keys, no analytics, no tracking
cookies. Outbound links pass through a counter that strips the referrer.

Every category, tag and collection publishes its own RSS feed, so you can
follow one corner of it rather than all of it.

What it isn't yet: the catalogue is small, and the classifier misfiles things —
there's a report button on every entry, and the score genuinely cannot tell an
excellent company website from an excellent independent one, which is what the
review queue is for. Happy to hear what would make it more useful.
```

**Answering the obvious comments**

- *"This is just DMOZ / a webring / Delicious."* — Agree, and say so. The
  interesting question is why they stopped and what's different now: discovery
  is automated, so the catalogue doesn't depend on volunteer editors keeping up.
- *"How do you stop it filling with SEO spam?"* — Point at the quality score and
  the auto-approve threshold, and be honest that it's a heuristic that will need
  tightening as the corpus grows.
- *"How is this ranked? Who paid?"* — The formula is in the README and on
  `/about`. Nobody paid; there is no mechanism to pay.

---

## Post for a personal feed

```
Search is for when you know what you want.

I wanted the other thing — the app-store feeling of scrolling until something
catches your eye. So I built it for websites.

web-amble: 16 shelves, curated collections, and a shuffle button that will
drop you somewhere you'd never have searched for.
```

Follow-ups, if you're threading:

```
It finds sites on its own. A worker reads link blogs and follows outbound links
from sites already in the catalogue — good sites link to good sites — then
scores each candidate on evidence from the page before anything goes live.
```

```
Ranking is one public formula and there's no way to pay for placement. Every
counter starts at zero. A new install honestly looks new, which is the point.
```

```
Favourite thing in it so far: a website powered by a solar panel that goes
offline when the weather is bad. I would never have searched for that.
```

```
Every shelf has its own RSS feed. Follow "maps" or "archives" or one curated
collection and get told when something new lands there, instead of following
the whole thing.
```

---

## Reddit

Works in r/InternetIsBeautiful, r/webdev, r/SideProject. Each has a different
centre of gravity — lead with the artefact, not the announcement, and follow
each subreddit's self-promotion rules.

- **r/InternetIsBeautiful** — lead with a single remarkable listing and link the
  category it lives in, not the home page. This audience wants the thing, not
  the meta-thing.
- **r/webdev** — lead with the engineering: streaming shelves, the generated
  cover art, running a crawler and a web app off one Postgres.
- **r/SideProject** — lead with the problem and what you'd do differently.

---

## Directory submissions

web-amble is a directory, so getting listed in other directories is both
on-brand and the cheapest distribution there is:

- There's RSS at `/feed.xml` for the whole catalogue, and at
  `/category/<slug>/feed.xml`, `/tag/<slug>/feed.xml` and
  `/collections/<slug>/feed.xml` for one shelf — worth mentioning to anyone who
  syndicates links, since a narrow feed is far more usable than a firehose.
- Submit to the small-web indexes: Marginalia, indieweb aggregators, and the
  link blogs already used as discovery sources — several accept submissions.
- Every listed site is a potential referrer. "You're listed in web-amble" is a
  reasonable thing to tell a site owner, and the site page is worth linking to.

---

## Screenshots worth taking

1. **Home, top of page.** The hero plus the site of the day. Shows the tone.
2. **A category page** — Web Curios or Design & Type — showing the grid of
   covers. Shows breadth.
3. **The shuffle page.** One big card, keyboard hints visible. Shows the idea.
4. **A collection.** "The web at its weirdest" reads best.
5. **Admin queue**, if the audience is technical. Shows it's a real system.

Take them in dark mode at 1440px. The generated cover art photographs better
than the og:image ones because the palette stays coherent.

---

## What not to say

- Don't call it "curated by AI" or imply a model is involved. It isn't.
- Don't promise a mobile app, an API or an email digest that doesn't exist.
- Don't quote a catalogue size that isn't currently true.
- Don't claim the classifier is accurate. It's a heuristic with a report button.
- Don't claim the quality score identifies good websites. It filters out parked
  domains, ad farms and sales funnels, and it is deliberately conservative about
  what it lets through unreviewed. That is a smaller and more defensible claim.
