// Posts each NEW Meshki Media news story (that has a Persian page) to the Telegram channel:
// hero photo + bold Persian title + short summary + related hashtags + a link back to the site.
// State lives in github-pages/data/telegram-posted.json so nothing is posted twice; the GitHub
// Action commits that file back to main like it does news.json.
//
// Config (GitHub Actions repository secrets):
//   TELEGRAM_BOT_TOKEN  — token from @BotFather; the bot must be an ADMIN of the channel.
//   TELEGRAM_CHAT       — channel username like @meshkimedia, or a numeric -100… chat id.
//   TELEGRAM_MAX        — optional safety ceiling per run (default 30); a normal hour has far fewer.
// With no token/chat set the script simply does nothing (like the site build with no AI key).
//
//   node automation/news-telegram.mjs            → live run
//   node automation/news-telegram.mjs --dry-run  → print what would be posted, send nothing
import { readFile, writeFile } from "node:fs/promises";

const DATA = new URL("../github-pages/data/", import.meta.url);
const STATE = new URL("telegram-posted.json", DATA);
const BASE = "https://nimania.github.io/meshkimedia";
const DRY = process.argv.includes("--dry-run");

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const CHAT = (process.env.TELEGRAM_CHAT || "@themeshkimedia").trim();
const MAX = Number(process.env.TELEGRAM_MAX || 30);
const GAP_MS = Number(process.env.TELEGRAM_GAP_MS || 3500); // ~17 posts/min: safely under Telegram's channel limit

if ((!TOKEN || !CHAT) && !DRY) {
  console.log("Telegram: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT not set — skipping (news still publishes to the site).");
  process.exit(0);
}

const news = JSON.parse(await readFile(new URL("news.json", DATA), "utf8"));
const series = JSON.parse(await readFile(new URL("series.json", DATA), "utf8"));
const people = JSON.parse(await readFile(new URL("people.json", DATA), "utf8"));

let state = null;
try { state = JSON.parse(await readFile(STATE, "utf8")); } catch { /* first run */ }

// A story is eligible once it has its own Persian page (title + body) and a real source link.
const eligible = (news.items || []).filter(
  (i) => i.titleFa && Array.isArray(i.bodyFa) && i.bodyFa.length && /^https:\/\//.test(i.url || ""),
);

// FIRST RUN (no state file): seed silently so the existing archive is NOT blasted to the channel.
if (!state || !Array.isArray(state.posted)) {
  const seed = { posted: eligible.map((i) => i.id).slice(-2000), updated: new Date().toISOString(), seeded: true };
  if (!DRY) await writeFile(STATE, `${JSON.stringify(seed, null, 1)}\n`, "utf8");
  console.log(`Telegram: first run — seeded ${seed.posted.length} existing stories as already-posted; sent 0 messages. New stories will be posted from the next run.`);
  process.exit(0);
}

const posted = new Set(state.posted);
const fresh = eligible
  .filter((i) => !posted.has(i.id))
  .sort((a, b) => (a.published || "").localeCompare(b.published || ""))
  .slice(0, MAX);

if (!fresh.length) { console.log("Telegram: no new stories to post."); process.exit(0); }

// ---- caption -------------------------------------------------------------
const KIND = { official: "🟢 خبر رسمی", media: "📰 خبر رسانه‌ها", rumor: "🟠 شایعه / تأییدنشده" };
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hashtag = (name) => {
  const t = String(name || "").trim().replace(/[()«».,،؛:!?"'\-–—/\\]+/g, " ").replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
  return t && /[\p{L}\p{N}]/u.test(t) ? `#${t}` : "";
};
function caption(item) {
  const url = `${BASE}/haber/${item.id}/`;
  const kind = KIND[item.kind] || KIND.media;
  const title = esc(item.titleFa.trim());
  let summary = esc((item.summaryFa || item.bodyFa[0] || "").trim());
  const tags = [
    ...(item.entities?.series || []).map((s) => hashtag(series[s]?.titleFa)),
    ...(item.entities?.people || []).map((p) => hashtag(people[p]?.nameFa)),
  ].filter(Boolean).slice(0, 4);
  const tagLine = [...new Set(tags)].join(" ");
  // Keep the whole caption under Telegram's 1024-char limit; trim the summary if needed.
  const fixed = `${kind}\n\n<b>${title}</b>\n\n\n${tagLine ? tagLine + "\n\n" : ""}🔗 <a href="${url}">ادامه در مشکی مدیا</a>`;
  const room = 1000 - fixed.length;
  if (summary.length > room && room > 40) summary = summary.slice(0, room - 1).trim() + "…";
  else if (room <= 40) summary = "";
  return `${kind}\n\n<b>${title}</b>\n\n${summary}\n\n${tagLine ? tagLine + "\n\n" : ""}🔗 <a href="${url}">ادامه در مشکی مدیا</a>`;
}

// ---- Telegram API --------------------------------------------------------
async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok, status: res.status, body };
}

// Try a photo post first; if Telegram cannot fetch the image, fall back to a text post
// (the linked Meshki Media page carries its own preview image, so it still looks good).
async function post(item) {
  const cap = caption(item);
  const photo = item.image || (Array.isArray(item.images) && item.images[0]) || "";
  if (photo) {
    const r = await tg("sendPhoto", { chat_id: CHAT, photo, caption: cap, parse_mode: "HTML" });
    if (r.ok) return { ok: true, mode: "photo" };
    if (r.body?.parameters?.retry_after) return { ok: false, retry: r.body.parameters.retry_after };
    // fall through to text on an image-fetch failure (400 with a "wrong file identifier/HTTP url" message)
  }
  const r = await tg("sendMessage", { chat_id: CHAT, text: cap, parse_mode: "HTML", disable_web_page_preview: false });
  if (r.ok) return { ok: true, mode: "text" };
  if (r.body?.parameters?.retry_after) return { ok: false, retry: r.body.parameters.retry_after };
  return { ok: false, error: `${r.status} ${JSON.stringify(r.body?.description || r.body).slice(0, 160)}` };
}

const save = async () => { if (!DRY) await writeFile(STATE, `${JSON.stringify({ posted: state.posted.slice(-2000), updated: new Date().toISOString() }, null, 1)}\n`, "utf8"); };

let sent = 0, failed = 0;
for (let idx = 0; idx < fresh.length; idx++) {
  const item = fresh[idx];
  if (DRY) { console.log(`\n— would post [${item.kind}] ${item.id} —\n${caption(item)}\n(photo: ${item.image || "none"})`); state.posted.push(item.id); continue; }
  let r = await post(item);
  if (!r.ok && r.retry) { // rate-limited: wait once, then retry
    console.log(`Telegram: rate-limited, waiting ${r.retry}s…`);
    await new Promise((s) => setTimeout(s, (r.retry + 1) * 1000));
    r = await post(item);
  }
  if (r.ok) {
    sent++; state.posted.push(item.id); await save();
    console.log(`Telegram: posted ${item.id} (${r.mode}) — ${item.titleFa.slice(0, 60)}`);
  } else {
    failed++;
    console.warn(`Telegram: failed ${item.id} — ${r.error || "unknown"} (will retry next run)`);
    if (r.error && /^40[13]/.test(r.error)) break; // bad token or bot not admin: stop, fix config
  }
  if (idx < fresh.length - 1) await new Promise((s) => setTimeout(s, GAP_MS));
}
if (DRY) console.log(`\nTelegram dry-run: ${fresh.length} stories would be posted.`);
else { await save(); console.log(`Telegram: ${sent} posted, ${failed} failed, ${eligible.length - state.posted.length} not yet on the channel.`); }
