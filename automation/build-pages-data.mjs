// Refresh all three public TİAK daily Top 10 tables. Never infer unpublished results.
import { readFile, writeFile } from "node:fs/promises";
import { parseDailyTable, parseLatestDate } from "./tiak-daily.mjs";

const SOURCE_URL = "https://tiak.com.tr/";
const TABLE_URL = "https://tiak.com.tr/icerik/cek.php";
const OUTPUT_URL = new URL("../github-pages/data/ratings.json", import.meta.url);
const WINDOW_DAYS = 120;
const MODES = { total: "Top10 5+", ab: "Top10 SES AB", abc1: "Top10 20+ABC1" };
const repairExisting = process.argv.includes("--repair-existing");
const backfillDays = Number(process.argv.find((arg) => arg.startsWith("--backfill-days="))?.split("=")[1] || 30);
if (!Number.isInteger(backfillDays) || backfillDays < 1 || backfillDays > WINDOW_DAYS) {
  throw new Error("--backfill-days must be between 1 and 120");
}
const dateKey = (d) => { const [dd, mm, yy] = d.split("."); return Number(`${yy}${mm}${dd}`); };
const toRequestDate = (d) => { const [dd, mm, yy] = d.split("."); return `${Number(mm)}.${Number(dd)}.${yy}`; };

async function getLatestDate() {
  const response = await fetch(SOURCE_URL, {
    headers: { accept: "text/html", "user-agent": "MeshkiMedia/1.0 (+https://nimania.github.io/meshkimedia/)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`TİAK home HTTP ${response.status}`);
  return parseLatestDate(await response.text());
}

async function getTable(date, mode) {
  const requestDate = toRequestDate(date);
  const body = new URLSearchParams({ nere: "tablo", tarih: requestDate, lang: "tr", url: "http://tiak.com.tr/", dosya: MODES[mode] });
  const response = await fetch(TABLE_URL, {
    method: "POST", body,
    headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded",
      referer: "https://tiak.com.tr/tablolar", "user-agent": "MeshkiMedia/1.0 (+https://nimania.github.io/meshkimedia/)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`TİAK ${mode} HTTP ${response.status}`);
  const html = await response.text();
  if (html.trim() === requestDate) throw new Error(`TİAK has no ${mode} report for ${date}`);
  return parseDailyTable(html);
}

async function getDay(date) {
  // All three modes must pass validation before replacing a day's record.
  const pairs = await Promise.all(Object.keys(MODES).map(async (mode) => [mode, await getTable(date, mode)]));
  return { date, weekday: "", hasNumbers: { total: true, ab: true, abc1: true }, categories: Object.fromEntries(pairs) };
}

try {
  const existing = JSON.parse(await readFile(OUTPUT_URL, "utf8"));
  const latest = await getLatestDate();
  const days = Array.isArray(existing.days) ? existing.days.slice() : [];
  const targets = [latest];
  // Backfill missing calendar dates, not only partial records already present.
  // Never ask TİAK for dates newer than its latest published report.
  const nowInTehran = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, date] = nowInTehran.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, date));
  const missing = [];
  for (let offset = 0; offset < backfillDays; offset++) {
    const current = new Date(start.getTime() - offset * 86400000);
    const day = `${String(current.getUTCDate()).padStart(2, "0")}.${String(current.getUTCMonth() + 1).padStart(2, "0")}.${current.getUTCFullYear()}`;
    if (dateKey(day) > dateKey(latest) || day === latest) continue;
    const found = days.find((item) => item.date === day);
    if (!found || !["total", "ab", "abc1"].every((mode) => found.hasNumbers?.[mode])) missing.push(day);
  }
  // Normal scheduled runs repair two dates at a time; an explicit repair scans the full month.
  targets.push(...(repairExisting ? missing : missing.slice(0, 2)));

  let changed = 0;
  for (const date of targets) {
    try {
      const day = await getDay(date);
      const index = days.findIndex((d) => d.date === date);
      if (index >= 0) days[index] = day;
      else days.push(day);
      changed++;
    } catch (error) {
      if (date === latest) throw error;
      console.warn(`Skipping historical ${date}: ${error.message}`);
    }
  }
  days.sort((a, b) => dateKey(b.date) - dateKey(a.date));
  const out = { ...existing, updatedAt: new Date().toISOString(), windowDays: WINDOW_DAYS,
    source: { name: "TİAK", url: "https://tiak.com.tr/tablolar" }, days: days.slice(0, WINDOW_DAYS) };
  await writeFile(OUTPUT_URL, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`TİAK report ${latest}: validated ${changed} day(s) in Total, AB and ABC1; ${missing.length} dates needed backfill.`);
} catch (error) {
  console.error(`Ratings refresh failed; keeping the previous data: ${error.message}`);
  process.exitCode = 1;
}
