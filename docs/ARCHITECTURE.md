# Architecture — the static site

The public site is a **data-driven static build**. Content lives in JSON; one Node script turns the JSON into plain HTML
pages; GitHub Pages serves them; small browser scripts fill in the interactive parts by re-reading the JSON. There is no
framework, no bundler and no server. (The Next.js/Cloudflare/D1 code in the repository root is an **unused scaffold**, see the end.)

## 1. End-to-end flow

```
TİAK · Dizilah · broadcaster pages · RSS feeds · Wikipedia · Gemini
        │            (GitHub Actions: .github/workflows/pages.yml)
        ▼
collectors  automation/build-pages-data.mjs   → data/ratings.json      (≤120 days of Top 10, 3 categories)
            automation/sync-episodes.mjs      → data/series.json       (calendar episodes, continuous numbers)
            automation/news-collect.mjs       → data/news.json         (stories, Persian text via Gemini)
            automation/news-bios.mjs          → data/bios.json         (Wikipedia bios)
        ▼
generator   automation/build-site.mjs  reads data/*.json  → writes all HTML + sitemap + robots + search index + news feed + network marks
            automation/social-*.py, build-social-ratings.mjs → /social/ publication room (cards/carousels, never auto-posted)
        ▼
quality gates  audit-content.mjs, audit-cast.mjs  (build fails on malformed editorial/cast data)
        ▼
deploy   upload-pages-artifact(github-pages/) → deploy-pages → https://nimania.github.io/meshkimedia/
        ▼
persist  bot commits ratings.json, series.json, news.json, bios.json back to main ([skip ci])
```

## 2. File map of `github-pages/`

Hand-written (edit these): `index.html` (home; sections `#spotlight`, `#tonight`, `#top`, `#fresh`, `#home-trends`, `#latest-news`, `#series`,
`#networks`), `styles.css` (the only stylesheet; design tokens in `:root`, dark theme via `[data-theme="dark"]`), fonts (`vazirmatn.woff2`),
`google9d2ba0fa47b54265.html`, `images/meshki-media-logo.png`, `images/favicon-64.png`, and the page scripts:

| Script | Used by | Job |
| --- | --- | --- |
| `dizimeter.js` | every page | `window.DiziMeter`: data loading, Persian digits/dates, rating joins, `esc`, badges, `isoToFa`, slugify |
| `home.js`, `rating-trends.js` | `/` | spotlight, tonight, top list, fresh episodes, rating insights |
| `series-page.js`, `episode-page.js`, `gallery.js` | series/episode pages | profiles, casts, trends, photo galleries |
| `actor-page.js`, `character-page.js` | `/oyuncu/`, `/karakter/` | filmography, bio (from `bios.json`), roles |
| `network-page.js`, `networks-index.js` | `/kanal/` | network pages |
| `list-series.js`, `list-actors.js`, `list-characters.js`, `recaps.js`, `fragmans.js`, `calendar.js`, `ratings.js`, `search.js` | list pages | filterable lists, calendar (TR/IR/US-PT), ratings page, search |
| `news.js` | `/haber/`, home, series/actor/network pages, story pages | news cards, filters, trending, home strip, video/copy handlers |

Generated (never edit): `dizi/<slug>/index.html` and `dizi/<slug>/bolum-<n>/index.html`, `oyuncu/<slug>/`, `karakter/<slug>/`, `asar/<slug>/`
(films/works), `kanal/` + `kanal/<slug>/`, `haber/` + `haber/<id>/`, `diziler/ oyuncular/ karakterler/ ozetler/ fragmanlar/ takvim/ ara/ reyting/`,
`sitemap.xml`, `robots.txt`, `data/search-index.json`, `data/news-feed.json`, `images/networks/*.svg`, `social/**`.

Data (`data/`): `series.json`, `people.json`, `works.json`, `networks.json` (editorial), `ratings.json`, `calendar.json`, `news.json`, `bios.json`,
`social-ratings.json` (collected/derived), plus generated `search-index.json`, `news-feed.json`. Schemas: [DATA-MODEL.md](./DATA-MODEL.md).

## 3. How a page is rendered

Generated HTML is a **thin shell** with full static SEO (title, description, canonical, Open Graph, Twitter card, JSON-LD) and a bootstrap:

```html
<script>window.DM = { root: "../../", slug: "sevdan-bir-ates" };</script>
<script src="../../dizimeter.js?v=…" defer></script>
<script src="../../series-page.js?v=…" defer></script>
```

`window.DM.root` is the relative path back to the site root; `slug` / `epNumber` identify the entity. The script `fetch`es JSON (once,
cached) and fills the shell. The main exception rendered **fully at build time** is the news story page `/haber/<id>/`. So: to change content edit JSON; to change layout edit the template functions in `build-site.mjs`
(`seriesPage`, `episodePage`, `networkPage`, `actorPage`, `characterPage`, `workPage`, `listPage`, `ratingsPage`, `newsItemPage`, `newsPage`,
`head()`, `boot()`, `SITE_NAV`, `BOTTOM`) or the page script.

### Cache busting

`head()` links `styles.css?v=<version>` and `boot()` links every script with `?v=<version>`. **GitHub Pages caches aggressively**, so when you change
`styles.css`, `dizimeter.js` or any page script, bump the version string (currently `20260930news3` for news-related pages, older strings elsewhere;
`index.html` carries its own hand-written `?v=` values). Data JSON is fetched with `cache: "no-store"` or a timestamp query where freshness matters.

## 4. URL scheme

