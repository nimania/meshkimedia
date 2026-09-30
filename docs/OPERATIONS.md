# Operations runbook

How the site is run day to day: workflows, schedules, secrets, how to publish a change, how to read a run,
and what to do when something breaks. Everything here was learned from real incidents.

## 1. Workflows

| Workflow (file) | Triggers | What it does |
| --- | --- | --- |
| **Publish Meshki Media to GitHub Pages** (`pages.yml`) | push to `main` touching `github-pages/**` or the listed `automation/**` files and the workflow itself; cron `17 7-9 * * *` (10:47/11:47/12:47 Tehran) and `17 */6 * * *` (every 6 h); manual *Run workflow* | The whole site: collect → build → deploy → persist data. **The only production pipeline.** |
| **Daily editorial queue** (`editorial-queue.yml`) | cron `37 4 * * *`, manual | Checklist of incomplete profiles + candidate new episode links; artifact `editorial-queue`. Never changes data. |
| **Check Dizilah Instagram ratings** (`instagram-ratings.yml`) | cron `30 6,7,8,13 * * *`, manual | OCR of @dizilah rating posts for human review. Fails (red) when Meta secrets are missing — this is expected and harmless. |
| **Meshki Media Collector** (`collector.yml`) | cron every 2 h | Gated by repo variable `DIZIMETER_AUTOMATION_ENABLED == 'true'`; unset, so runs are "skipped". Legacy scaffold. |

Effective news freshness today: about 6–7 builds/day (3 morning + 4 from the 6-hourly cron) plus every push.
A dedicated lighter news schedule (e.g. every 60–120 min) is proposed in [ROADMAP.md](./ROADMAP.md).

### `pages.yml` step order (order matters)

1. `build-pages-data.mjs` — TİAK ratings (continue-on-error).
2. `sync-episodes.mjs` — calendar → `series.json`.
3. `news-collect.mjs` — news + Gemini (continue-on-error; needs `AI_API_KEY`).
4. `news-bios.mjs --limit=60` — Wikipedia bios (continue-on-error).
5. `build-site.mjs` — **generate all pages** from JSON.
6. `build-social-ratings.mjs`, the three social Python scripts.
7. `audit-content.mjs --require …` and `audit-cast.mjs` — **quality gates; a failure blocks deploy.**
8. `untracked-ratings.mjs` (report only).
9. Configure Pages → upload artifact → **Deploy**.
10. Persist steps (after deploy, even if something failed): commit `ratings.json`, `series.json`, `news.json`+`bios.json`
    to `main` with `[skip ci]`; each retries `git pull --rebase && git push` 3 times.

## 2. Secrets and variables

| Name | Where | Purpose | Status |
| --- | --- | --- | --- |
| `AI_API_KEY` | repo Actions secret | Gemini API key(s), comma-separated to rotate. Used by `news-collect.mjs` and `news-bios.mjs`. Also accepts `GEMINI_API_KEY` in the environment locally. | **Set** |
| `GEMINI_MODEL` | optional env | Preferred model; default `gemini-3.8-flash`, then auto-discovered fallbacks | unset |
| `NEWS_MAX_AI` | optional env | Max stories sent to Gemini per run (default 40) | unset |
| `INSTAGRAM_USER_ID`, `INSTAGRAM_GRAPH_TOKEN` | repo secrets | Meta Business Discovery for @dizilah monitoring ([instagram-ratings.md](./instagram-ratings.md)) | not set |
| `DIZIMETER_INGEST_URL`, `DIZIMETER_INGEST_SECRET`, var `DIZIMETER_AUTOMATION_ENABLED` | repo | Legacy collector backend | not set |
| *(planned)* `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | repo secrets | Auto-post news to a Telegram channel | not built yet |

**Only the owner can create or change secrets** (github.com/nimania/meshkimedia/settings/secrets/actions →
*New repository secret*). An assistant must never type keys/passwords into any field. To get a Gemini key:
aistudio.google.com/apikey → *Create API key* → paste into the secret named exactly `AI_API_KEY`.

## 3. How to publish a change

### 3a. With git (developer)

```bash
git fetch && git reset --hard origin/main      # or pull --rebase; the bot commits often
# edit …
node automation/build-site.mjs                  # optional local check
git add -A && git commit -m "…" && git push origin HEAD:main
```

### 3b. Through the GitHub web UI (what the owner's assistant does)

1. Prepare the files locally in a staging folder; **use exactly the repository file names**.
2. Open `https://github.com/nimania/meshkimedia/upload/main/<directory>` (e.g. `automation`, `github-pages`,
   `docs`, `github-pages/data`). Files land in the directory of the URL, so upload one directory per commit.
3. Attach files to the page's file input (browser tool `file_upload`; never click the visible button — it opens a native dialog).
4. Set the commit message in `input[placeholder="Add files via upload"]` (set the value with the native setter and dispatch `input`).
5. Click the button whose text is exactly **Commit changes** (scroll it into view first — it is often off-screen).
6. Check `github.com/nimania/meshkimedia/commits/main`, then the run in `/actions/workflows/pages.yml`.

