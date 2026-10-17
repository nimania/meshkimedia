# Independent health monitoring

Workflow: https://github.com/nimania/meshkimedia/actions/workflows/health-monitor.yml

Runs every four hours (GitHub cron may start late) and on manual dispatch. Monitors the
published GitHub Pages origin independently of the main pages.yml collector.
This catches situations where collectors, site deployment, or an external feed fails
but the normal workflow remains green.

Sources checked:
- Home: must return HTTP 2xx.
- data/news.json: latest dated story less than 48h old (warning after 48h,
  critical after 72h); a large archive with no new stories does not count as healthy.
- data/ratings.json: latest verified TIAK report at most 3 calendar days old
  (warning after 3, critical after 5). Longer grace period for weekend delays.
- data/calendar.json: verified broadcasts must extend at least 3 days ahead;
  a calendar that has completely ended is critical. The source check date must
  be at most 2 days old (warning after 2, critical after 4).

Failed fetches are retried up to three times; malformed JSON is critical. A report
is shown under each workflow run's Summary. For warning/critical problems, an
issue named [Monitor] Meshki Media data freshness is assigned to the repository
owner, providing a normal GitHub notification (delivery depends on settings).
The same issue is reopened on future incidents and updated only when the failing
components/severity change, preventing repeated alerts.
It is automatically closed after recovery.

No Telegram tokens, AI keys, or external monitoring accounts are required.
Thresholds are operational heuristics.
To test: node --test automation/test-health-check.mjs
To run locally: node automation/health-check.mjs
To see results: Actions > Monitor Meshki Media > Run workflow.