| Path | Page |
| --- | --- |
| `/` | Home: spotlight, tonight, top ratings, fresh episodes, trends, latest news, series grid, networks |
| `/diziler/` `/oyuncular/` `/karakterler/` | Searchable lists |
| `/dizi/<slug>/` | Series (tabs/sections: about, cast, news, trend, episodes) |
| `/dizi/<slug>/bolum-<n>/` | Episode (continuous number, ratings in Total/AB/ABC1, gallery, fragman) |
| `/oyuncu/<slug>/` `/karakter/<slug>/` | Actor (filmography, bio, news) / character |
| `/asar/<slug>/` | Film or series outside the catalogue (`works.json`) |
| `/kanal/`, `/kanal/<slug>/` | Networks index / one network (series, placements, news) |
| `/haber/`, `/haber/<id>/` | News page / one Persian story |
| `/ozetler/` `/fragmanlar/` | Recap archive / trailer archive |
| `/takvim/` | Calendar with Turkey, Iran, US Pacific times (correct DST) |
| `/reyting/` | Ratings, weekly ranking, untracked-program labels (OZET/TKR/T.S rows link to their series) |
| `/ara/` | Search (`data/search-index.json`) |
| `/social/` | Internal publication room: downloadable social cards and captions (not in the main nav) |

Slugs are ASCII and stable (`slugify()` in both `build-site.mjs` and `dizimeter.js`: Turkish letters folded). Actor and character slugs derive from
`people.json` keys and `<series-slug>-<role>`.

## 5. Ratings join

Ratings are stored once, in `ratings.json` (per day, per category: `rank`, `program`, `network`, `rating|null`). An episode does not copy its
rating; the client joins `(series.ratingKey, episode.date)` against the day's tables. `ratingKey` is the ASCII-uppercase form of the TİAK program
name (`foldUpper`). `build-pages-data.mjs` fetches the three public Top 10 tables (Total = exact `Rating %`, AB and ABC1 = as TİAK publishes),
validates them with `tiak-daily.mjs` (rejects incomplete/changed markup), and keeps up to 120 days. The public site never invents a number; a
missing one shows the rank. Reviewed Instagram numbers (`social-ratings.json`) are a labelled *supplement* that never overrides TİAK.

## 6. Calendar and episode numbers

`calendar.json` (Dizilah, ≈2 weeks, updated via PRs "data: sync Dizilah calendar …") lists broadcasts with season/episode inside the season. `sync-episodes.mjs`
converts to the network's **continuous number** `season.firstEpisode + episode − 1` and adds it to `series.json` (`"calendar": true`, `"scheduled": true`
until the day after airing) so the episode outlives the calendar window. It never renumbers or re-dates an existing episode; a season without
`firstEpisode` is skipped and reported.

## 7. Network marks

`build-site.mjs` writes `images/networks/<slug>.svg`: if `automation/network-logos/<slug>.svg` exists (Wikimedia Commons assets — licences listed
in that folder's README) it is copied; otherwise a generated typographic badge in the brand colour is used (e.g. Kanal D). News outlet badges are
separate (`news-sources.json` colours; optional `images/outlets/<feed id>.png`).

## 8. Search, sitemap, SEO

`build-site.mjs` emits `data/search-index.json` (series, episodes, actors, characters, works, networks), `sitemap.xml` (priorities: series 0.8, episodes 0.6,
actors 0.5, characters/works 0.4, news pages 0.5, `/haber/` and `/reyting/` 0.8) and `robots.txt`. Google Search Console is verified by
`google9d2ba0fa47b54265.html`. Every page has canonical + JSON-LD (`TVSeries`, `TVEpisode`, `Person`, `Organization`, `NewsArticle`, `CollectionPage`).

## 9. Social publication room

`social-rating-cards.py`, `social-episode-galleries.py`, `social-content.py` (Pillow + CairoSVG installed in the workflow; Jalali dates via `solar_date.py`)
create PNG cards, gallery carousels and caption files from published data under `github-pages/social/` and an internal index page. **Nothing is posted
automatically**; a human downloads and posts. Reviewed Instagram numbers pass through `reviewed-social-ratings.json` → `build-social-ratings.mjs`.

## 10. Quality gates

`audit-content.mjs --require ask-ve-taht --require sevdan-bir-ates --require abi --require gunesin-dogdugu-yer --require mercan-kosk` (curated shows must be
complete: synopsis + source, episode summaries, photos with sources) and `audit-cast.mjs` (casts need role source and photo; `personSlug` must exist;
no duplicate roles) **fail the deploy** when data are malformed. `untracked-ratings.mjs` only reports.

## 11. Deployment and concurrency

`pages.yml` has `concurrency: github-pages, cancel-in-progress: false`: runs queue, never cancel. Permissions: `contents: write` (persist steps), `pages: write`,
`id-token: write`. Details of each step and the schedule: [OPERATIONS.md](./OPERATIONS.md).

## 12. Unused scaffold (safe to ignore)

`app/`, `components/`, `hooks/`, `lib/`, `db/`, `drizzle/`, `drizzle.config.ts`, `vite.config.ts`, `next.config.ts`, `cloudflare-env.d.ts`, `vendor/`, `scripts/`,
`package.json` scripts `dev/build/start/db:generate/collect*` and `automation/collector.mjs` + `sources.json` belong to the first-day idea of a Cloudflare Workers + D1 +
R2 backend (see [AUTOMATION.md](./AUTOMATION.md)). It is **not deployed** and not the source of public data. `package.json` scripts `content:check`,
`content:queue`, `content:discover`, `cast:check` are the ones in use.
