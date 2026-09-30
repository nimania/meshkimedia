# News and actor bios

The news system turns Turkish entertainment RSS feeds into **Persian stories** linked to the site's series, actors and
networks. Code: `automation/news-collect.mjs` (collector), `automation/news-bios.mjs` (Wikipedia bios),
`automation/build-site.mjs` (story pages, feed), `github-pages/news.js` (browser rendering), config
`automation/news-sources.json`. Data: `github-pages/data/news.json` (truth), `bios.json`, and the generated public
`data/news-feed.json`.

## 1. Pipeline overview

```
RSS feeds (8)  →  parse  →  canonical URL + id  →  entity linking  →  scope + sensitive filter
   →  cluster duplicates across outlets (one story, many sources)
   →  Gemini: Persian title, summary, explainer, kind, source titles, comparison   (needs AI_API_KEY)
   →  prune/retain  →  news.json
build-site.mjs: stories with titleFa → data/news-feed.json ; stories with bodyFa → /haber/<id>/ pages
news.js: news page, series/actor/network sections, home strip
```

Runs inside `pages.yml` before the site build; a failure never blocks publishing.

## 2. Feeds (`automation/news-sources.json`)

`feeds[]`: `id`, `name`, `url`, `lang` (`tr`/`en`), `kind` (`media` | `official`), `entertainment` (true = a gossip/magazine
category kept as "general" news even when nothing tracked is named), `color`, `abbr` (used for the outlet logo badge).

| id | Outlet | Feed |
| --- | --- | --- |
| `hurriyet-kelebek` | Hürriyet | hurriyet.com.tr/rss/kelebek |
| `sabah-magazin` | Sabah | sabah.com.tr/rss/magazin.xml |
| `milliyet-magazin` | Milliyet | milliyet.com.tr/rss/rssnew/magazinrss.xml |
| `haberturk-magazin` | Habertürk | haberturk.com/rss/magazin.xml |
| `sozcu-magazin` | Sözcü | sozcu.com.tr/feeds-rss-category-magazin |
| `trthaber-kultur` | TRT Haber | trthaber.com/kultur_sanat_articles.rss |
| `aa-kultur` | Anadolu Ajansı | aa.com.tr/tr/rss/default?cat=kultur |
| `dailysabah-arts` | Daily Sabah (EN) | dailysabah.com/rssFeed/arts |

Config keys: `maxAgeDays` 45, `maxGeneralAgeDays` 14, `maxGeneralItems` 200, `maxPageAgeDays` 120, `maxItems` 800,
`requireContextWords`, `rumorWords`, `blocklist`. The `_comment` fields explain each. To add a feed: append an object and
check the next run's summary for its counts. A dead feed is logged and skipped; remove it.

Parsing quirks already handled (all seen in production): titles wrapped in CDATA (`unCdata` before tag stripping),
dates with entity-encoded `+` (`&#x2B;0300`), Milliyet's link only in `<atom:link href>`, Atom `<link href>`, GUID used as
link only if it is a URL, stale Hürriyet feed (use the `kelebek` feed).

## 3. Entity linking and scope

`fold()` lower-cases and strips Turkish diacritics (İ/ı/ş/ğ/ü/ö/ç), so "Ünalmış" matches "unalmis". Entities:

- **series** — `titleTr`, the head before `:`/`-`, and the slug word;
- **people** — `people.json` names with ≥ 2 tokens;
- **networks** — only explicit names in `EXPLICIT_NETWORKS` (Kanal D, Show TV, Star TV, TRT 1), plus the network of any matched series.

A series named by a single short common word (e.g. "Haysiyet", ≤ 8 chars, one token) must also have a context word
(`dizi`, `bolum`, `fragman`, `final`, `set` …) and appear in the **headline**, to avoid false matches. Idiom guard:
"bir dizi etkinlik" (= "a series of events") is ignored by the `noIdiom` rule.

`scope` per story: **`linked`** (names a tracked series/actor) › **`dizi`** (clearly about TV series — `strongRe`) ›
**`general`** (other entertainment from `entertainment: true` feeds). Anything else is dropped as unrelated.

