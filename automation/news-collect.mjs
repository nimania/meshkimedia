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
// Unwrap CDATA first: a "<![CDATA[Title]]>" would otherwise be swallowed by the tag stripper.
const unCdata = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
const stripTags = (s) => decode(unCdata(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
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

// ---- media extraction (gallery images, videos, social embeds) ---------------
// Junk we never want in a gallery: logos, icons, avatars, share buttons, ads, tracking pixels.
const IMG_JUNK = /(sprite|logo|avatar|icon|placeholder|blank|1x1|pixel|spacer|default|no-?image|noimage|share|whatsapp|facebook|twitter|telegram|instagram|advert|banner|adsystem|doubleclick|gravatar|emoji|flag)/i;
const isRealImage = (u) => /^https:\/\//i.test(u) && !IMG_JUNK.test(u) &&
  (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) || /\/(uploads?|media|images?|photo|foto|resim|haber|content)\//i.test(u));
// Collapse the same photo served at different sizes (…-640x360.jpg, ?w=800, …) into one.
const imgKey = (u) => u.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}(?:$|\?))/i, "")
  .replace(/([?&])(w|h|width|height|size|quality|q|resize|fit|crop)=[^&]*/gi, "$1").replace(/[?&]+/g, (m) => m[0]).replace(/[?&]+$/, "");
export const dedupeImages = (arr, cap = 6) => {
  const seen = new Set(); const out = [];
  for (const raw of arr) { const u = httpsOnly(raw); if (!u || !isRealImage(u)) continue; const k = imgKey(u); if (seen.has(k)) continue; seen.add(k); out.push(u); if (out.length >= cap) break; }
  return out;
};
const dedupeVideos = (arr, cap = 4) => {
  const seen = new Set(); const out = [];
  for (const v of arr) { if (!v || !v.provider) continue; const k = `${v.provider}:${v.id || httpsOnly(v.url)}`; if (k.endsWith(":") || seen.has(k)) continue; seen.add(k); out.push(v.id ? { provider: v.provider, id: v.id } : { provider: v.provider, url: httpsOnly(v.url) }); if (out.length >= cap) break; }
  return out;
};
const dedupeEmbeds = (arr, cap = 4) => {
  const seen = new Set(); const out = [];
  for (const e of arr) { if (!e) continue; const u = httpsOnly(e.url); if (!u) continue; const k = u.split("?")[0]; if (seen.has(k)) continue; seen.add(k); out.push({ provider: e.provider, url: u }); if (out.length >= cap) break; }
  return out;
};
export function extractImages(html) {
  const imgs = [];
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]*>/gi)) { const u = (m[0].match(/content=["']([^"']+)["']/i) || [])[1]; if (u) imgs.push(decode(u)); }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const src = (t.match(/\b(?:data-src|data-original|data-lazy-src|data-lazy|src)=["']([^"']+)["']/i) || [])[1]
      || ((t.match(/\bsrcset=["']([^"']+)["']/i) || [])[1] || "").split(",").pop()?.trim().split(/\s+/)[0];
    if (src) imgs.push(decode(src));
  }
  return imgs;
}
export function extractVideos(html) {
  const out = [];
  for (const m of html.matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/gi)) out.push({ provider: "youtube", id: m[1] });
  for (const m of html.matchAll(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d{6,})/gi)) out.push({ provider: "vimeo", id: m[1] });
  for (const m of html.matchAll(/dailymotion\.com\/(?:embed\/video|video)\/([a-z0-9]+)/gi)) out.push({ provider: "dailymotion", id: m[1] });
  return out;
}
export function extractEmbeds(html) {
  const out = [];
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+\/?/gi)) out.push({ provider: "instagram", url: m[0] });
  for (const m of html.matchAll(/https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,20}\/status\/\d+/gi)) out.push({ provider: "x", url: m[0].replace(/^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com/i, "https://x.com") });
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/gi)) out.push({ provider: "tiktok", url: m[0] });
  return out;
}
export const extractMedia = (html) => ({ images: extractImages(html), videos: extractVideos(html), embeds: extractEmbeds(html) });
// Merge scraped media from an article's sources into the story item (kept small; only non-empty arrays stay).
function attachMedia(item, fetched) {
  const images = dedupeImages([item.image, ...(item.images || []), ...fetched.flatMap((f) => f.media.images)]);
  const videos = dedupeVideos([item.video, ...(item.videos || []), ...fetched.flatMap((f) => f.media.videos)]);
  const embeds = dedupeEmbeds([...(item.embeds || []), ...fetched.flatMap((f) => f.media.embeds)]);
  if (images.length) { item.images = images; if (!item.image) item.image = images[0]; } else delete item.images;
  if (videos.length) item.videos = videos; else delete item.videos;
  if (embeds.length) item.embeds = embeds; else delete item.embeds;
  item.mediaDone = true;
}

