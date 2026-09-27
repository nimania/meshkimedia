// Find possible new episode pages on official broadcaster episode listings.
// Candidates are evidence for an editor, never automatically published episodes.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SERIES_URL = new URL("../github-pages/data/series.json", import.meta.url);
const USER_AGENT = "MeshkiMedia/1.0 (+https://nimania.github.io/meshkimedia/)";
const fold = (s) => s.toLocaleLowerCase("tr")
  .replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g")
  .replaceAll("ü", "u").replaceAll("ö", "o").replaceAll("ç", "c")
  .replace(/[^a-z0-9]/g, "");

export function candidateLinks(html, listingUrl, slug) {
  const listing = new URL(listingUrl);
  const found = new Map();
  const anchor = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    let url;
    try { url = new URL(match[1].replaceAll("&amp;", "&"), listing); } catch { continue; }
    if (url.protocol !== "https:" || url.hostname !== listing.hostname) continue;
    let path;
    try { path = decodeURIComponent(url.pathname).toLocaleLowerCase("tr"); } catch { continue; }
    if (!fold(path).includes(fold(slug))) continue;
    if (/(fragman|ozet|ön-izleme|on-izleme|foto|galeri|haber|tanitim|tanıtım)/i.test(path)) continue;
    const number = path.match(/(?:^|[-/])(\d+)[.-]?bolum(?:\/|$)/i)?.[1]
      || path.match(/\/bolum\/(\d+)(?:\/|$)/i)?.[1]
      || path.match(/-bolum-(\d+)-izle(?:\/|$)/i)?.[1]
      // Kanal D uses a moving "son-bolum" URL for its latest episode.
      // Its label gives the number, but the link must be reviewed before use.
      || (/\/bolumler\/[^/]*son-bolum\/?$/.test(path)
        && fold(match[2].replace(/<[^>]*>/g, " ")).includes(fold(slug))
        ? match[2].replace(/<[^>]*>/g, " ").match(/(\d+)[.\s]*bölüm/i)?.[1]
        : null);
    if (!number || Number(number) < 1) continue;
    url.hash = "";
    url.search = "";
    if (url.href === listing.href) continue;
    found.set(url.href, { number: Number(number), url: url.href });
  }
  return [...found.values()].sort((a, b) => b.number - a.number || a.url.localeCompare(b.url));
}

async function fetchListingOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" }, signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.retryable = response.status >= 500;
      throw error;
    }
    if (!(response.headers.get("content-type") || "").includes("text/html")) throw new Error("non-HTML listing");
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("listing too large");
    return body;
  } finally { clearTimeout(timer); }
}

async function fetchListing(url) {
  try { return await fetchListingOnce(url); }
  catch (error) {
    if (!error.retryable && error.name !== "AbortError" && !/fetch failed/i.test(error.message)) throw error;
    return fetchListingOnce(url);
  }
}

export async function discover(data, fetchPage = fetchListing) {
  const results = [];
  for (const [slug, show] of Object.entries(data)) {
    if (show.kind === "entertainment" || show.status !== "در حال پخش") continue;
    const listing = show.official?.episodes;
    if (!/^https:\/\//.test(listing || "")) {
      results.push({ slug, title: show.titleFa, listing: listing || "", error: "no official episode listing" });
      continue;
    }
    try {
      const website = new URL(show.official?.website || listing);
      const listUrl = new URL(listing);
      if (listUrl.pathname === "/" || listUrl.hostname !== website.hostname) throw new Error("listing URL needs verification");
      const links = candidateLinks(await fetchPage(listing), listing, slug);
      const known = new Set((show.seasons || []).flatMap((s) => s.episodes || []).map((ep) => ep.number));
      const candidates = links.filter((item) => !known.has(item.number));
      results.push({ slug, title: show.titleFa, listing, discovered: links.length, candidates });
    } catch (error) {
      results.push({ slug, title: show.titleFa, listing, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export function reportMarkdown(results, at = new Date().toISOString()) {
  const rows = results.flatMap((r) => r.error
    ? [`| ${r.title} | خطا: ${r.error.replaceAll("|", "\\|")} | ${r.listing ? `[فهرست](${r.listing})` : "—"} |`]
    : r.candidates.length
      ? r.candidates.map((item) => `| ${r.title} | قسمت ${item.number} (نیازمند تأیید) | [صفحهٔ رسمی](${item.url}) |`)
      : [`| ${r.title} | مورد تازه‌ای در فهرست پیدا نشد | [فهرست](${r.listing}) |`]);
  return `# کشف قسمت‌ها — ${at}\n\n| سریال | وضعیت | مدرک |\n|---|---|---|\n${rows.join("\n")}\n\n` +
    "این لینک‌ها نامزد بررسی هستند. تاریخ پخش، محتوای قسمت و عکس‌ها باید از صفحهٔ رسمی تأیید شوند. دریافت ناموفق هرگز دادهٔ قبلی سایت را حذف نمی‌کند.\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const series = JSON.parse(await readFile(SERIES_URL, "utf8"));
  const results = await discover(series);
  const at = new Date().toISOString();
  const report = reportMarkdown(results, at);
  const out = process.argv.indexOf("--output");
  if (out >= 0) {
    const path = process.argv[out + 1];
    if (!path) throw new Error("--output requires a path");
    await writeFile(path, report, "utf8");
    await writeFile(path.replace(/\.md$/, ".json"), `${JSON.stringify({ at, results }, null, 2)}\n`, "utf8");
  } else process.stdout.write(report);
}
