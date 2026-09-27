# Automation architecture

## What runs today on GitHub Pages

The Pages workflow refreshes public TİAK ratings every two hours. It rebuilds
pages from `github-pages/data/series.json`, but does not discover new episodes,
write Persian summaries, or collect gallery photos. The separate collector
workflow sends snapshots to an optional ingest service and does not update the
GitHub Pages content file.

`Daily editorial queue` runs once per day and on demand. Its job summary and
downloadable artifact list incomplete profiles and registered episodes, plus
active shows with no recorded episode or whose last recorded episode is at least seven days old. The latter
are prompts to check official episode lists, not evidence that anything aired.
Run the same report locally with `npm run content:queue`. Editorial work should
use the broadcaster's story, episode and gallery pages, verify an air date, write
an original Persian summary, and then pass `npm run content:check` before
publishing. The queue deliberately leaves missing facts empty.

To make this a daily content pipeline, add a source adapter for each broadcaster
that records changed official episode and gallery URLs in a review queue. Generate
Persian drafts only from captured evidence; check episode number, air date,
image URL and source attribution; approve the draft before updating `series.json`.
Record the last successful fetch and alert on repeated source failures. Never
publish a future episode's trailer as an aired recap.

## Pipeline

1. **Discover** — scheduled collectors request a small registry of high-value pages.
2. **Snapshot** — unchanged documents are skipped by SHA-256 hash; changed source bodies are stored in R2.
3. **Normalize** — source-specific adapters extract shows, episodes, schedules, ratings, and status changes.
4. **Resolve** — aliases map Turkish/Persian titles and network naming to one canonical series record.
5. **Cross-check** — ratings and major status changes require a primary source or two independent secondary confirmations.
6. **Generate** — recap drafts are produced only from evidence bundles tied to source item IDs.
7. **Quality gate** — claims without evidence, impossible episode jumps, duplicate pages, low confidence, and conflicting dates block publication.
8. **Publish** — accepted records update D1 and invalidate the affected series, ratings, and recap pages.
9. **Observe** — every run records counts, duration, failure summary, and the last successful source fetch.

## Failure policy

- A single source failure does not stop the run.
- The collector uses bounded timeouts and never retries a permanent 4xx response in the same run.
- A changed HTML structure marks the adapter degraded and preserves the snapshot for debugging.
- No rating is invented or inferred from social engagement.
- No recap is published when the available evidence describes only a trailer.
- A run can finish as `partial`; the last verified public data remains visible.

## Dizilah adapter policy

Dizilah is especially useful for daily calendars, season/episode numbering, new and upcoming shows, and cancellation/renewal signals. It also publishes daily ratings, but states that its figures are sourced from social media and other credible media outlets. Therefore:

- use Dizilah for discovery and cross-checking;
- preserve a link and fetch timestamp for every accepted field;
- prefer TİAK for public top-10 rating values;
- confirm cancellation/renewal with the broadcaster or production company before labeling it official;
- respect rate limits, robots directives, terms, and cache unchanged pages.

## Next implementation stages

- source-specific parsers and fixture tests;
- canonical alias resolver for Turkish/Persian titles;
- AI evidence-bundle recap generator;
- confidence scoring and quarantine queue;
- dynamic public pages backed by D1 instead of demo fixtures;
- notifications only for blocked or repeatedly degraded runs.
