# Handoff — start here

This is the entry point for **any developer or AI assistant** who picks up Meshki Media
(مشکی مدیا). Read this page first, then follow the links. It is written so that someone with
no memory of earlier work can continue safely. Last full review: **2026-09-30**.

## 1. What this is, in five lines

- A **Persian-first (RTL) reference for Turkish TV series**: daily TİAK ratings, series / episode /
  actor / character / network pages, a broadcast calendar, recaps, and (since 2026-09-29) a **news
  section** with Persian AI-written stories merged from several Turkish outlets.
- **Live site:** https://nimania.github.io/meshkimedia/ · **Repo:** https://github.com/nimania/meshkimedia
- **Owner:** Nima (nimania@gmail.com). Persian speaker, **not a programmer**; a food-industry professional
  who runs this and other personal web projects (e.g. Jan-Kalam, whose Gemini approach this project mirrors).
  Explain things in Persian, step by step, and never assume he can run a terminal.
- **Stack:** a static site on GitHub Pages. Data are JSON files; Node 22 scripts (zero npm dependencies)
  generate every HTML page; GitHub Actions run the collectors and deploy. There is **no server and no database**
  in production (the `app/`, `db/`, `drizzle/` folders are an unused Cloudflare scaffold, see §7).
- **Language of the UI:** Persian. Code, commits and these docs: English (the owner's chat: Persian).

## 2. The mental model (memorise this)

```
 sources (TİAK, Dizilah, broadcaster sites, RSS feeds, Wikipedia)
        │  collectors: automation/*.mjs  (run inside GitHub Actions, every build)
        ▼
 github-pages/data/*.json   ← the single source of truth (committed to main)
        │  automation/build-site.mjs   (JSON → all HTML, sitemap, search index, feeds)
        ▼
 github-pages/**  → uploaded as the Pages artifact → https://nimania.github.io/meshkimedia/
        │
        └─ browser JS (github-pages/*.js) reads the JSON again for interactive parts
```

Golden rules:

1. **Edit data, page scripts or the generator — never generated HTML.** Files such as `github-pages/dizi/**`, `oyuncu/**`,
   `karakter/**`, `kanal/**`, `asar/**`, `haber/**`, the list pages (`diziler/`, `oyuncular/`, `takvim/`, `reyting/` …),
   `sitemap.xml`, `robots.txt`, `data/search-index.json`, `data/news-feed.json` and `images/networks/*.svg` are **written by
   `automation/build-site.mjs` on every deploy** (many are also committed, so they can look stale between builds — ignore them).
   The hand-written files in `github-pages/` are `index.html` (home), `styles.css`, the page scripts `*.js`, the fonts,
   `google….html` (Search Console proof), and `images/meshki-media-logo.png` / `favicon-64.png`.
2. **Never invent data.** Missing ratings stay `null` (the UI shows a rank); missing casts stay "pending".
   See [DECISIONS.md](./DECISIONS.md).
3. **Never store or show full third-party article text.** News shows titles, short own-words Persian
   explainers written by the model, a hotlinked thumbnail and links to the sources.
4. **Secrets never go in files, chat or logs.** Only the owner can add repository secrets (§5 of OPERATIONS).
5. **Bump the `?v=` cache-buster** when you change a shared JS/CSS file (see ARCHITECTURE → Cache busting).

## 3. Repository map (what matters)

| Path | What it is |
| --- | --- |
| `github-pages/` | Everything deployed. `data/` = JSON truth; `*.js` = page scripts; `styles.css` = the only stylesheet |
| `github-pages/data/series.json` | Series, cast, seasons, episodes (editorial, hand-curated + calendar sync) |
| `github-pages/data/people.json`, `works.json` | Actors (with `socials`, `bio`) and films/series outside the catalogue |
| `github-pages/data/networks.json` | Channels, brand colors, TİAK keys |
| `github-pages/data/ratings.json` | Rolling window (≤120 days) of TİAK Top 10 in Total/AB/ABC1 — written by the collector |
| `github-pages/data/calendar.json` | Dizilah broadcast calendar (≈2 weeks), refreshed by PRs titled "data: sync Dizilah calendar…" |
| `github-pages/data/news.json`, `bios.json` | News stories and Wikipedia bios — written by Actions, **do not hand-edit** unless fixing |
| `github-pages/data/social-ratings.json` | Reviewed Instagram supplement (built from `automation/reviewed-social-ratings.json`) |
| `automation/` | All Node/Python scripts (see §4) |
| `.github/workflows/` | `pages.yml` (the important one), `editorial-queue.yml`, `instagram-ratings.yml`, `collector.yml` (gated off) |
| `docs/` | These documents |
| `app/ db/ drizzle/ components/ lib/ hooks/ vendor/ next.config.ts vite.config.ts wrangler…` | Unused Next/Cloudflare scaffold from the first day (§7) |

## 4. The scripts in `automation/`

| Script | Role | Runs in |
| --- | --- | --- |
| `build-pages-data.mjs` + `tiak-daily.mjs` | Fetch TİAK public Top 10 (Total/AB/ABC1), append to `ratings.json` | pages.yml |
| `sync-episodes.mjs` | Turn calendar entries into episodes in `series.json` (continuous episode numbers via `season.firstEpisode`) | pages.yml |
| `news-collect.mjs` | RSS → entity linking → filters → clustering → Gemini Persian stories → `news.json` | pages.yml |
| `news-bios.mjs` | Wikipedia summaries per actor → `bios.json` | pages.yml |
| `build-site.mjs` | **The generator**: every page, sitemap, search index, `news-feed.json`, network marks | pages.yml |
| `build-social-ratings.mjs` | Validate + publish reviewed Instagram numbers | pages.yml |
| `social-rating-cards.py`, `social-episode-galleries.py`, `social-content.py` (+ `solar_date.py`) | Daily social cards, carousels, "publication room" at `/social/` (never auto-posted) | pages.yml |
| `audit-content.mjs`, `audit-cast.mjs` | Quality gates: they **fail the build** on malformed editorial/cast data | pages.yml, `npm run content:check` / `cast:check` |
| `untracked-ratings.mjs` | Report Top 10 programs no series claims (report only) | pages.yml |
| `editorial-queue.mjs`, `discover-episodes.mjs` | Daily checklist and candidate episode links (evidence for a human editor) | editorial-queue.yml |
| `dizilah-instagram.mjs` | Fetch @dizilah rating posts via Meta Business Discovery (needs Meta secrets) | instagram-ratings.yml |
| `collector.mjs`, `sources.json` | Original snapshot collector for the unused D1/R2 backend | collector.yml (disabled) |

## 5. How work gets published (important for the owner's setup)

The owner does **not** use a terminal or git. Changes reach the repo in one of these ways:

1. **An AI assistant with a browser** uploads files through the GitHub web UI
   (`https://github.com/nimania/meshkimedia/upload/main/<dir>` → choose files → commit message → *Commit changes*).
   This is how nearly all recent commits were made. Details and gotchas: [OPERATIONS.md](./OPERATIONS.md) §3.
2. **A developer with git**: normal commits/PRs to `main`. Any push touching `github-pages/**` or listed
   `automation/**` files triggers a build (see `paths:` in `pages.yml`).
3. **GitHub Actions itself** commits data back to `main` with `[skip ci]` (ratings, episodes, news, bios).
   Always `git fetch && git reset --hard origin/main` (or pull --rebase) before working: the bot commits several
   times a day.

A build takes 1.5–3 minutes (sometimes >10 when Gemini is slow). Deploy = `pages.yml`; there is no other host.

## 6. Current status (2026-09-30)

Working and live:

- Ratings (Total/AB/ABC1), series/episode/actor/character/network pages, calendar (TR/IR/US-PT), search,
  recap and fragman archives, rating trend charts, social publication room, SEO (sitemap, JSON-LD, Search Console).
- Casts for the 26 catalogue series (mostly from official broadcaster pages; Star TV publishes none, so those use Dizilah and a few
  casts are still missing — run `npm run cast:check` for coverage), ≈252 actors, ≈257 characters.
- **News:** 8 RSS feeds, entity linking, sensitive-topic filter, **story clustering across outlets**, Persian titles /
  summaries / explainers / cross-source comparison via Gemini, one page per story at `/haber/<id>/`, outlet badges
  (logos), news tabs on series/actor/network pages, home "latest news" strip, trending chips, share buttons.
- Actor bios from Wikipedia (fa when a Persian article exists; otherwise machine translation flagged as such).

Secrets configured by the owner: `AI_API_KEY` (Gemini). Not configured: Meta/Instagram secrets, Telegram.

## 7. Known quirks and traps

- **`window.DiziMeter`, `dizimeter.js`, secret names `DIZIMETER_*`** keep the old project name on purpose.
- **Gemini model names rot.** `gemini-2.5-flash` was retired in Sept 2026. The collector now lists usable models at
  run time and falls back; see [NEWS.md](./NEWS.md) §6 and [OPERATIONS.md](./OPERATIONS.md) §6.
- **A sandbox/agent environment often cannot reach news sites, Wikipedia or Google APIs** (403 "host not in allowlist").
  Do not work around it; test with fixtures (`--fixture=…`) and let GitHub Actions do the live run.
- **Pre-existing JS error** on actor/character pages: `Cannot read properties of null (reading 'classList')` — content
  still renders; not yet investigated.
- **Two concurrent runs are queued, never cancelled** (`concurrency: github-pages`). A stuck "Deploying to github-pages"
  can hold the queue for ~10 min; cancel it in the Actions UI and re-run.
- **`[skip ci]` commits do not trigger builds.** Data committed by the bot is deployed by the same run that produced it.
- The UI text says "۱۰ روز اخیر" for the ratings window but `ratings.json` keeps up to 120 days (trends use all of it).
- Persian digits and Jalali dates: use `Intl` with `fa-IR-u-ca-persian`, `timeZone: "Asia/Tehran"`.

## 8. Where to go next

- What to do when something breaks → [OPERATIONS.md](./OPERATIONS.md)
- How every page/URL/file is produced → [ARCHITECTURE.md](./ARCHITECTURE.md)
- JSON schemas → [DATA-MODEL.md](./DATA-MODEL.md)
- News pipeline in depth → [NEWS.md](./NEWS.md)
- Why things are the way they are → [DECISIONS.md](./DECISIONS.md)
- What is planned / open → [ROADMAP.md](./ROADMAP.md)
- Persian summary for the owner → [راهنما-fa.md](./راهنما-fa.md)
