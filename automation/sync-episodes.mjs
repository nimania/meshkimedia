// Keep every broadcast from the Dizilah calendar in series.json, using the
// series' own continuous episode number (the "N. Bölüm" the networks use).
//
// The calendar numbers episodes inside a season (S3E3) and only covers about two
// weeks, so without this step an episode — and its rating — disappears from the
// site once its date leaves the calendar window.
//
// Each season in series.json declares `firstEpisode`: the continuous number of its
// first episode (Uzak Şehir S3 → 64, so S3E3 → 66). Seasons without it are skipped
// and reported, never guessed. Editorial data always wins: an existing episode is
// never renumbered or re-dated here.
import { readFile, writeFile } from "node:fs/promises";

const SERIES_URL = new URL("../github-pages/data/series.json", import.meta.url);
const CALENDAR_URL = new URL("../github-pages/data/calendar.json", import.meta.url);
const raw = await readFile(SERIES_URL, "utf8");
const series = JSON.parse(raw);
const calendar = JSON.parse(await readFile(CALENDAR_URL, "utf8"));
const today = process.env.SYNC_TODAY || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());

const days = Object.keys(calendar.days || {}).sort();
const [calStart, calEnd] = [days[0], days[days.length - 1]];
const notes = [];
let added = 0, aired = 0, dropped = 0;

for (const date of days) {
  for (const entry of calendar.days[date] || []) {
    const show = series[entry.slug];
    const inSeason = Number(entry.episode);
    if (!show || !Number.isInteger(inSeason) || inSeason < 1) continue;
    const season = (show.seasons || []).find((s) => Number(s.number) === Number(entry.season));
    if (!season || !Number.isInteger(season.firstEpisode)) {
      notes.push(`${entry.slug} S${entry.season}E${inSeason} (${date}): season has no firstEpisode — skipped`);
      continue;
    }
    const number = season.firstEpisode + inSeason - 1;
    const all = (show.seasons || []).flatMap((s) => s.episodes || []);
    const same = all.find((ep) => ep.number === number);
    if (same) {
      if (!same.date) { same.date = date; added++; }
      else if (same.date !== date) notes.push(`${entry.slug} ${number}: calendar says ${date}, series.json says ${same.date} — kept series.json`);
      continue;
    }
    const clash = all.find((ep) => ep.date === date);
    if (clash) { notes.push(`${entry.slug} ${date}: calendar episode ${number} but series.json has ${clash.number} — kept series.json`); continue; }
    season.episodes = season.episodes || [];
    // Evening broadcasts: an episode dated today is still planned until tomorrow.
    // `calendar: true` marks an auto-added broadcast (no recap yet); editors may remove it.
    season.episodes.push(date >= today ? { number, date, calendar: true, scheduled: true } : { number, date, calendar: true });
    added++;
  }
}

for (const show of Object.values(series)) {
  for (const season of show.seasons || []) {
    const before = (season.episodes || []).length;
    season.episodes = (season.episodes || []).filter((ep) => {
      if (!ep.scheduled) return true;
      // A planned episode the calendar no longer lists (postponed or removed).
      const listed = (calendar.days?.[ep.date] || []).some((e) => e.slug === show.slug &&
        Number(season.firstEpisode) + Number(e.episode) - 1 === ep.number && Number(e.season) === Number(season.number));
      return listed || ep.date < calStart || ep.date > calEnd || ep.summary;
    });
    dropped += before - season.episodes.length;
    for (const ep of season.episodes) if (ep.scheduled && ep.date < today) { delete ep.scheduled; aired++; }
    season.episodes.sort((a, b) => a.number - b.number);
  }
}

const out = `${JSON.stringify(series, null, 2)}\n`;
if (out !== raw) await writeFile(SERIES_URL, out, "utf8");
console.log(`Episodes synced from calendar ${calStart}…${calEnd} (today ${today}): ${added} added, ${aired} now aired, ${dropped} removed from plan.`);
for (const note of notes) console.log(`note: ${note}`);
