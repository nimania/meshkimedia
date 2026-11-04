# Private series Telegram destinations

The user supplied a private invite for «سریال شربت زغال‌اخته» on 2026-11-04 and requested the existing per-series publishing service. The Telegram landing page confirmed that exact title. The invite itself is deliberately absent from this public repository and site.

## Current setup

`kizilcik-serbeti` is configured for the existing 09:00 / 12:00 / 15:00 / 18:00 / 21:00 Tehran slots, related series news, editorial excerpts, actors, verified ratings, and recurring polls/quizzes. It cannot send until an authenticated destination binding exists. No YouTube handle has been guessed.

The user needs to add the same publishing bot used for the other series as a channel administrator with **Post Messages** permission. The connection check prints the bot's public username, never its token. After adding the bot, the user posts the supplied private invite URL as a single message in that same channel and tells the assistant it is ready. The bot receives that message; the invite fingerprint and title must match, and the channel creator must match the creator of the user's existing `@ehtemalaneshgheh` channel. A matching title alone is insufficient. Owner identifiers are compared only in memory and are never logged or saved. The verification message can be removed by the owner after connection succeeds.

Run **Verify private series Telegram connection** (`private-series-setup.yml`). It checks the bot identity, preserves any existing webhook, reads up to 100 unacknowledged updates without advancing the offset or changing update subscriptions, verifies the channel and posting permission, and saves the destination before publication can begin. It never prints unrelated messages, user IDs, private chat IDs, or invite URLs. If a webhook exists, no updates are polled and no webhook is disabled. An ambiguous, missing, or unauthorized destination stays disconnected.

## Private data and publishing

- `telegram-destination.mjs` separates the API delivery address from a public invite link.
- Private chat IDs are sealed with AES-256-GCM, a random nonce, a key derived from the existing bot secret using HKDF, and the series slug as authenticated context. Only encrypted bindings go into `automation/telegram-private-destinations.json`; the token and invite URL are never stored there.
- Rotating the bot secret requires reconnecting the private destination. Decryption/identity failures stop posting.
- The private invite is not added to website buttons, message footers, public receipts, or logs. Publishing an invitation on the public website requires a separate user decision.
- Existing public channel addresses and links remain supported. A numeric API address must never be turned into a `t.me/-100...` link.
- Both the regular content publisher and the ratings publisher resolve the same binding. Each retains its independent series ledger and initial archive seeding to prevent bulk backposting.
- `--series=kizilcik-serbeti` limits a diagnostic run of either publisher to this series; `--dry-run` never sends.

Offline checks: `node automation/test-telegram-destination.mjs`, `node automation/test-series-ratings-telegram.mjs`, `node automation/test-series-engagement.mjs`.

This change connects the publishing service; it does not claim a complete or newly reviewed recap archive for every episode of the long-running series.
