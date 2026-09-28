// List TİAK Top 10 programs that no series in series.json claims, so a popular
// show can never silently fall off the site. Report only: this never fails the build.
import { readFile, appendFile } from "node:fs/promises";

const data = (file) => readFile(new URL(`../github-pages/data/${file}.json`, import.meta.url), "utf8").then(JSON.parse);
const [ratings, series] = await Promise.all([data("ratings"), data("series")]);
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] || 14);

// "DAHA 17 (OZET)", "KURALSIZ SOKAKLAR OZET", "TUZLU KAHVE (TKR)", "ORTA DIREK SABAN (T.S)"
export const splitVariant = (program) => {
  const p = String(program || "").toUpperCase().trim();
  const m = p.match(/^(.*?)\s*\(?\s*(OZET|TKR|T\.S)\s*\)?$/);
  return m ? { base: m[1].trim(), variant: m[2] } : { base: p, variant: null };
};
// Kuralsız Sokaklar is a Kanal D documentary series; STADYUM is a sports show.
const NON_SERIES = /KURALSIZ SOKAKLAR|^STADYUM$|HABER|GUN ORTASI|GUNE BASLARKEN|MUGE ANLI|ESRA EROL|MASTERCHEF|GELINIM|EVLENECEK|YEMEKTEYIZ|KARSILASMASI|ACIKLAMA|MACA DOGRU|ULUSLAR LIGI|AVRUPA LIGI|SAMPIYONLAR LIGI/;

const known = new Set(Object.values(series).map((s) => (s.ratingKey || "").toUpperCase().trim()).filter(Boolean));
const found = new Map();
for (const day of (ratings.days || []).slice(0, DAYS)) {
  for (const [mode, rows] of Object.entries(day.categories || {})) {
    for (const row of rows || []) {
      const { base, variant } = splitVariant(row.program);
      if (known.has(base)) continue;
      const item = found.get(base) || { base, network: row.network, dates: new Set(), best: 99, film: false };
      if (variant === "T.S") item.film = true; // "Türk Sineması": a feature film, not a series
      item.dates.add(day.date);
      if (mode === "total") item.best = Math.min(item.best, row.rank);
      found.set(base, item);
    }
  }
}

const list = [...found.values()].sort((a, b) => b.dates.size - a.dates.size || a.best - b.best);
const isOther = (x) => x.film || NON_SERIES.test(x.base);
const likely = list.filter((x) => !isOther(x));
const other = list.filter(isOther);
const line = (x) => `| ${x.base} | ${x.network} | ${x.dates.size} | ${x.best < 99 ? x.best : "—"} |`;
const md = [
  "## برنامه‌های Top 10 که در سایت تعریف نشده‌اند",
  "",
  `بازه: ${DAYS} روز اخیر TİAK. برای نمایش ریتینگ یک سریال، آن را با \`ratingKey\` برابر ستون اول به \`series.json\` اضافه کنید.`,
  "",
  likely.length ? "### احتمالاً سریال" : "همهٔ سریال‌های Top 10 در سایت تعریف شده‌اند.",
  ...(likely.length ? ["", "| برنامه | شبکه | روزهای حضور | بهترین رتبهٔ Total |", "| --- | --- | --- | --- |", ...likely.map(line)] : []),
  "",
  `<details><summary>خبر، مسابقه، ورزش و برنامه‌های دیگر (${other.length})</summary>`,
  "",
  "| برنامه | شبکه | روزهای حضور | بهترین رتبهٔ Total |",
  "| --- | --- | --- | --- |",
  ...other.map(line),
  "",
  "</details>",
  "",
].join("\n");

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
if (likely.length) console.log(`::warning::${likely.length} Top 10 program(s) may be series missing from series.json: ${likely.map((x) => x.base).join(", ")}`);