Uploading an existing name **overwrites** it. Do not upload the generated HTML — only sources.

### 3c. Just re-run

*Actions → Publish Meshki Media to GitHub Pages → Run workflow (branch main)*. Use this after adding a secret or
when a run was stuck.

## 4. Reading a run

Open the run → **Summary** (the "اخبار" block is written by `news-collect.mjs`):

- feed counts: `hurriyet-kelebek: 100 read, N new kept` (a feed with 0 read and a `head` shows what the server returned instead of XML);
- `ترجمهٔ فارسی: N خبر ساخته شد …` and, when things failed, `مدل‌ها:`, `پاسخ‌های ناموفق:` and the first Gemini error messages;
- the untracked-Top-10 report (programs on TİAK that no series covers yet);
- annotations (errors such as "Could not push news.json…").

Step logs: expand steps under the job (the log viewer sometimes needs several clicks; the Summary is more reliable).

## 5. Verifying the live site

- `https://nimania.github.io/meshkimedia/data/news-feed.json` — public feed; `items.length` should be > 0 once Gemini worked; `items[].page` is true for stories with their own page.
- `https://nimania.github.io/meshkimedia/data/ratings.json` — latest TİAK date is `days[0].date`.
- A story page: `/haber/<id>/`. Home strip: section `#latest-news` (hidden while there are no Persian stories).
- Browsers cache JS/CSS by `?v=`; hard-reload after a deploy that changed them.

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| News titles Turkish / no stories on the site | Gemini step produced nothing. Summary says `کلید … نرسید` → secret missing/misnamed; `HTTP 404 model … no longer available` → retired model; `HTTP 503 … high demand` → overloaded | Add secret `AI_API_KEY`; the collector auto-discovers models and retries, so re-run later; check the summary's `مدل‌ها` line. Override with env `GEMINI_MODEL`. |
| `all Gemini keys are rate-limited` | HTTP 429/403 on every model/key (free-tier quota) | Add a second key (comma-separated in `AI_API_KEY`), lower `NEWS_MAX_AI`, wait a day |
| Run red: "Could not push news.json and bios.json to main" | Race with another bot commit; all 3 rebase attempts failed | Re-run. The site was already deployed; only persistence failed (next run recollects). |
| Run stuck on "Deploying to github-pages" >10 min | GitHub Pages deploy hang | Cancel the run and *Run workflow* again |
| A whole feed shows 0 items | Feed moved/broken, or XML variant not parsed (CDATA titles, `atom:link`, entity-encoded dates were all seen) | Look at the `head` text in the summary, fix `news-sources.json` or `parseFeed`; remove dead feeds |
| Fewer ratings than expected / stale date | TİAK late or markup changed (`tiak-daily.mjs` refuses incomplete tables) | Wait for the next scheduled run; the site keeps the last verified date |
| Build fails at "Check editorial content" / "Check cast connections" | Malformed series/cast data (missing `source`, broken `personSlug`, duplicate episode number …) | Read the error lines, fix `series.json` / `people.json`; run `npm run content:check` / `cast:check` locally |
| Top 10 program not on the site | No series with that `ratingKey` | See the "untracked" block in the summary; add the series to `series.json` |
| Instagram workflow red | Meta secrets absent | Expected until configured |
| Sandbox: 403 "Host not in allowlist" for news/Wikipedia/Google | The dev environment's egress filter | Use fixtures; real runs happen in Actions |
| Changed JS/CSS not visible | Browser cache | Bump the `?v=` string (see ARCHITECTURE) and hard-reload |
| `git pull` refuses (local changes) | Generated files modified by a local build | `git fetch && git reset --hard origin/main && git clean -fd` (copy your edits out first) |

## 7. Testing without the network

News:

```bash
node automation/news-collect.mjs --fixture=fx.json --now=2026-09-29T12:00:00Z
```

`fx.json` maps feed id → RSS XML text, e.g. `{"hurriyet-kelebek":"<rss>…</rss>"}`. Feeds without a fixture are reported as failed.
Never run the module through `import()` for a quick check: it executes and **overwrites `news.json`** (restore with `git checkout`).
Bios: `node automation/news-bios.mjs --fixture=bios-fx.json` (map URL → JSON response). Build: `node automation/build-site.mjs` then serve
`github-pages/` with `python3 -m http.server` and look at it with a browser (Playwright/Chromium is available in the agent sandbox).
Unit tests: `node --test automation/discover-episodes.test.mjs`.

## 8. Backups and recovery

The repo *is* the backup: all data live in `github-pages/data/*.json` on `main`. To roll back a bad data commit:
GitHub → the file → *History* → open the good version → *Edit → commit*; or `git revert <sha>`. Pages redeploys on the next push.
News older than the retention limits is intentionally dropped (see NEWS.md §7).
