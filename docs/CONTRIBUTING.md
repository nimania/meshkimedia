# Contributing & local development

Meshki Media is open (MIT). Contributions — new series, corrected data, fixes,
features — are welcome.

## Requirements

- Node.js 22 (what CI uses; 20+ works for the static build) (the generator and collector are plain ES modules; no dependencies
  are required to build the static site).
- Any static web server for local preview (the pages `fetch` JSON, so `file://`
  will not work).

## Run it locally

```bash
git clone https://github.com/nimania/meshkimedia.git
cd meshkimedia

# 1) (optional) regenerate all pages from the JSON data
node automation/build-site.mjs

# 2) serve the static site
cd github-pages
python3 -m http.server 8080
# open http://localhost:8080/
```

## Common tasks

| Task | Do this |
| --- | --- |
| Add / edit a series or episode | Edit `github-pages/data/series.json`, then `node automation/build-site.mjs` |
| Add a channel | Edit `github-pages/data/networks.json`, then regenerate |
| Add a rating day | Edit `github-pages/data/ratings.json` (or let the collector append Total) |
| Change page layout | Edit the template in `automation/build-site.mjs` and/or the page script, then regenerate |
| Add / fix a news feed or filter | Edit `automation/news-sources.json` ([NEWS.md](./NEWS.md)) |
| Test news without the network | `node automation/news-collect.mjs --fixture=fx.json --now=…` ([OPERATIONS.md](./OPERATIONS.md) §7) |
| Check quality gates | `npm run content:check`, `npm run cast:check` |
| Change styling | Edit `github-pages/styles.css` (design tokens live in `:root`) |

Full schema and the “add a series” walkthrough: [`DATA-MODEL.md`](./DATA-MODEL.md).

## Conventions

- **Data, not markup.** Prefer changing JSON over hand‑editing generated HTML;
  generated files are overwritten on the next build.
- **Persian‑first, RTL.** UI copy is Persian; numbers/dates render with Persian
  locale formatting. Keep Turkish titles in a secondary LTR line.
- **Design tokens.** Colors come from CSS variables in `:root` (and a dark override).
  Reuse them instead of hard‑coding colors.
- **No invented data.** See the honesty policy in [`DATA-MODEL.md`](./DATA-MODEL.md).
  Missing values stay empty/`null`; the UI shows a rank or a placeholder.
- **Slugs are ASCII** and stable (they are URLs).

## Verify before pushing

- `node automation/build-site.mjs` runs clean.
- The JSON files are valid (`node -e "JSON.parse(require('fs').readFileSync('github-pages/data/series.json'))"`).
- Spot‑check the home page, one series page, one episode page, and one network page
  in a local server.

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`, which refreshes ratings,
collects news/bios, regenerates the pages, and deploys to GitHub Pages at
`https://nimania.github.io/meshkimedia/`.
