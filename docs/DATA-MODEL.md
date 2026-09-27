# Data model

All public content is driven by three JSON files in
[`github-pages/data/`](../github-pages/data). Edit these, regenerate the pages, and
the whole site updates. Nothing here is invented — see the honesty policy below.

## Rating categories

Turkish TV ratings are reported for audience groups. Meshki Media uses three:

| Key | Label | Audience | Numbers public? |
| --- | --- | --- | --- |
| `total` | Total | 5+ Yaş Tüm Kişiler (everyone 5+) | **Yes** — exact `Rating %` from TİAK |
| `ab` | AB | Higher socio‑economic group | Ranking only (public) |
| `abc1` | ABC1 | ABC1, 20+ (often the “most important” demo) | Ranking only (public) |

`ratings.json` stores a `rating` number when known and `null` otherwise; `hasNumbers`
records which categories have real numbers for that day.

## `networks.json`

Map of `slug → network`.

```json
{
  "show-tv": {
    "slug": "show-tv",
    "name": "Show TV",
    "nameFa": "شوتی‌وی",
    "ratingKeys": ["SHOW TV", "SHOW"],   // uppercase names as they appear in TİAK rows
    "color": "#e2001a",                   // brand color for the generated mark
    "abbr": "SHOW",                        // text shown on the generated logo
    "site": "https://www.showtv.com.tr/"
  }
}
```

## `series.json`

Map of `slug → series`. Episodes carry photos and the trailer (`fragman`).

```json
{
  "sevdan-bir-ates": {
    "slug": "sevdan-bir-ates",
    "titleFa": "سِودان بیر آتش",
    "titleTr": "Sevdan Bir Ateş",
    "ratingKey": "SEVDAN BIR ATES",   // must match the program name in ratings.json (ASCII, uppercase)
    "network": "show-tv",              // key into networks.json
    "status": "در حال پخش",
    "kind": "series",                  // "series" | "entertainment"
    "day": "چهارشنبه",
    "dayIndex": 2,                      // 0=Mon … 6=Sun (7 = other), for sorting
    "airing": "چهارشنبه‌ها ساعت ۲۰:۰۰",
    "genre": ["درام", "عاشقانه"],
    "hero": "https://…/hero.jpg",       // large cover image (optional)
    "photos": ["https://…/series-still.jpg"], // official series gallery photos
    "photosSource": "https://…/official-gallery", // attribution for those photos
    "fragman": "https://…",             // series trailer page (optional)
    "synopsis": "…",
    "synopsisSource": "https://…/official-story", // evidence for the Persian synopsis
    "official": { "website": "…", "episodes": "…", "youtube": "…" },
    "cast": [{ "name": "Murat Ünalmış", "nameFa": "مورات اونالمیش", "role": "Mirza Kozaklı", "roleFa": "میرزا کوزاکلی", "image": "…" }],
    "seasons": [
      {
        "number": 1,
        "label": "فصل اول",
        "episodes": [
          {
            "number": 2,
            "date": "2026-09-16",        // ISO date; used to join ratings + build the URL
            "title": "بازگشت به خانه",   // optional
            "image": "https://…",         // main still (optional)
            "images": ["https://…"],      // gallery (optional)
            "photosSource": "https://…/official-episode-gallery",
            "fragman": "https://…",       // episode trailer (optional; falls back to series.fragman)
            "summary": "…",               // recap (optional)
            "source": "https://…"          // official episode page
          }
        ]
      }
    ]
  }
}
```

Notes:
- `ratingKey` is the bridge to `ratings.json`. It must be the **ASCII, uppercase**
  form of the TİAK program name (e.g. `SEVDAN BIR ATES`). The collector folds
  Turkish letters (İ→I, Ş→S, Ğ→G, Ü→U, Ö→O, Ç→C) so keys line up.
- Optional fields may be `""`/`[]`/omitted; the UI degrades gracefully (shows
  “to be added”, hides empty sections, uses placeholders for missing images).

## `ratings.json`

A rolling window of the most recent days (newest first), each with the three
category tables.

```json
{
  "updatedAt": "2026-09-17T20:35:33.123Z",
  "metric": "Rating %",
  "windowDays": 10,
  "source": { "name": "TİAK", "url": "https://tiak.com.tr/" },
  "categories": {
    "total": { "key": "total", "label": "Total", "labelFa": "کل (۵+)", "audience": "5+ Yaş Tüm Kişiler" },
    "ab":    { "key": "ab",    "label": "AB",    "labelFa": "AB",       "audience": "AB" },
    "abc1":  { "key": "abc1",  "label": "ABC1",  "labelFa": "ABC1 (۲۰+)", "audience": "ABC1 20+" }
  },
  "days": [
    {
      "date": "16.09.2026",                 // DD.MM.YYYY (TİAK format)
      "weekday": "چهارشنبه",
      "hasNumbers": { "total": true, "ab": false, "abc1": false },
      "categories": {
        "total": [ { "rank": 1, "program": "SEVDAN BIR ATES", "network": "SHOW TV", "rating": 7.42 } ],
        "ab":    [ { "rank": 1, "program": "SEVDAN BIR ATES", "network": "SHOW TV", "rating": null } ],
        "abc1":  [ { "rank": 1, "program": "SEVDAN BIR ATES", "network": "SHOW TV", "rating": null } ]
      }
    }
  ]
}
```

The collector appends today’s Total automatically; AB/ABC1 rows are added manually
from official daily announcements (rank‑only unless a licensed numeric source is
configured).

## How to add a series

1. Add an entry to `github-pages/data/series.json` (at minimum: `slug`, `titleFa`,
   `titleTr`, `ratingKey`, `network`, `status`, `kind`, `day`, `dayIndex`,
   `airing`, and a `seasons` array — episodes can be empty at first).
2. If it airs on a new channel, add that channel to `networks.json`.
3. Regenerate the pages:
   ```bash
   node automation/build-site.mjs
   ```
4. Commit and push. The Pages workflow redeploys.

For a complete profile, add a verified Persian synopsis and a link to its official
source; an official cover and a sourced series gallery; and, for every published
episode, an original Persian summary, its exact broadcaster episode URL, and
multiple photos from that episode's broadcaster gallery. The episode date and
number must be checked against the broadcaster, rather than inferred from the
weekly schedule. `node automation/audit-content.mjs` reports the remaining gaps;
`--require <slug>` turns completeness into a publication gate for a curated show.

To add an episode, push a new object into the series’ `seasons[].episodes` with at
least `number` and `date`; a page at `/dizi/<slug>/bolum-<number>/` is generated,
and its ratings appear automatically once that date exists in `ratings.json`.

## Honesty policy

- **No invented numbers.** If TİAK has not published a value, the field is `null`
  and the UI shows the official **rank** instead.
- **AB/ABC1 numbers are not public** on TİAK’s free site; they require a licensed
  feed. Until then, only rankings are shown for those categories.
- **No republishing** of full recaps, subtitles, images, or articles from third
  parties — only factual metadata, links, and original Persian summaries.
- Network marks are **original typographic badges**, not the broadcasters’
  trademarked logos.
