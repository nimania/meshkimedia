# Meshki Media

A Persian-first, automation-first reference for Turkish TV series: schedules, episode recaps, daily ratings, and renewal/cancellation signals.

**Live site:** https://nimania.github.io/meshkimedia/ · **License:** [MIT](./LICENSE)

## Documentation

Full, open documentation lives in [`docs/`](./docs):

- [Overview](./docs/OVERVIEW.md) — what this is and where to start
- [Architecture](./docs/ARCHITECTURE.md) — how the static site is built, page types, URLs, deploy
- [Data model](./docs/DATA-MODEL.md) — JSON schemas, rating categories, how to add a series
- [Contributing](./docs/CONTRIBUTING.md) — run locally and regenerate pages
- [History & changelog](./docs/HISTORY.md)
- [Sources](./docs/SOURCES.md) · [Automation](./docs/AUTOMATION.md)
- [راهنمای فارسی](./docs/راهنما-fa.md) — Persian guide

## Product principles

- No routine manual publishing: collectors discover changes, preserve source snapshots, normalize records, and publish only after quality gates pass.
- Every fact keeps provenance, fetch time, content hash, and confidence.
- Primary sources win conflicts. TİAK and official broadcasters are primary; Dizilah is a valuable secondary discovery and cross-check source.
- Raw source documents live in R2; structured, searchable records live in D1.
- The public site never republishes full copyrighted articles, subtitles, episodes, or source pages. Official gallery images are linked from their broadcaster-hosted URLs with attribution.

## Current slice

- Persian RTL homepage with Total / AB / ABC1 rating modes, a rolling 10-day window, category + network filters, and browse-by-network
- Per-series profile pages (`/dizi/<slug>/`) with cast, episode recaps, and each episode's rating in all three modes
- Per-episode profile pages (`/dizi/<slug>/bolum-<n>/`) with photo gallery, fragman link, summary, ratings, and prev/next navigation
- Per-network pages (`/kanal/<slug>/`) with an original network mark, the network's series, and its latest-day placements; plus a networks index (`/kanal/`)
- D1 schema for series, episodes, ratings, recaps, sources, snapshots, and ingestion runs
- R2-backed source snapshot ingestion endpoint
- Scheduled GitHub Actions collector scaffold
- TİAK, Dizilah, and official broadcaster source registry

### Static GitHub Pages build (`github-pages/`)

The public site is a data-driven static build. Content lives in three JSON files under `github-pages/data/`:

- `networks.json` — networks, brand colors, and TİAK rating keys
- `series.json` — series metadata, cast, seasons, and episodes (with photos and fragman)
- `ratings.json` — a rolling 10-day window of the daily Total / AB / ABC1 tables

Two scripts run in the Pages workflow:

- `automation/build-pages-data.mjs` — fetches TİAK's public table and appends today's **Total** (with real `Rating %`) into the 10-day window, folding Turkish letters to ASCII so program names match series keys. TİAK's public homepage exposes only Total; AB/ABC1 rankings are preserved across runs and their exact numbers stay `null` until a member-data source is wired in. The script never invents numbers.
- `automation/build-site.mjs` — regenerates every series, episode, network, and index page (and the SVG network marks) from the JSON.

To add a series, add it to `series.json` and re-run `node automation/build-site.mjs`.

Ratings numbers come only from TİAK; where a real number is unavailable, the UI shows the official **rank** instead of a guessed value.

## Stack

- Next.js-compatible Vinext on Cloudflare Workers
- Cloudflare D1 + Drizzle
- Cloudflare R2
- GitHub Actions for scheduled collection

## Local development

```bash
pnpm install
pnpm run db:generate
pnpm run dev
```

Collector health check:

```bash
pnpm run collect:dry
```

## Required secrets

- `INGEST_SECRET` on the deployed Site
- `DIZIMETER_INGEST_URL` in GitHub Actions
- `DIZIMETER_INGEST_SECRET` in GitHub Actions
- An AI provider key will be added only when the recap-generation stage is enabled

See [docs/AUTOMATION.md](docs/AUTOMATION.md) and [docs/SOURCES.md](docs/SOURCES.md).
