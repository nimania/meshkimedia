// Refreshes github-pages/data/ratings.json from TİAK's public daily table.
// New model: a rolling window of the last N days, each with Total / AB / ABC1
// categories. TİAK's public homepage exposes only the Total table with real
// Rating % numbers; AB and ABC1 rankings come from official daily announcements
// and are preserved across runs (numbers stay null until a member-data source
// is wired in). This script never invents numbers.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE_URL = "https://tiak.com.tr/";
const OUTPUT_URL = new URL("../github-pages/data/ratings.json", import.meta.url);
// Keep roughly a season of observations for episode trends. The daily table UI
// still shows only the ten newest available days.
const WINDOW_DAYS = 120;

const DEFAULTS = {
  metric: "Rating %",
  windowDays: WINDOW_DAYS,
  source: { name: "TİAK", url: SOURCE_URL },
  categories: {
    total: { key: "total", label: "Total", labelFa: "کل (۵+)", audience: "5+ Yaş Tüm Kişiler" },
    ab: { key: "ab", label: "AB", labelFa: "AB", audience: "AB" },
    abc1: { key: "abc1", label: "ABC1", labelFa: "ABC1 (۲۰+)", audience: "ABC1 20+" },
  },
};

// Fold Turkish letters to ASCII uppercase so program names match series ratingKeys.
function foldUpper(value) {
  return value
    .replace(/İ/g, "I").replace(/I/g, "I").replace(/ı/g, "I")
    .replace(/Ş/g, "S").replace(/ş/g, "S")
    .replace(/Ğ/g, "G").replace(/ğ/g, "G")
    .replace(/Ü/g, "U").replace(/ü/g, "U")
    .replace(/Ö/g, "O").replace(/ö/g, "O")
    .replace(/Ç/g, "C").replace(/ç/g, "C")
    .toUpperCase();
}

function clean(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTiakTotal(html) {
  const section = html.match(/<div class="anatablolar">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="altalan">/)?.[1] ?? html;
  const date = section.match(/<div class="tablobaslik">\s*([^<]+?)\s*<\/div>/)?.[1]?.trim();
  const rows = [];
  const pattern = /<div class="item">[\s\S]*?<span class="yazi">\s*([\d.,]+)\s*<\/span>[\s\S]*?<div class="kanal">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="program">\s*([\s\S]*?)\s*<\/div>/g;
  for (const match of section.matchAll(pattern)) {
    rows.push({
      rank: rows.length + 1,
      program: foldUpper(clean(match[3])),
      network: foldUpper(clean(match[2])),
      rating: Number(match[1].replace(",", ".")),
    });
    if (rows.length === 10) break;
  }
  if (!date || rows.length < 5 || rows.some((r) => !Number.isFinite(r.rating))) {
    throw new Error("TİAK page shape changed; refusing to publish incomplete data.");
  }
  return { date, rows };
}

const dateKey = (d) => { const [dd, mm, yy] = d.split("."); return Number(`${yy}${mm}${dd}`); };

async function loadExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_URL, "utf8"));
  } catch {
    return { ...DEFAULTS, days: [] };
  }
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 25_000);
try {
  const response = await fetch(SOURCE_URL, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "MeshkiMedia/1.0 (+https://nimania.github.io/meshkimedia/)" },
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`TİAK returned HTTP ${response.status}`);
  const { date, rows } = parseTiakTotal(await response.text());

  const existing = await loadExisting();
  const out = {
    updatedAt: new Date().toISOString(),
    metric: existing.metric || DEFAULTS.metric,
    windowDays: WINDOW_DAYS,
    source: existing.source || DEFAULTS.source,
    categories: existing.categories || DEFAULTS.categories,
    days: Array.isArray(existing.days) ? existing.days.slice() : [],
  };

  const idx = out.days.findIndex((d) => d.date === date);
  if (idx >= 0) {
    // Refresh Total for an existing day, keep any AB/ABC1 already collected.
    out.days[idx].categories = out.days[idx].categories || {};
    out.days[idx].categories.total = rows;
    out.days[idx].hasNumbers = { ...(out.days[idx].hasNumbers || {}), total: true };
  } else {
    out.days.unshift({
      date,
      weekday: "",
      hasNumbers: { total: true, ab: false, abc1: false },
      categories: { total: rows, ab: [], abc1: [] },
    });
  }

  out.days.sort((a, b) => dateKey(b.date) - dateKey(a.date));
  out.days = out.days.slice(0, out.windowDays);

  await mkdir(new URL("../github-pages/data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_URL, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Published TİAK Total for ${date}; window now holds ${out.days.length} day(s).`);
} catch (error) {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_URL, "utf8"));
    const last = previous.days && previous.days[0] ? previous.days[0].date : "n/a";
    console.error(`Refresh failed; keeping existing window (latest ${last}): ${error instanceof Error ? error.message : error}`);
  } catch {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