// ---- RSS / Atom parsing ----------------------------------------------------
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const html = decode(tag(b, "content:encoded") || tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    // <link>…</link>, Atom <link href>, or (Milliyet) only <atom:link href>; a guid counts only if it is a URL.
    const guid = decode(tag(b, "guid")).trim();
    const link = decode(tag(b, "link")).trim() || attr(b, "link", "href") || attr(b, "atom:link", "href") || (/^https?:\/\//.test(guid) ? guid : "");
    const image = (() => {
      const enc = b.match(/<enclosure\s[^>]*>/i)?.[0] || "";
      const encUrl = /type=["']image/i.test(enc) || /\.(jpe?g|png|webp)/i.test(enc) ? attr(enc, "enclosure", "url") : "";
      return encUrl || attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "";
    })();
    const videoId = ((html + " " + b).match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/i) || [])[1] || "";
    return {
      title: stripTags(tag(b, "title")),
      link,
      // Some feeds write the "+" of the time zone as an entity (&#x2B;0300).
      published: decode(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date")).replace(/\s+/g, " ").trim(),
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
// Ids of articles already folded into another story: never collect them again.
const merged = new Set((previous.items || []).flatMap((i) => i.mergedIds || []));
const fresh = [];

for (const feed of CONFIG.feeds) {
  try {
    const xml = fixture ? (fixture[feed.id] ?? (() => { throw new Error("no fixture"); })()) : await getText(feed.url);
    const items = parseFeed(xml);
    const entry = { id: feed.id, ok: true, items: items.length, kept: 0, dated: 0 };
    if (!items.length) entry.head = xml.replace(/\s+/g, " ").slice(0, 140);
    stats.feeds.push(entry);
    for (const raw of items) {
      stats.fetched++;
      const url = canonicalUrl(raw.link);
      if (!url) continue;
      const id = createHash("sha1").update(url).digest("hex").slice(0, 12);
      if (known.has(id) || merged.has(id) || fresh.some((f) => f.id === id)) continue;
      const published = new Date(raw.published);
      if (Number.isNaN(published.getTime())) { entry.badDate = (entry.badDate || 0) + 1; continue; }
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
      entry.kept++;
      fresh.push({
        id, url, source: feed.id, sourceName: feed.name, lang: feed.lang,
        title: raw.title, snippet: raw.snippet,
        image: httpsOnly(raw.image), video: raw.videoId ? { provider: "youtube", id: raw.videoId } : null,
        published: published.toISOString(), scope,
        kind: feed.kind === "official" ? "official" : rumorRe.test(folded) ? "rumor" : "media",
        entities: entitiesFound,
        sources: [{ source: feed.id, name: feed.name, url, title: raw.title, snippet: raw.snippet.slice(0, 300), published: published.toISOString() }],
      });
    }
  } catch (e) {
    stats.feeds.push({ id: feed.id, ok: false, error: String(e.message || e).slice(0, 120) });
  }
}
stats.added = fresh.length;

// ---- merge duplicate stories from different outlets -------------------------
const STOP = new Set(["ile", "icin", "olarak", "gibi", "kadar", "sonra", "once", "daha", "cok", "yeni", "son", "dizi", "dizisi", "the", "and", "for", "with", "from", "that", "this", "oldu", "olan", "haber"]);
const toks = (t) => new Set(fold(t).split(" ").filter((w) => w.length >= 4 && !STOP.has(w)));
export function sameStory(a, b) {
  if (a.sources.some((s) => b.sources.some((t) => t.source === s.source))) return false; // one article per outlet
  if (Math.abs(new Date(a.published) - new Date(b.published)) > 72 * 36e5) return false;
  const ta = toks(a.title), tb = new Set([...b.sources.flatMap((s) => [...toks(s.title)])]);
  const shared = [...ta].filter((w) => tb.has(w)).length;
  const jac = shared / (new Set([...ta, ...tb]).size || 1);
  const ent = ["series", "people"].reduce((n, k) => n + (a.entities[k] || []).filter((x) => (b.entities[k] || []).includes(x)).length, 0);
  return jac >= 0.4 || (ent >= 1 && shared >= 2 && jac >= 0.2);
}
const RANK = { linked: 0, dizi: 1, general: 2 };
const pool = [];
for (const item of [...known.values(), ...fresh].sort((a, b) => a.published.localeCompare(b.published))) {
  if (!item.sources) item.sources = [{ source: item.source, name: item.sourceName, url: item.url, title: item.title, snippet: (item.snippet || "").slice(0, 300), published: item.published }];
  // A story that already has its own page absorbs newcomers; two old pages are never merged (permalinks stay valid).
  const target = pool.find((p) => p.sources.length < 6 && (fresh.includes(item) || (!p.bodyFa && !item.bodyFa)) && sameStory(p, item));
  if (!target) { pool.push(item); continue; }
  target.sources.push(...item.sources);
  target.mergedIds = [...new Set([...(target.mergedIds || []), item.id, ...(item.mergedIds || [])])].slice(-60);
  for (const k of ["series", "people", "networks"]) target.entities[k] = [...new Set([...(target.entities[k] || []), ...(item.entities[k] || [])])];
  if (!target.image && item.image) target.image = item.image;
  if (!target.video && item.video) target.video = item.video;
  if ((RANK[item.scope] ?? 1) < (RANK[target.scope] ?? 1)) target.scope = item.scope;
  if (item.kind === "official") target.kind = "official";
  if (target.bodyFa || target.titleFa) target.regen = true; // new sources: rewrite the Persian story
  stats.merged = (stats.merged || 0) + 1;
}

// ---- optional Gemini step: Persian title + summary + safety check ---------
const keys = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
const PRIMARY = process.env.GEMINI_MODEL || "gemini-3.8-flash";
let models = null;
// Models the key can actually use, best guess first: the configured one, then every "flash" text model the API lists (newest first).
async function modelList() {
  if (models) return models;
  const found = [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${keys[0]}`, { signal: AbortSignal.timeout(20000) });
    if (res.ok) for (const m of (await res.json()).models || []) {
      const n = String(m.name || "").replace(/^models\//, "");
      if ((m.supportedGenerationMethods || []).includes("generateContent") && /flash/.test(n) && !/image|tts|live|audio|thinking|exp|embedding|robotics|computer/.test(n)) found.push(n);
    }
  } catch { /* fall back to the fixed names below */ }
  const ver = (n) => Number((n.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]);
  found.sort((a, b) => ver(b) - ver(a) || a.length - b.length);
  models = [...new Set([PRIMARY, ...found.slice(0, 5), "gemini-flash-latest"])];
  stats.models = models.join(", ");
  return models;
}
const MAX_AI = Number(process.env.NEWS_MAX_AI || 40);
let keyIndex = 0;
const nameFa = (kind, slug) => kind === "series" ? series[slug]?.titleFa : people[slug]?.nameFa;

// Fetches an article once: the opening text (source material for the model's summary, never stored) plus
// its gallery images, videos and social-post links (these ARE stored and shown on the story page).
const EMPTY_MEDIA = { images: [], videos: [], embeds: [] };
async function fetchArticle(url) {
  try {
    const html = await getText(url, { timeout: 15000, headers: { accept: "text/html" } });
    const metaRe = /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*>/i;
    const tagm = html.match(metaRe)?.[0] || "";
    const desc = decode((tagm.match(/content=["']([^"']+)["']/i) || [])[1] || "");
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1])).filter((p) => p.length > 70);
    return { text: `${desc}\n${paras.join("\n")}`.slice(0, 2600), media: extractMedia(html) };
  } catch { return { text: "", media: EMPTY_MEDIA }; }
}

async function summarize(item, openings) {
  const srcs = item.sources.slice(0, 4);
  const glossary = [
    ...item.entities.series.map((s) => `${series[s]?.titleTr} = ${series[s]?.titleFa}`),
    ...item.entities.people.map((p) => `${people[p]?.name} = ${people[p]?.nameFa || ""}`),
  ].filter((x) => !x.endsWith("= ") && !x.includes("undefined")).join("\n");
  const material = srcs.map((x, i) => `--- s${i + 1}: ${x.name} ---\nTitle: ${x.title}\nSnippet: ${x.snippet}\nArticle opening (may contain page boilerplate):\n${(openings[i] || "").slice(0, 1600) || "(unavailable)"}`).join("\n\n");
  const multi = srcs.length > 1;
  const prompt = `You prepare Persian news pages for a Turkish TV-series fan site. The material below is ${multi ? `${srcs.length} reports from different outlets about the SAME story` : "one report"}. Use ONLY this material; never add facts, dates, quotes or names that are not in it.
Return JSON: {"titleFa": string, "summaryFa": string, "bodyFa": string[], "kind": "official"|"media"|"rumor", "sensitive": boolean, "sourceTitles": string[], "comparison": {"agree": string[], "differ": [{"topic": string, "views": [{"source": "s1", "text": string}]}], "unconfirmed": string[]}}
- titleFa: faithful, neutral Persian headline for the story (no clickbait added). ALWAYS Persian.
- summaryFa: at most two short Persian sentences; "" if the material says nothing beyond the headline.
- bodyFa: 2 to 4 short Persian paragraphs (about 120-260 words in total) explaining what the news is, who is involved and what is known, in your own words as a reader-friendly explainer${multi ? ", combining what the outlets report" : ""}. Do NOT translate sentence by sentence or copy wording. Say clearly when something is a claim or unconfirmed. If the material has little content, write one or two sentences only. Ignore website boilerplate.
- kind: "official" if a network/company/person announces it themselves; "rumor" if it is an unconfirmed claim, gossip or speculation; otherwise "media".
- sensitive: true if it concerns a person's health, a crime or abuse allegation, a minor child, sexual matters, or a private tragedy.
- sourceTitles: one faithful Persian translation of each source's headline, in the order s1, s2, ...
- comparison: ${multi ? `agree = facts every outlet states; differ = points where outlets give different details (name the outlet with its s-number and what it says, e.g. different numbers, dates, wording of a claim; empty list if none); unconfirmed = claims made by only one outlet or presented as rumor. Short Persian sentences; empty lists when nothing fits.` : `use {"agree": [], "differ": [], "unconfirmed": []}.`}
Use these Persian names when the entity appears:
${glossary || "(none)"}

${material}`;
  const list = await modelList();
  let last = "no model tried";
  for (let attempt = 0; attempt < Math.min(list.length * Math.max(keys.length, 1), 8); attempt++) {
    const model = list[attempt % list.length];
    const key = keys[(keyIndex + Math.floor(attempt / list.length)) % keys.length];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
    });
    if (!res.ok) {
      last = `${model}: HTTP ${res.status} ${(await res.text()).replace(/\s+/g, " ").replace(/key=[\w-]+/g, "key=…").slice(0, 140)}`;
      stats.modelStatus = stats.modelStatus || {}; stats.modelStatus[`${model} ${res.status}`] = (stats.modelStatus[`${model} ${res.status}`] || 0) + 1;
      if (res.status === 503 || res.status === 500) await new Promise((r) => setTimeout(r, 2000));
      continue; // overloaded, retired or out of quota: try the next model
    }
    const out = await res.json();
    const raw = out.candidates?.[0]?.content?.parts?.[0]?.text || "";
    try { return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw new Error(`Gemini returned no JSON (${out.promptFeedback?.blockReason || out.candidates?.[0]?.finishReason || "empty"}): ${raw.slice(0, 80)}`); }
  }
  throw new Error(`Gemini unavailable — ${last}`);
}

const txt = (v, n) => String(v || "").trim().slice(0, n);
const list = (v, n, m) => (Array.isArray(v) ? v.map((x) => txt(x, m)).filter(Boolean).slice(0, n) : []);
export function cleanComparison(c, sources) {
  if (!c || sources.length < 2) return null;
  const idOf = (tag) => { const m = /^s(\d+)$/i.exec(String(tag || "").trim()); return m && sources[Number(m[1]) - 1]?.source; };
  const differ = (Array.isArray(c.differ) ? c.differ : []).map((d) => ({
    topic: txt(d?.topic, 160),
    views: (Array.isArray(d?.views) ? d.views : []).map((v) => ({ source: idOf(v?.source), text: txt(v?.text, 320) })).filter((v) => v.source && v.text).slice(0, 4),
  })).filter((d) => d.topic && d.views.length >= 1).slice(0, 4);
  const out = { agree: list(c.agree, 5, 320), differ, unconfirmed: list(c.unconfirmed, 4, 320) };
  return out.agree.length || out.differ.length || out.unconfirmed.length ? out : null;
}

if (keys.length) {
  let budget = MAX_AI, failStreak = 0;
  const queue = pool.filter((i) => (!i.bodyFa && !i.aiFailed) || i.regen)
    .sort((a, b) => (RANK[a.scope] ?? 1) - (RANK[b.scope] ?? 1) || b.published.localeCompare(a.published));
  for (const item of queue) {
    if (budget-- <= 0) break;
    // Fetch each source's article once, harvest its media, then reuse the text for the AI summary.
    const fetched = await Promise.all(item.sources.slice(0, 4).map((x) => fetchArticle(x.url)));
    attachMedia(item, fetched); // media persists even if the AI step below fails
    try {
      const r = await summarize(item, fetched.map((f) => f.text));
      if (r.sensitive === true) { item.drop = true; stats.aiDropped++; continue; }
      if (txt(r.titleFa, 1)) item.titleFa = txt(r.titleFa, 240);
      if (txt(r.summaryFa, 1)) item.summaryFa = txt(r.summaryFa, 420); else delete item.summaryFa;
      if (Array.isArray(r.bodyFa)) {
        const body = r.bodyFa.map((p) => txt(p, 800)).filter(Boolean).slice(0, 4);
        if (body.length) item.bodyFa = body;
      }
      if (Array.isArray(r.sourceTitles)) r.sourceTitles.slice(0, 4).forEach((t, i) => { if (txt(t, 1) && item.sources[i]) item.sources[i].titleFa = txt(t, 240); });
      const cmp = cleanComparison(r.comparison, item.sources.slice(0, 4));
      if (cmp) item.comparison = cmp; else delete item.comparison;
      if (["official", "media", "rumor"].includes(r.kind) && !(item.kind === "official" && r.kind !== "official")) item.kind = r.kind;
      item.ai = true; delete item.regen; stats.summarized++; failStreak = 0;
      item.aiTries = (item.aiTries || 0) + 1;
      if (!item.bodyFa && item.aiTries >= 2) item.aiFailed = true; // do not retry a page the model cannot write
    } catch (e) {
      console.warn(`summary failed for ${item.id}: ${e.message}`);
      stats.aiErrors = stats.aiErrors || []; if (stats.aiErrors.length < 3) stats.aiErrors.push(String(e.message).slice(0, 260));
      if (/rate-limited/.test(e.message) || ++failStreak >= 3) break; // give up this run; the next one continues
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ---- media backfill: fill gallery/video/embeds on existing pages that predate this feature -----
// Runs with or without an AI key; capped per run so an hourly build stays fast, so old pages fill in gradually.
if (!fixture) {
  let mediaBudget = Number(process.env.NEWS_MAX_MEDIA || 25);
  const need = pool.filter((i) => i.bodyFa && !i.mediaDone && !i.drop)
    .sort((a, b) => b.published.localeCompare(a.published));
  for (const item of need) {
    if (mediaBudget-- <= 0) break;
    const fetched = await Promise.all(item.sources.slice(0, 3).map((x) => fetchArticle(x.url)));
    attachMedia(item, fetched);
    if (item.images || item.videos || item.embeds) stats.mediaFilled = (stats.mediaFilled || 0) + 1;
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ---- merge, prune, write ---------------------------------------------------
const ageDays = (i) => (NOW - new Date(i.published)) / 864e5;
let generalKept = 0;
const all = pool.filter((i) => !i.drop)
  // Items with their own Persian page live longer, so permalinks do not vanish after a month and a half.
  .filter((i) => ageDays(i) <= (i.scope === "general" ? CONFIG.maxGeneralAgeDays : i.bodyFa ? CONFIG.maxPageAgeDays : CONFIG.maxAgeDays))
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
console.log(`News: ${okFeeds}/${stats.feeds.length} feeds ok; ${stats.fetched} items read, ${stats.added} new and relevant (${stats.merged || 0} merged into existing stories), ${stats.unrelated} unrelated, sensitive skipped ${JSON.stringify(stats.sensitive)}, summarized ${stats.summarized}${keys.length ? "" : " (no AI key: titles stay Turkish)"}, dropped by AI ${stats.aiDropped}, ${stats.kept} kept.`);
for (const f of stats.feeds.filter((x) => !x.ok)) console.log(`feed failed: ${f.id} — ${f.error}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const perFeed = stats.feeds.map((f) => f.ok ? `- ${f.id}: ${f.items} خبر خوانده شد، ${f.kept} خبر تازه نگه داشته شد${f.badDate ? `، ${f.badDate} خبر با تاریخ نامعتبر` : ""}${f.head ? ` — پاسخ خالی؛ آغاز پاسخ: \`${f.head.replace(/[`|]/g, "'")}\`` : ""}` : `- فید ناموفق: ${f.id} (${f.error})`).join("\n");
  const aiLine = !keys.length ? "کلید هوش مصنوعی به این اجرا نرسید (AI_API_KEY خالی است)" : `ترجمهٔ فارسی: ${stats.summarized} خبر ساخته شد، ${stats.aiDropped} خبر حساس حذف شد، ${stats.merged || 0} خبر تکراری ادغام شد${stats.models ? `\n\nمدل‌ها: ${stats.models}` : ""}${stats.modelStatus ? `\n\nپاسخ‌های ناموفق: ${JSON.stringify(stats.modelStatus)}` : ""}${stats.aiErrors?.length ? `\n\nخطاهای Gemini:\n${stats.aiErrors.map((x) => `- \`${x.replace(/[`|]/g, "'")}\``).join("\n")}` : ""}`;
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### اخبار\n\n${aiLine}\n\n${okFeeds}/${stats.feeds.length} فید سالم؛ ${stats.added} خبر جدید مرتبط؛ ${stats.kept} خبر در بایگانی؛ ${stats.unrelated} خبر نامرتبط؛ حساس: ${JSON.stringify(stats.sensitive)}.\n\n${perFeed}\n`);
}
