// Collects Turkish entertainment news from RSS feeds, links every item to the series, actors and networks
// it mentions, drops sensitive topics, and (when AI_API_KEY is set) adds a Persian title + short summary.
// Output: github-pages/data/news.json. Zero dependencies (Node 22).
//   node automation/news-collect.mjs            → live run
//   node automation/news-collect.mjs --fixture=path.json   → read feed XML from a fixture map instead of the network
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const DATA = new URL("../github-pages/data/", import.meta.url);
const CONFIG = JSON.parse(await readFile(new URL("./news-sources.json", import.meta.url), "utf8"));
const series = JSON.parse(await readFile(new URL("series.json", DATA), "utf8"));
const people = JSON.parse(await readFile(new URL("people.json", DATA), "utf8"));
const networks = JSON.parse(await readFile(new URL("networks.json", DATA), "utf8"));
let previous = { items: [] };
try { previous = JSON.parse(await readFile(new URL("news.json", DATA), "utf8")); } catch { /* first run */ }

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const fixture = arg("fixture") ? JSON.parse(await readFile(arg("fixture"), "utf8")) : null;
const NOW = arg("now") ? new Date(arg("now")) : new Date();
const UA = "Mozilla/5.0 (compatible; MeshkiMediaNewsBot/1.0; +https://nimania.github.io/meshkimedia/)";

// ---- text helpers ----------------------------------------------------------
export const fold = (s) => String(s || "")
  .replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const decode = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const stripTags = (s) => decode(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};
const attr = (block, name, a) => {
  const m = block.match(new RegExp(`<${name}\\s[^>]*?${a}=["']([^"']+)["'][^>]*>`, "i"));
  return m ? decode(m[1]) : "";
};
export const canonicalUrl = (u) => {
  try {
    const x = new URL(decode(u).trim());
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) x.searchParams.delete(k);
    x.hash = "";
    return x.protocol === "https:" || x.protocol === "http:" ? x.toString().replace(/^http:/, "https:") : "";
  } catch { return ""; }
};
const httpsOnly = (u) => { const c = canonicalUrl(u); return c.startsWith("https://") ? c : ""; };

// ---- RSS / Atom parsing ----------------------------------------------------
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const html = decode(tag(b, "content:encoded") || tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    const link = decode(tag(b, "link")).trim() || attr(b, "link", "href") || decode(tag(b, "guid")).trim();
    const image = (() => {
      const enc = b.match(/<enclosure\s[^>]*>/i)?.[0] || "";
      const encUrl = /type=["']image/i.test(enc) || /\.(jpe?g|png|webp)/i.test(enc) ? attr(enc, "enclosure", "url") : "";
      return encUrl || attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "";
    })();
    const videoId = ((html + " " + b).match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/i) || [])[1] || "";
    return {
      title: stripTags(tag(b, "title")),
      link,
      published: tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"),
      snippet: stripTags(html).slice(0, 500),
      image,
      videoId,
    };
  }).filter((x) => x.title && x.link);
}

// ---- entity index ----------------------------------------------------------
const entities = [];
const addEntity = (kind, slug, text, needsContext = false) => {
  const f = fold(text);
  if (f.length < 3) return;
  entities.push({ kind, slug, f, re: new RegExp(`(^| )${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`), needsContext });
};
for (const s of Object.values(series)) {
  const full = s.titleTr || "";
  addEntity("series", s.slug, full, fold(full).split(" ").length === 1 && fold(full).length <= 8);
  const head = full.split(/[:–—-]/)[0].trim();
  if (head && head !== full) addEntity("series", s.slug, head, true);
  // "A.B.İ." folds to "a b i"; also match the plain slug word, but only in dizi context.
  if (!s.slug.includes("-") && fold(full) !== s.slug) addEntity("series", s.slug, s.slug, true);
}
for (const [slug, p] of Object.entries(people)) {
  if (p.name && fold(p.name).split(" ").length >= 2) addEntity("person", slug, p.name);
}
const EXPLICIT_NETWORKS = { "kanal-d": "kanal d", "show-tv": "show tv", "star-tv": "star tv", "trt-1": "trt 1" };
for (const [slug, text] of Object.entries(EXPLICIT_NETWORKS)) if (networks[slug]) addEntity("network", slug, text);

const contextRe = new RegExp(`(^| )(${CONFIG.requireContextWords.join("|")})( |$)`);
const blocklist = Object.entries(CONFIG.blocklist).filter(([k]) => !k.startsWith("_"))
  .flatMap(([reason, words]) => words.map((w) => ({ reason, re: new RegExp(`(^| )${w}`) })));
