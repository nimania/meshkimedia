// Short actor biographies from Wikipedia (CC BY-SA 4.0), stored in github-pages/data/bios.json.
// Persian text comes from fa.wikipedia when a Persian article exists; otherwise it is machine-translated
// (only if AI_API_KEY is set) and labelled as such. Each entry keeps its source link and license.
//   node automation/news-bios.mjs [--limit=60] [--fixture=path.json]
import { readFile, writeFile } from "node:fs/promises";

const DATA = new URL("../github-pages/data/", import.meta.url);
const people = JSON.parse(await readFile(new URL("people.json", DATA), "utf8"));
let bios = {};
try { bios = JSON.parse(await readFile(new URL("bios.json", DATA), "utf8")); } catch { /* first run */ }

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const LIMIT = Number(arg("limit") || 60);
const fixture = arg("fixture") ? JSON.parse(await readFile(arg("fixture"), "utf8")) : null;
const REFRESH_DAYS = 90;
const UA = "MeshkiMediaBot/1.0 (https://nimania.github.io/meshkimedia/; nimania@gmail.com)";
const ACTOR_RE = /(oyuncu|aktör|aktris|tiyatrocu|sinema|manken|dizi|actor|actress|film|television|model)/i;

async function getJson(url) {
  if (fixture) { if (!(url in fixture)) throw new Error("HTTP 404"); return fixture[url]; }
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (res.status === 404) throw new Error("HTTP 404");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const wait = (ms) => (fixture ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

// A Wikipedia article is accepted only if its title carries the actor's surname and the start of the first name
// (guards against a different person with a similar name, e.g. "Sahra Şaş" vs "Sahra Asadollahi").
const fold = (s) => String(s || "").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase().replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
  .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const titleMatchesName = (title, name) => {
  const t = fold(title.replace(/\(.*?\)/g, "")).split(" ");
  const n = fold(name).split(" ");
  if (n.length < 2) return false;
  const last = n[n.length - 1];
  return t.includes(last) && t.some((w) => w.startsWith(n[0].slice(0, 3)));
};

const summaryUrl = (lang, title) => `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
const searchUrl = (lang, q) => `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=3&namespace=0&format=json`;
const langlinkUrl = (lang, title) => `https://${lang}.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=fa&titles=${encodeURIComponent(title)}&format=json&redirects=1`;

const clip = (text, max = 650) => {
  // Wikipedia summaries occasionally repeat a sentence; keep each one once.
  const sentences = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!؟۔])\s+/);
  const t = sentences.filter((s, i) => sentences.indexOf(s) === i).join(" ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("۔"), cut.lastIndexOf("؟ "));
  return (end > 200 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
};

async function findSummary(name) {
  for (const lang of ["tr", "en"]) {
    const titles = [name];
    try {
      const hits = await getJson(searchUrl(lang, name));
      for (const t of hits[1] || []) if (!titles.includes(t)) titles.push(t);
    } catch { /* search is only a fallback */ }
    for (const title of titles) {
      try {
        const s = await getJson(summaryUrl(lang, title));
        await wait(250);
        if (s.type !== "standard" || !s.extract) continue;
        if (titleMatchesName(s.title, name) && ACTOR_RE.test(`${s.description || ""} ${s.extract.slice(0, 300)}`)) return { lang, ...s };
      } catch { /* try next */ }
    }
  }
  return null;
}

async function persianFor(found) {
  try {
    const l = await getJson(langlinkUrl(found.lang, found.title));
    const page = Object.values(l.query?.pages || {})[0];
    const fa = page?.langlinks?.[0]?.["*"];
    if (fa) {
      const s = await getJson(summaryUrl("fa", fa));
      if (s.extract) return { text: clip(s.extract), source: { name: "ویکی‌پدیای فارسی", url: s.content_urls?.desktop?.page || `https://fa.wikipedia.org/wiki/${encodeURIComponent(fa)}`, license: "CC BY-SA 4.0" }, machine: false };
    }
  } catch { /* fall through to translation */ }
  return null;
}

const keys = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
async function translate(text, name, langName) {
  for (const key of keys) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ contents: [{ parts: [{ text: `Translate this short biography of the actor "${name}" from ${langName} to natural, neutral Persian. Translate only what is written; add nothing. Return only the Persian text.\n\n${text}` }] }], generationConfig: { temperature: 0.1 } }),
    });
    if (res.status === 429 || res.status === 403) continue;
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const out = await res.json();
    return (out.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  }
  return "";
}

for (const [slug, b] of Object.entries(bios)) {
  const url = b.source?.url;
  if (!url || b.manual || !people[slug]) continue;
  const title = decodeURIComponent(url.split("/wiki/")[1] || "").replace(/_/g, " ");
  if (title && !titleMatchesName(title, people[slug].name)) { delete bios[slug]; console.log(`dropped mismatched bio: ${slug} ≠ ${title}`); }
}

const due = Object.entries(people).filter(([slug]) => {
  const b = bios[slug];
  if (!b) return true;
  if (b.manual) return false;
  return (Date.now() - new Date(b.fetchedAt)) / 864e5 > (b.notFound ? 14 : REFRESH_DAYS);
}).slice(0, LIMIT);

let added = 0, missing = 0;
for (const [slug, p] of due) {
  try {
    const found = await findSummary(p.name);
    if (!found) { bios[slug] = { notFound: true, fetchedAt: new Date().toISOString() }; missing++; continue; }
    const original = clip(found.extract);
    const page = found.content_urls?.desktop?.page || `https://${found.lang}.wikipedia.org/wiki/${encodeURIComponent(found.title.replace(/ /g, "_"))}`;
    const entry = { lang: found.lang, text: original, source: { name: found.lang === "tr" ? "ویکی‌پدیای ترکی" : "ویکی‌پدیای انگلیسی", url: page, license: "CC BY-SA 4.0" }, fetchedAt: new Date().toISOString() };
    const fa = await persianFor(found);
    if (fa) entry.fa = fa;
    else if (keys.length) {
      const t = await translate(original, p.name, found.lang === "tr" ? "Turkish" : "English");
      if (t) entry.fa = { text: t, source: entry.source, machine: true };
    }
    bios[slug] = entry; added++;
  } catch (e) {
    console.warn(`bio failed for ${slug}: ${e.message}`);
  }
  await wait(300);
}

const sorted = Object.fromEntries(Object.entries(bios).filter(([slug]) => people[slug]).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL("bios.json", DATA), `${JSON.stringify(sorted, null, 1)}\n`, "utf8");
const have = Object.values(sorted).filter((b) => b.text).length;
console.log(`Bios: ${due.length} checked, ${added} added, ${missing} without a Wikipedia article; ${have}/${Object.keys(people).length} actors have a bio.`);