## 4. Safety filters

- `blocklist` keyword groups (`crime-or-abuse`, `health`) match folded title+snippet; matched stories are **never stored**.
  Topics: harassment, abuse, sexual matters, violence, arrests/custody, suicide, investigations; illness, hospital, surgery, cancer.
  Court/lawsuit/dispute words are **not** on the list today (a story about a court testimony passed); extend if needed.
- Gemini also returns `sensitive: true` for health, crime/abuse allegations, minors, sexual matters, private tragedy → the story is dropped.
- `kind`: `official` (feed of kind `official` or the model says a network/person announced it), `rumor` (`rumorWords` heuristic or model), else `media`.
  Rumor stories carry a visible warning on their page.

## 5. Clustering (one story, many outlets)

After collection, all stories (old + new) are processed oldest-first. `sameStory(a, b)` is true when: the outlets differ (one
article per outlet per story), published within 72 h, and either title-token Jaccard similarity ≥ 0.40 **or** they share ≥ 1 linked
series/actor **and** ≥ 2 title tokens **and** Jaccard ≥ 0.20 (tokens: folded words ≥ 4 chars minus a stop list).

Merge rules (`pool` loop in `news-collect.mjs`): the earlier story is the **primary** (keeps `id`, therefore the permalink);
`sources[]` gains the other outlet(s) (max 6); the other story's `id` goes into `mergedIds` (never re-collected); entities are
unioned; first available image/video is kept; best scope wins; `official` wins. Two stories that both already have pages
are never merged (permalinks stay valid). If a story with a Persian text gains a source, `regen = true` and Gemini rewrites it.

## 6. Gemini step

Enabled only when `AI_API_KEY` exists. For each queued story (new, or missing `bodyFa` and not `aiFailed`, or `regen`), sorted by
scope then recency, up to `NEWS_MAX_AI` (default 40) per run:

1. Fetch the opening of each source article (≤ 4 sources, ≤ 1600 chars each — **used only as model input, never stored or shown**).
2. One prompt with: title/snippet/opening of every source, and a glossary of Persian names for the matched series/actors.
   The model must use only that material and return JSON:
   `titleFa`, `summaryFa` (≤ 2 sentences), `bodyFa[]` (2–4 paragraphs, 120–260 words, own words — not a translation),
   `kind`, `sensitive`, `sourceTitles[]` (Persian title of each source headline), `comparison`
   `{agree[], differ[{topic, views[{source:"s1"…, text}]}], unconfirmed[]}` (only for ≥ 2 sources).
3. `cleanComparison()` validates/truncates, maps `s1…` to outlet ids and drops empty output.

**Model selection** (`modelList()`): the preferred `GEMINI_MODEL` (default `gemini-3.8-flash`), then up to five "flash" text models
returned by the API's ListModels for the key (newest first), then `gemini-flash-latest`. Each request tries models in order
(keys rotate); HTTP 503/500 waits 2 s and moves on; 404/429/403 also moves on; up to 8 attempts per story. Three consecutive
failed stories end the Gemini step for that run (next run resumes). Every failure is summarised in the run summary. **Model names
retire** (gemini-2.5-flash did in Sept 2026); this design avoids hard-coding a single name.

If a story fails twice without body text it is marked `aiFailed` and not retried. Without a key, stories keep Turkish titles and the
public feed hides them (§8).

## 7. `news.json` schema and retention

`{ updated, items: Story[] }`, `updated` only changes when items change. Story:

```json
{
  "id": "50054094537e",            // sha1(canonical url)[0..12] of the primary article; stable permalink
  "url": "https://…", "source": "haberturk-magazin", "sourceName": "Habertürk", "lang": "tr",
  "title": "Turkish headline", "snippet": "≤500 chars",
  "image": "https://… (hotlinked)", "video": {"provider":"youtube","id":"11chars"} | null,
  "published": "ISO", "scope": "linked|dizi|general", "kind": "official|media|rumor",
  "entities": {"series":["slug"],"people":["slug"],"networks":["slug"]},
  "sources": [{"source":"…","name":"…","url":"…","title":"…","snippet":"≤300","published":"ISO","titleFa":"…"}],
  "mergedIds": ["…"],
  "titleFa": "…", "summaryFa": "…", "bodyFa": ["…"],
  "comparison": {"agree":["…"],"differ":[{"topic":"…","views":[{"source":"id","text":"…"}]}],"unconfirmed":["…"]},
  "ai": true, "aiTries": 1, "aiFailed": true, "regen": true, "drop": true   // internal flags
}
```