// "dizi" scope: no tracked series/actor is named, but the item is clearly about TV series.
const strongRe = /(^| )(dizi|dizisi|dizinin|dizide|fragman|fragmani|reyting|bolum|bolumu|yeni sezon|set)( |$)/;
const rumorRe = new RegExp(`(^| )(${CONFIG.rumorWords.join("|")})`);

export function link(item) {
  const text = fold(`${item.title} ${item.snippet}`);
  const titleText = fold(item.title);
  const found = { series: new Set(), people: new Set(), networks: new Set() };
  for (const e of entities) {
    if (!e.re.test(text)) continue;
    if (e.needsContext && !contextRe.test(text)) continue;
    // A series named by one common word must appear in the headline itself, not just the snippet.
    if (e.kind === "series" && e.needsContext && !e.re.test(titleText)) continue;
    found[e.kind === "person" ? "people" : e.kind === "series" ? "series" : "networks"].add(e.slug);
  }
  for (const slug of found.series) if (series[slug]?.network) found.networks.add(series[slug].network);
  return { series: [...found.series], people: [...found.people], networks: [...found.networks] };
}
export const sensitiveReason = (item) => {
  const text = fold(`${item.title} ${item.snippet}`);
  return blocklist.find((b) => b.re.test(text))?.reason || "";
};

// ---- fetching --------------------------------------------------------------
async function getText(url, { timeout = 25000, headers = {} } = {}) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*", ...headers }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const stats = { feeds: [], fetched: 0, unrelated: 0, sensitive: {}, added: 0, kept: 0, summarized: 0, aiDropped: 0 };
const known = new Map((previous.items || []).map((i) => [i.id, i]));
const fresh = [];

for (const feed of CONFIG.feeds) {
  try {
    const xml = fixture ? (fixture[feed.id] ?? (() => { throw new Error("no fixture"); })()) : await getText(feed.url);
    const items = parseFeed(xml);
    stats.feeds.push({ id: feed.id, ok: true, items: items.length });
    for (const raw of items) {
      stats.fetched++;
      const url = canonicalUrl(raw.link);
      if (!url) continue;
      const id = createHash("sha1").update(url).digest("hex").slice(0, 12);
      if (known.has(id) || fresh.some((f) => f.id === id)) continue;
      const published = new Date(raw.published);
      if (Number.isNaN(published.getTime())) continue;
      if (NOW - published > CONFIG.maxAgeDays * 864e5 || published - NOW > 864e5) continue;
      const entitiesFound = link(raw);
      const linked = entitiesFound.series.length || entitiesFound.people.length;
      const foldedAll = fold(`${raw.title} ${raw.snippet}`);
      // linked = names a series/actor of the site; dizi = about TV series in general; general = other entertainment news.
      const scope = linked ? "linked" : strongRe.test(foldedAll) ? "dizi" : feed.entertainment ? "general" : "";
      if (!scope) { stats.unrelated++; continue; }
      const reason = sensitiveReason(raw);
      if (reason) { stats.sensitive[reason] = (stats.sensitive[reason] || 0) + 1; continue; }
      const folded = fold(`${raw.title} ${raw.snippet}`);
      fresh.push({
        id, url, source: feed.id, sourceName: feed.name, lang: feed.lang,
        title: raw.title, snippet: raw.snippet,
        image: httpsOnly(raw.image), video: raw.videoId ? { provider: "youtube", id: raw.videoId } : null,
        published: published.toISOString(), scope,
        kind: feed.kind === "official" ? "official" : rumorRe.test(folded) ? "rumor" : "media",
        entities: entitiesFound,
      });
    }
  } catch (e) {
    stats.feeds.push({ id: feed.id, ok: false, error: String(e.message || e).slice(0, 120) });
  }
}
stats.added = fresh.length;

// ---- optional Gemini step: Persian title + summary + safety check ---------
const keys = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_AI = Number(process.env.NEWS_MAX_AI || 40);
let keyIndex = 0;
const nameFa = (kind, slug) => kind === "series" ? series[slug]?.titleFa : people[slug]?.nameFa;

