// Independent health audit of the *published* Meshki Media data, not local repository
// files. Keeps functioning even when the main build/deploy workflow has stopped.
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const SITE = "https://nimania.github.io/meshkimedia/";
const DAY = 86_400_000;
const elapsedDays = (then, now) => {
  const a = new Date(then);
  return Number.isFinite(a.getTime()) ? (now.getTime() - a.getTime()) / DAY : Infinity;
};
const asUtcDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return NaN;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? d.getTime() : NaN;
};
const turkeyDay = (now) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);

function check(key, title, level, detail) {
  return { key, title, level, detail };
}
function freshness(now, time, warn, critical) {
  const age = elapsedDays(time, now);
  return !Number.isFinite(age) || age > critical ? "critical" : age > warn ? "warning" : "healthy";
}

// Pure health rules. No live fetching during tests, and no fabricated data.
export function assessLiveData({ news, ratings, calendar, home }, now = new Date()) {
  const checks = [];
  checks.push(check("site", "صفحهٔ اصلی", home === true ? "healthy" : "critical",
    home === true ? "صفحهٔ اصلی پاسخ موفق می‌دهد" : "صفحهٔ اصلی در دسترس نیست"));

  if (!news || !Array.isArray(news.items)) {
    checks.push(check("news", "اخبار", "critical", "فایل اخبار در دسترس نیست یا ساختار معتبری ندارد"));
  } else {
    const timestamps = news.items.map(item => Date.parse(item.published || "")).filter(Number.isFinite);
    const latest = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
    const level = latest ? freshness(now, latest, 2, 3) : "critical";
    checks.push(check("news", "اخبار", level,
      latest ? "تازه‌ترین خبر: " + latest : "هیچ خبر تاریخ‌دار معتبری موجود نیست"));
  }

  if (!ratings || !Array.isArray(ratings.days)) {
    checks.push(check("ratings", "ریتینگ TİAK", "critical", "فایل ریتینگ در دسترس نیست یا ساختار معتبری ندارد"));
  } else {
    const dates = ratings.days.map(d => {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(d.date || ""));
      return m ? asUtcDay(m[3] + "-" + m[2] + "-" + m[1]) : NaN;
    }).filter(Number.isFinite);
    const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null;
    // Official TİAK tables may be delayed over weekends; avoid aggressive alarms.
    const age = newest ? (asUtcDay(turkeyDay(now)) - asUtcDay(newest)) / DAY : Infinity;
    checks.push(check("ratings", "ریتینگ TİAK",
      age > 5 ? "critical" : age > 3 ? "warning" : "healthy",
      newest ? "آخرین نتیجهٔ رسمی: " + newest : "نتیجهٔ تاریخ‌دار معتبری یافت نشد"));
  }

  if (!calendar || !calendar.source || !calendar.days || typeof calendar.days !== "object") {
    checks.push(check("calendar", "تقویم پخش", "critical", "فایل تقویم در دسترس نیست یا ساختار معتبری ندارد"));
  } else {
    const today = turkeyDay(now);
    const end = Object.keys(calendar.days).filter(d => Number.isFinite(asUtcDay(d))).sort().at(-1);
    const daysAhead = end ? (asUtcDay(end) - asUtcDay(today)) / DAY : -Infinity;
    const checked = calendar.source.checkedAt;
    const age = Number.isFinite(asUtcDay(checked)) ? (asUtcDay(today) - asUtcDay(checked)) / DAY : Infinity;
    const level = daysAhead < 0 || age > 4 ? "critical"
      : daysAhead < 3 || age > 2 ? "warning" : "healthy";
    checks.push(check("calendar", "تقویم پخش", level,
      "آخرین برنامه: " + (end || "نامشخص") + "؛ آخرین بررسی منبع: " + (checked || "نامشخص")));
  }

  return {
    checkedAt: now.toISOString(),
    status: checks.some(x => x.level === "critical") ? "critical"
      : checks.some(x => x.level === "warning") ? "warning" : "healthy",
    checks,
    site: SITE,
  };
}

async function get(path, json = true) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(SITE + path + "?monitor=" + Date.now(), {
        headers: { accept: json ? "application/json" : "text/html" },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return json ? await response.json() : true;
    } catch (e) {
      error = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  console.error("Health monitor: " + path + ": " + error.message);
  return json ? null : false;
}

async function main() {
  const [home, news, ratings, calendar] = await Promise.all([
    get("", false), get("data/news.json"), get("data/ratings.json"),
    get("data/calendar.json"),
  ]);
  const report = assessLiveData({ home, news, ratings, calendar });
  const reportPath = process.env.HEALTH_REPORT_PATH;
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  const symbols = { healthy: "✅", warning: "⚠️", critical: "❌" };
  const markdown = [
    "## Meshki Media — published data health",
    "",
    "Checked (UTC): " + report.checkedAt,
    "",
    "| Component | Status | Observation |",
    "|---|---|---|",
    ...report.checks.map(c => "| " + c.title + " | " + symbols[c.level] + " " + c.level
      + " | " + c.detail.replaceAll("|", "/") + " |"),
    "",
    "Status: **" + report.status + "**. Monitoring public GitHub Pages, independently of deployment.",
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (report.status === "critical") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(err => { console.error("Uncaught health-check failure", err); process.exitCode = 1; });
