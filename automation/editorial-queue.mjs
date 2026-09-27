// Daily editorial checklist from the content actually published in series.json.
// It reports gaps and review candidates; it never infers or fabricates episodes.
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../github-pages/data/series.json", import.meta.url), "utf8"));
const outputArg = process.argv.indexOf("--output");
const asOfArg = process.argv.indexOf("--as-of");
const asOf = asOfArg >= 0 ? process.argv[asOfArg + 1] : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) {
  throw new Error("--as-of requires a valid YYYY-MM-DD date");
}
const daysSince = (date) => Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
const text = (value) => String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
const link = (label, url) => /^https:\/\//.test(url || "") ? `[${text(label)}](${url})` : "—";
const profileRows = [];
const episodeRows = [];
const reviewRows = [];
const archiveRows = [];
const castRows = [];
let totalEpisodes = 0;
let completeEpisodes = 0;
let completeProfiles = 0;

for (const [slug, show] of Object.entries(data)) {
  const missing = [];
  if (!show.synopsis?.trim()) missing.push("داستان");
  if (!show.synopsisSource && show.synopsis?.trim()) missing.push("منبع داستان");
  if (!show.hero) missing.push("کاور");
  if (!(show.photos || []).length) missing.push("گالری سریال");
  if ((show.photos || []).length && !show.photosSource) missing.push("منبع گالری");
  if (missing.length) {
    profileRows.push(`| ${text(show.titleFa || slug)} | ${missing.join("، ")} | ${link("صفحهٔ رسمی", show.official?.website)} |`);
  } else completeProfiles++;
  if (show.kind !== "entertainment" && !(show.cast || []).length) {
    castRows.push(`| ${text(show.titleFa || slug)} | بازیگران و نقش‌ها | ${link("منبع رسمی", show.official?.website)} |`);
  }

  const episodes = (show.seasons || []).flatMap((season) => season.episodes || []);
  for (const ep of episodes) {
    totalEpisodes++;
    const missingEp = [];
    if (!ep.summary?.trim()) missingEp.push("خلاصه");
    if (!ep.source) missingEp.push("منبع قسمت");
    if (!(ep.images || []).length) missingEp.push("عکس‌ها");
    if ((ep.images || []).length && !ep.photosSource) missingEp.push("منبع عکس‌ها");
    if (!ep.watchUrl && !show.official?.episodes) missingEp.push("لینک قسمت‌ها");
    if (missingEp.length) {
      episodeRows.push(`| ${text(show.titleFa || slug)} | ${ep.number} | ${text(ep.date || "—")} | ${missingEp.join("، ")} | ${link("قسمت", ep.source || show.official?.episodes)} |`);
    } else completeEpisodes++;
  }

  // A weekly show without a recent recorded episode may need discovery.
  // This is a review prompt, never a claim that a new episode has aired.
  const aired = episodes.filter((ep) => ep.date && daysSince(ep.date) >= 0).sort((a, b) => b.date.localeCompare(a.date));
  if (show.status === "در حال پخش" && show.kind !== "entertainment" && (!aired.length || daysSince(aired[0].date) >= 7)) {
    const row = `| ${text(show.titleFa || slug)} | ${text(aired[0]?.date || "—")} | ${aired.length ? daysSince(aired[0].date) : "—"} | ${link("فهرست رسمی قسمت‌ها", show.official?.episodes)} |`;
    (aired.length && daysSince(aired[0].date) >= 30 ? archiveRows : reviewRows).push(row);
  }
}

const section = (headers, rows) => rows.length ? [headers, headers.replace(/[^|]/g, "-").replace(/-+/g, "---"), ...rows].join("\n") : "موردی نیست.";
const report = `# صف تحریریهٔ مشکی مدیا — ${asOf}\n\n` +
  `پروفایل کامل: ${completeProfiles}/${Object.keys(data).length} · قسمت کامل: ${completeEpisodes}/${totalEpisodes}\n\n` +
  `## اطلاعات ناقص سریال‌ها\n\n${section("| سریال | کمبود | مرجع |", profileRows)}\n\n` +
  `## بازیگران و نقش‌های ثبت‌نشده\n\n${section("| سریال | کمبود | مرجع |", castRows)}\n\n` +
  `## اطلاعات ناقص قسمت‌های ثبت‌شده\n\n${section("| سریال | قسمت | تاریخ | کمبود | مرجع |", episodeRows)}\n\n` +
  `## بررسی انتشار قسمت تازه\n\n${section("| سریال | آخرین قسمت ثبت‌شده | روزهای گذشته | مرجع |", reviewRows)}\n\n` +
  `## عقب‌ماندگی آرشیو (۳۰ روز یا بیشتر)\n\n${section("| سریال | آخرین قسمت ثبت‌شده | روزهای گذشته | مرجع |", archiveRows)}\n\n` +
  `این گزارش فقط داده‌های موجود را می‌سنجد. برای پیدا کردن قسمت تازه باید فهرست رسمی شبکه بررسی شود؛ تریلر یا برنامهٔ پخش، تأیید پخش قسمت نیست.\n`;

if (outputArg >= 0) {
  if (!process.argv[outputArg + 1]) throw new Error("--output requires a path");
  await writeFile(process.argv[outputArg + 1], report, "utf8");
} else process.stdout.write(report);