Retention: general-scope stories 14 days (max 200); other stories 45 days; stories with `bodyFa` 120 days; hard cap 800.
Entity slugs that no longer exist in series/people/networks are removed on each run.

## 8. Public feed and pages (`build-site.mjs`)

- `data/news-feed.json` = `{updated, outlets, items}`: **only stories with `titleFa`** (max 400), without `snippet`, `bodyFa`, `comparison`,
  `mergedIds`, internal flags; `sources` reduced to `{source,name,url}`; `page` = whether a story page exists; `outlets` = badge metadata.
- **Story page** `/haber/<id>/` for stories with `titleFa` + non-empty `bodyFa` + https url: meta row (kind, "N منبع", date), headline, hero image
  (hotlink, `referrerpolicy=no-referrer`, source credit), rumor warning, lead + explainer, click-to-load YouTube (`youtube-nocookie`) when a video id
  exists, AI disclaimer, **مقایسهٔ منابع** (agree ✓ / differ ≠ / unconfirmed ؟, with outlet badges), **منابع** (one row per outlet: logo badge + Persian
  source headline, links to the original article), live TİAK rating cards for the linked series (`latestRating`), related series/actors/networks,
  share (Telegram, WhatsApp, X, copy), related stories, JSON-LD `NewsArticle` (`isBasedOn` = all source URLs).
- **Outlet logos**: `outletBadge()` renders a coloured wordmark badge from `color`/`abbr`. To use a real logo, add
  `github-pages/images/outlets/<feed id>.png|webp|svg|jpg`; it is picked up automatically (only add logos you may use).
- Story pages are generated for **all** stories with a body; sitemap entries priority 0.5.

`github-pages/news.js` (`window.DMNews = {mount, page, load, select}`): loads `news-feed.json` (no-store) + base data; cards show outlet badges
(each links to that outlet's article), "N منبع", chips for series/actors/networks; `page()` = full news page (scope tabs "سریال و بازیگران" /
"سرگرمی عمومی" / "همه", kind tabs, network select, search, weekly trending chips); `home()` fills `#home-news` (latest six, prefers scope `site`);
auto-mounts `#news-page`, `#series-news`, `#actor-news`, `#network-news`, `#home-news`. One delegated click handler for `.news-video-btn` and `[data-copy]`.

## 9. Actor bios (`news-bios.mjs` → `bios.json`)

Per actor in `people.json` (60 per run; refresh 90 days; "not found" retried after 14 days): Wikipedia REST summary — Turkish first, English second,
with an opensearch fallback. A page is accepted only if `titleMatchesName` (surname present and first-name prefix) and the text looks like an
actor biography (`ACTOR_RE`) — this stopped "Sahra Şaş" matching an Iranian namesake. Persian text: fa.wikipedia via langlinks; else Gemini
translation flagged `machine: true`. Entry: `{lang, text, source{name,url,license:"CC BY-SA 4.0"}, fa?{text,source,machine}, fetchedAt}`; `manual: true`
entries are never overwritten; an editorial `people.json.bio` always wins. `actor-page.js` shows the text with a credit line (source link,
license, "machine translated"/"not translated" notes). Grokipedia is deliberately not used (licence/API unclear).

## 10. Editing checklist

- Change filters/feeds → edit `news-sources.json` (keywords are matched on folded text, so write them without diacritics).
- Change the story template → `newsItemPage()` in `build-site.mjs` (+ CSS in `styles.css`, bump `?v=`).
- Change how stories are written → the prompt in `summarize()`.
- Remove a bad story by hand → delete it from `news.json` and add its `id` to another story's `mergedIds`, or accept that it may be re-collected
  while still inside the feed window.
