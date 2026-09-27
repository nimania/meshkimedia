// Report coverage and reject malformed editorial records before publishing.
import { readFile } from "node:fs/promises";

const series = JSON.parse(await readFile(new URL("../github-pages/data/series.json", import.meta.url), "utf8"));
const required = process.argv.flatMap((arg, i, args) => arg === "--require" ? [args[i + 1]] : []).filter(Boolean);
const issues = [];
const coverage = [];
const isHttps = (url) => typeof url === "string" && /^https:\/\/[^/]+/.test(url);

for (const [slug, show] of Object.entries(series)) {
  const episodes = (show.seasons || []).flatMap((season) => season.episodes || []);
  const seen = new Set();
  for (const ep of episodes) {
    if (!Number.isInteger(ep.number) || ep.number < 1 || seen.has(ep.number)) issues.push(`${slug}: invalid or duplicate episode number ${ep.number}`);
    seen.add(ep.number);
    if (ep.date && !/^\d{4}-\d{2}-\d{2}$/.test(ep.date)) issues.push(`${slug} episode ${ep.number}: invalid ISO date`);
    if (ep.summary && !isHttps(ep.source)) issues.push(`${slug} episode ${ep.number}: summary needs a source URL`);
    if (ep.watchUrl && !isHttps(ep.watchUrl)) issues.push(`${slug} episode ${ep.number}: invalid watch URL`);
    if (ep.fragman && !isHttps(ep.fragman)) issues.push(`${slug} episode ${ep.number}: invalid trailer URL`);
    if ((ep.images || []).length > 1 && !isHttps(ep.photosSource)) issues.push(`${slug} episode ${ep.number}: gallery needs a source URL`);
    for (const url of [ep.image, ...(ep.images || [])].filter(Boolean)) if (!isHttps(url)) issues.push(`${slug} episode ${ep.number}: invalid image URL`);
  }
  if ((show.photos || []).length && !isHttps(show.photosSource)) issues.push(`${slug}: series gallery needs a source URL`);
  if (!show.hero || !show.synopsis?.trim()) issues.push(`${slug}: series cover and synopsis are required`);
  if (show.synopsis && !isHttps(show.synopsisSource)) issues.push(`${slug}: synopsis needs a source URL`);
  if (show.heroSource && !isHttps(show.heroSource)) issues.push(`${slug}: cover needs a valid source URL`);
  if (show.fragman && !isHttps(show.fragman)) issues.push(`${slug}: invalid trailer URL`);
  if (required.includes(slug) && show.synopsis && !isHttps(show.synopsisSource)) issues.push(`${slug}: synopsis needs a source URL`);
  for (const url of [show.hero, ...(show.photos || [])].filter(Boolean)) if (!isHttps(url)) issues.push(`${slug}: invalid image URL`);
  const row = {
    slug,
    story: !!show.synopsis?.trim(),
    cover: !!show.hero,
    photos: (show.photos || []).length,
    episodes: episodes.length,
    recaps: episodes.filter((ep) => ep.summary?.trim()).length,
    galleries: episodes.filter((ep) => (ep.images || []).length > 1).length,
  };
  coverage.push(row);
  if (required.includes(slug) && (!row.story || !row.cover || !row.photos || row.recaps !== row.episodes || row.galleries !== row.episodes)) {
    issues.push(`${slug}: required series/episode content is incomplete`);
  }
}
for (const slug of required) if (!series[slug]) issues.push(`unknown required series: ${slug}`);
console.table(coverage);
console.log(`Coverage: ${coverage.filter((r) => r.story).length}/${coverage.length} stories, ${coverage.filter((r) => r.cover).length}/${coverage.length} covers, ${coverage.reduce((n, r) => n + r.recaps, 0)}/${coverage.reduce((n, r) => n + r.episodes, 0)} recaps.`);
if (issues.length) {
  for (const issue of issues) console.error(`Content error: ${issue}`);
  process.exitCode = 1;
}
