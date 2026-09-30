# Roadmap and open items

State as of **2026-09-30**. Items are grouped by status; the owner's own priorities are marked ★. Update this file when something ships.

## In progress / next (agreed with the owner)

1. ★ **Telegram channel auto-post.** Post every new Persian story (image + title + summary + link to the site page + outlet names) to a channel.
   Plan: Bot API `sendPhoto`/`sendMessage`; new secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` (owner creates the bot with @BotFather, makes it an admin of the channel
   and adds the secrets); a `tg: true` flag per story in `news.json` to avoid duplicates; on the first run mark existing stories as posted (no backfill flood); max ~5 posts per run;
   rumour stories keep their label; skip stories without a page. Needs a dedicated, lighter workflow (see 3) to feel "immediate".
2. ★ **Related images and videos inside stories.** Up to 3–4 extra hotlinked images per story (from the article page, with credit and link) and videos from: YouTube embeds found in the
   article, and the site's own fragman archive for the mentioned series (safest). Keep click-to-load; never copy files.
3. **Separate news workflow / schedule** (every 60–120 min) that runs collect → build → deploy; today freshness is ≈ 6–7 builds/day. Watch the Gemini free-tier quota (`NEWS_MAX_AI`).

## Content backlog

- ★ **Complete 2026 series first, then older years backwards, then platforms** (see DECISIONS #7). First build: year/platform/status fields, filters, and a "no ratings" label.
- 3 Star TV series without verified casts; ~22 roles without descriptions; NOW cast spelling for one actor unverified.
- `Yeraltı` season 2 `firstEpisode` unknown (season skipped by `sync-episodes.mjs`).
- Three Top 10 programs currently untracked: *Altı Üstü İstanbul* (ATV, "ÖN GÖSTERİM"/"ÖZEL" variants) and *Taşacak Bu Deniz* (TRT 1) — add to `series.json` when appropriate.
- Real outlet logos (optional): drop files in `github-pages/images/outlets/<feed id>.png`.
- Kanal D still uses a generated mark (no verified logo asset).

## Technical debt / ideas

- JS error `Cannot read properties of null (reading 'classList')` on actor/character pages (content renders; source not yet found).
- Extend the news `blocklist` with court/lawsuit words if the owner wants stricter policy (one merged story about a court testimony was published).
- Alert (issue or summary banner) when TİAK data are stale for more than a day; when a feed returns 0 items on several consecutive runs.
- Cluster quality: cross-language matching (Daily Sabah EN) relies on shared entities; consider asking Gemini to confirm merges if false merges appear.
- Persist the cached Gemini output for merged stories so a `regen` can reuse per-source titles.
- Instagram/Meta setup for the Dizilah monitor (`INSTAGRAM_USER_ID`, `INSTAGRAM_GRAPH_TOKEN`); until then that workflow is red by design.
- Optionally delete the unused Next/Cloudflare scaffold to reduce confusion (needs the owner's OK).
- `HISTORY.md` timeline stops being detailed after 09-18; use `git log` for exact history.

## Done recently (for orientation)

- 2026-09-29/30: news system end to end (feeds, linking, filters, clustering, Persian stories with source comparison, outlet badges, story pages, home strip, series/actor/network news,
  Wikipedia bios, run-summary diagnostics, model auto-discovery); continuous episode numbers + calendar sync; casts for 23+ series; rating trend charts; social publication room; Jalali dates;
  Search Console verification; these docs.