async function summarize(item) {
  const glossary = [
    ...item.entities.series.map((s) => `${series[s]?.titleTr} = ${series[s]?.titleFa}`),
    ...item.entities.people.map((p) => `${people[p]?.name} = ${people[p]?.nameFa || ""}`),
  ].filter((x) => !x.endsWith("= ") && !x.includes("undefined")).join("\n");
  const prompt = `You prepare a Persian news card for a Turkish TV-series fan site. Use ONLY the title and snippet below; never add facts.
Return JSON: {"titleFa": string, "summaryFa": string, "kind": "official"|"media"|"rumor", "sensitive": boolean}
- titleFa: faithful Persian translation of the headline (keep it as neutral as the original; no clickbait added).
- summaryFa: at most two short Persian sentences from the snippet; "" if the snippet says nothing beyond the headline.
- kind: "official" if a network/company/person announces it themselves; "rumor" if it is an unconfirmed claim, gossip or speculation; otherwise "media".
- sensitive: true if it concerns a person's health, a crime or abuse allegation, a minor child, sexual matters, or a private tragedy.
Use these Persian names when the entity appears:
${glossary || "(none)"}
Title: ${item.title}
Snippet: ${item.snippet}`;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(keyIndex + attempt) % keys.length];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
    });
    if (res.status === 429 || res.status === 403) { keyIndex++; continue; }
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const out = await res.json();
    return JSON.parse(out.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  }
  throw new Error("all Gemini keys are rate-limited");
}

if (keys.length) {
  let budget = MAX_AI;
  const rank = { linked: 0, dizi: 1, general: 2 };
  const queue = [...fresh, ...[...known.values()].filter((i) => !i.ai && !i.aiFailed)]
    .sort((a, b) => (rank[a.scope] ?? 1) - (rank[b.scope] ?? 1) || b.published.localeCompare(a.published));
  for (const item of queue) {
    if (budget-- <= 0) break;
    try {
      const r = await summarize(item);
      if (r.sensitive === true) { item.drop = true; stats.aiDropped++; continue; }
      if (typeof r.titleFa === "string" && r.titleFa.trim()) item.titleFa = r.titleFa.trim().slice(0, 240);
      if (typeof r.summaryFa === "string" && r.summaryFa.trim()) item.summaryFa = r.summaryFa.trim().slice(0, 420);
      if (["official", "media", "rumor"].includes(r.kind) && !(item.kind === "official" && r.kind !== "official")) item.kind = r.kind;
      item.ai = true; stats.summarized++;
    } catch (e) {
      console.warn(`summary failed for ${item.id}: ${e.message}`);
      if (/rate-limited/.test(e.message)) break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ---- merge, prune, write ---------------------------------------------------
const ageDays = (i) => (NOW - new Date(i.published)) / 864e5;
let generalKept = 0;
const all = [...known.values(), ...fresh].filter((i) => !i.drop)
  .filter((i) => ageDays(i) <= (i.scope === "general" ? CONFIG.maxGeneralAgeDays : CONFIG.maxAgeDays))
  .sort((a, b) => b.published.localeCompare(a.published))
  .filter((i) => i.scope !== "general" || ++generalKept <= CONFIG.maxGeneralItems)
  .slice(0, CONFIG.maxItems);
// Keep only entity slugs that still exist (series or actors may be renamed or removed).
for (const i of all) {
  i.entities.series = i.entities.series.filter((s) => series[s]);
  i.entities.people = i.entities.people.filter((p) => people[p]);
  i.entities.networks = i.entities.networks.filter((n) => networks[n]);
}
stats.kept = all.length;
const body = JSON.stringify(all);
const oldBody = JSON.stringify(previous.items || []);
const out = { updated: body === oldBody ? previous.updated || NOW.toISOString() : NOW.toISOString(), items: all };
await writeFile(new URL("news.json", DATA), `${JSON.stringify(out, null, 1)}\n`, "utf8");

const okFeeds = stats.feeds.filter((f) => f.ok).length;
console.log(`News: ${okFeeds}/${stats.feeds.length} feeds ok; ${stats.fetched} items read, ${stats.added} new and relevant, ${stats.unrelated} unrelated, sensitive skipped ${JSON.stringify(stats.sensitive)}, summarized ${stats.summarized}${keys.length ? "" : " (no AI key: titles stay Turkish)"}, dropped by AI ${stats.aiDropped}, ${stats.kept} kept.`);
for (const f of stats.feeds.filter((x) => !x.ok)) console.log(`feed failed: ${f.id} — ${f.error}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### اخبار\n\n${okFeeds}/${stats.feeds.length} فید سالم؛ ${stats.added} خبر جدید مرتبط؛ ${stats.kept} خبر در بایگانی.\n${stats.feeds.filter((f) => !f.ok).map((f) => `- فید ناموفق: ${f.id} (${f.error})`).join("\n")}\n`);
}
