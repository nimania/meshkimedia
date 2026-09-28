// Publish reviewed Instagram numbers separately from the official TİAK tables.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const input = JSON.parse(await readFile(new URL("automation/reviewed-social-ratings.json", root), "utf8"));
const series = JSON.parse(await readFile(new URL("github-pages/data/series.json", root), "utf8"));
const dates = new Set();
const entries = [];
for (const entry of input.entries || []) {
  const show = series[entry.slug];
  if (!show?.ratingKey || !/^\d{2}\.\d{2}\.\d{4}$/.test(entry.date || "") ||
      !Number.isInteger(entry.season) || entry.season < 1 || !Number.isInteger(entry.episode) || entry.episode < 1 ||
      entry.source?.name !== "Dizilah" || !/^https:\/\/www\.instagram\.com\/p\/[\w-]+\/$/.test(entry.source?.url || "")) {
    throw new Error(`Invalid reviewed Instagram entry: ${entry.slug || "unknown"}`);
  }
  const date = entry.date.split(".").reverse().join("-");
  if (new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`Invalid rating date: ${entry.date}`);
  const key = `${entry.date}:${entry.slug}`;
  if (dates.has(key)) throw new Error(`Duplicate reviewed rating: ${key}`);
  dates.add(key);
  const categories = {};
  for (const mode of ["total", "ab", "abc1"]) {
    const row = entry.categories?.[mode];
    if (!row || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > 100 ||
        !Number.isFinite(row.rating) || row.rating <= 0 || row.rating > 40 ||
        !Number.isFinite(row.share) || row.share <= 0 || row.share > 100) {
      throw new Error(`Invalid ${mode} numbers in ${key}`);
    }
    categories[mode] = { rank: row.rank, rating: row.rating, share: row.share };
  }
  entries.push({ date: entry.date, slug: entry.slug, program: show.ratingKey, network: show.network,
    season: entry.season, episode: entry.episode, categories, source: entry.source });
}
await writeFile(new URL("github-pages/data/social-ratings.json", root), `${JSON.stringify({ entries }, null, 2)}\n`);
console.log(`Published ${entries.length} reviewed Dizilah rating entries as a separate supplement.`);
