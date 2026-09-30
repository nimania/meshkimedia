# Project history & changelog

Meshki Media began life as **DiziMeter**. This page records how it evolved so that
anyone picking up the project understands its intent and its data decisions.

## Timeline

| Date | Milestone |
| --- | --- |
| 2026‑09‑17 | **Repository initialized** — `chore: initialize DiziMeter repository`. |
| 2026‑09‑17 | **Foundation** — `feat: launch DiziMeter foundation`: Next.js‑compatible app on Cloudflare Workers, D1 + Drizzle schema (series, episodes, ratings, recaps, sources, snapshots, ingestion runs), R2 snapshot ingestion, and the source registry (TİAK, broadcasters, Dizilah). |
| 2026‑09‑17 | **CI gating** — `ci: gate collector until production secrets are ready`. |
| 2026‑09‑17 | **Live ratings on Pages** — `feat: publish live ratings on GitHub Pages`: a static Persian RTL slice reading TİAK’s public **Total** top‑10. |
| 2026‑09‑18 | **Design system** — `style: align … design system`. |
| 2026‑09‑18 | **Series profiles** — `feat: add Persian names and series profiles`. |
| 2026‑09‑18 | **Episodes, networks, multi‑mode ratings** — `Add episode & network pages, multi-mode ratings (Total/AB/ABC1), 10-day window`: per‑episode pages with photos and trailers, per‑network pages + index with generated marks, browse‑by‑network, a Total/AB/ABC1 switcher, and a rolling 10‑day ratings window. The collector was rewritten to accumulate the window and to fold Turkish letters so program names match series keys. |
| 2026‑09‑18 | **Rebrand → Meshki Media (مشکی مدیا)** — new name, logo, favicon, titles, metadata, README, workflow names, and public URLs (`nimania.github.io/meshkimedia`). Internal identifiers (`window.DiziMeter`, `dizimeter.js`) were intentionally left unchanged for stability. The GitHub repository was renamed `dizimeter → meshkimedia`. |
| 2026‑09‑27/28 | **Ratings depth and social** — visual rating trends (#12), daily social cards (#15), collection of all three TİAK tables (#14), reviewed Instagram supplement (#26), a month of backfilled reports (#27), Jalali dates and episode carousels (#28), Search Console verification file. |
| 2026‑09‑29 | **Casts and calendar** — official casts for most series (Persian names, role notes, `audit-cast`), continuous episode numbers with `firstEpisode` and `sync-episodes.mjs`, untracked Top 10 report, OZET/TKR/T.S row labels. |
| 2026‑09‑29 | **News + bios** — RSS collector with entity linking, filters, Persian AI stories, Wikipedia bios, news page and news sections on series/actor/network pages, per-story pages, home strip. |
| 2026‑09‑29/30 | **Merged stories** — duplicate reports from several outlets become one story with a source comparison and outlet badges; Gemini model auto-discovery after `gemini-2.5-flash` was retired; run-summary diagnostics. |
| 2026‑09‑30 | **Documentation overhaul** — HANDOFF, OPERATIONS, DECISIONS, ROADMAP added; ARCHITECTURE, DATA-MODEL, NEWS, AUTOMATION rewritten. |

## Design decisions that persist

- **Static, data‑driven site.** The public experience is plain HTML/CSS/JS generated
  from three JSON files — cheap to host, easy to audit, no server required.
- **Single source of truth for ratings.** Episodes join ratings by
  `(ratingKey, date)` rather than copying numbers, so one dataset drives every view.
- **Honesty over completeness.** TİAK publishes exact numbers only for **Total**;
  AB/ABC1 are shown as ranks. Missing values are never guessed. See
  [`DATA-MODEL.md`](./DATA-MODEL.md) and [`SOURCES.md`](./SOURCES.md).
- **Original network marks.** Channel “logos” are generated typographic badges, not
  the broadcasters’ trademarked logos.

## Naming note

The name changed from DiziMeter to Meshki Media, but three internal things kept the
old name on purpose because they are not user‑facing and renaming them only risks
breakage:

- the shared client file `github-pages/dizimeter.js`;
- the JS global `window.DiziMeter`;
- the GitHub Actions ingest **secret names** `DIZIMETER_INGEST_URL` /
  `DIZIMETER_INGEST_SECRET` (renaming these would require re‑creating the secrets).
