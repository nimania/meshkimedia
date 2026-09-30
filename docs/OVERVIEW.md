# Meshki Media — Project Overview

**Meshki Media (Persian: مشکی مدیا)** is a Persian‑first, automation‑first reference
for Turkish television: daily ratings, series and episode profiles, broadcast
schedules, and episode recaps — presented in Persian (RTL) for a Persian‑speaking
audience that follows Turkish `dizi`.

- **Live site:** https://nimania.github.io/meshkimedia/
- **Source:** https://github.com/nimania/meshkimedia
- **Data authority:** [TİAK](https://tiak.com.tr/) (official Turkish TV audience measurement)
- **License:** MIT (see [`LICENSE`](../LICENSE))

> Meshki Media was previously named **DiziMeter**. Older commits, the internal
> asset filename `dizimeter.js`, and the JS global `window.DiziMeter` keep the old
> name for stability; everything user‑facing is Meshki Media. See
> [`HISTORY.md`](./HISTORY.md).

## What the live site does

The published site is a **static, data‑driven** web app (plain HTML/CSS/JS, no
build step required to view it). It offers:

- **Daily ratings** in three official audience categories — **Total** (5+),
  **AB**, and **ABC1** (20+) — with a switcher and a rolling **10‑day** window.
- **Series profiles** at `/dizi/<slug>/` — cast, synopsis, official links, and an
  episode list where each episode shows its rating in all three categories.
- **Episode profiles** at `/dizi/<slug>/bolum-<n>/` — photo gallery, trailer
  (`fragman`) link, recap, per‑category ratings with ranks, and prev/next
  navigation.
- **Network pages** at `/kanal/<slug>/` plus a networks index at `/kanal/` — browse
  every series grouped by channel, each with a network mark (logo).
- **Actor pages** at `/oyuncu/<slug>/` and **character pages** at `/karakter/<slug>/`,
  linked from every series’ cast, with an actor’s full filmography.
- **List pages:** all series `/diziler/`, actors `/oyuncular/`, characters
  `/karakterler/`, a recap archive `/ozetler/`, and a trailer (fragman) archive
  `/fragmanlar/` — each searchable.
- **Broadcast calendar** at `/takvim/` — the weekly schedule with air times in
  **Turkey**, **Iran**, and **US Pacific (Los Angeles)**, computed with correct DST.
- **News** at `/haber/` — Persian stories merged from several Turkish outlets, each with its own page, source comparison and outlet badges; news tabs on series, actor and network pages.
- **Site search** at `/ara/` (and a box on the home page) across series, episodes,
  actors, characters, and networks.
- **SEO built in:** per‑page titles, meta descriptions, canonical URLs, Open Graph /
  Twitter cards, JSON‑LD structured data (`TVSeries`, `TVEpisode`, `Person`,
  `Organization`), a generated `sitemap.xml`, and `robots.txt`.

## Honesty policy (important)

Meshki Media **never invents ratings numbers.** TİAK publishes only the **Total**
top list with exact `Rating %` values on its public site; the **AB** and **ABC1**
groups are published as **rankings** only. Where an exact number is not publicly
available, the UI shows the official **rank** (e.g. `#۱`) instead of a guessed
value. See [`SOURCES.md`](./SOURCES.md) and [`DATA-MODEL.md`](./DATA-MODEL.md).

## Two layers of the project

1. **Shipped static site** — everything under [`github-pages/`](../github-pages),
   generated from three JSON files by a small Node script and deployed to GitHub
   Pages. This is what is live today. Start here:
   [`ARCHITECTURE.md`](./ARCHITECTURE.md).
2. **Automation vision** — a larger collector/normalizer pipeline (Next.js‑compatible
   on Cloudflare Workers, D1 + Drizzle, R2 snapshots) that is scaffolded in the repo
   but not yet the source of the public data. See [`AUTOMATION.md`](./AUTOMATION.md).

## Documentation map

| Doc | What it covers |
| --- | --- |
| [`HANDOFF.md`](./HANDOFF.md) | **Start here** — state, rules, repo map, traps (for any developer/AI) |
| [`OPERATIONS.md`](./OPERATIONS.md) | Workflows, secrets, publishing, troubleshooting |
| [`OVERVIEW.md`](./OVERVIEW.md) | This file — what the project is |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How the static site is built, page types, URL scheme, deploy |
| [`DATA-MODEL.md`](./DATA-MODEL.md) | JSON schemas, rating categories, how to add a series/episode |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Run locally, regenerate pages, coding conventions |
| [`NEWS.md`](./NEWS.md) | News and bios pipeline in depth |
| [`DECISIONS.md`](./DECISIONS.md) | Policies and why things are as they are |
| [`ROADMAP.md`](./ROADMAP.md) | Open items and planned work |
| [`HISTORY.md`](./HISTORY.md) | Project history and changelog |
| [`SOURCES.md`](./SOURCES.md) | Data sources, authority, copyright boundary |
| [`AUTOMATION.md`](./AUTOMATION.md) | The collector/pipeline vision |
| [`راهنما-fa.md`](./راهنما-fa.md) | Persian‑language guide (راهنمای فارسی) |

## License & reuse

The code is released under the **MIT License**, so anyone may use, modify, and
redistribute it. Note that the **data** it displays belongs to its sources
(TİAK, broadcasters). Reuse the code freely; attribute and respect the terms of
the underlying data providers. Network marks are Wikimedia Commons assets where the licence allows (see `automation/network-logos/README.md`), otherwise generated
typographic badges; broadcaster trademarks stay with their owners.
