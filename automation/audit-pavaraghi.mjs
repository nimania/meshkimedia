// Audit the overlap of episode metadata, original recaps, and Persian editorial segments.
// Never interpret a calendar listing as proof of publication or a Persian editorial cut as a verified TV dub.
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../github-pages/data/", import.meta.url);
const series = JSON.parse(await readFile(new URL("series.json", root), "utf8"));
const data = JSON.parse(await readFile(new URL("dubbed.json", root), "utf8"));
const date = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const valid = x => x.status === "published" && Array.isArray(x.paragraphs) && x.paragraphs.some(p => typeof p === "string" && p.trim());
const uniqueSorted = numbers => [...new Set(numbers)].sort((a,b)=>a-b);
const rows = [];
for (const [slug, show] of Object.entries(series)) {
  const record = (data.series || []).find(s=>s.slug===slug);
  const entries = (record?.entries||[]).filter(valid);
  const original = entries.filter(e=>e.kind==="original");
  const persian = entries.filter(e=>e.kind==="dubbed");
  const episodes = (show.seasons||[]).flatMap(s=>s.episodes||[])
    .filter(ep=>Number.isInteger(Number(ep.number)) && Number(ep.number)>0 && (!ep.date || ep.date<=date) && !(ep.scheduled && (!ep.date || ep.date>=date)));
  const registered = uniqueSorted(episodes.map(ep=>Number(ep.number)));
  const originalNums = uniqueSorted(original.map(e=>Number(e.originalEpisode)).filter(Number.isInteger));
  const persianNums = uniqueSorted(persian.map(e=>Number(e.originalEpisode)).filter(Number.isInteger));
  const gaps = [];
  for (const season of show.seasons||[]) {
    const ids = uniqueSorted((season.episodes||[]).map(ep=>Number(ep.number)).filter(Number.isInteger));
    if (ids.length>1) for(let n=ids[0]+1;n<ids[ids.length-1];n++) if(!ids.includes(n))gaps.push(n);
  }
  const missingOriginal = registered.filter(n=>!originalNums.includes(n));
  const missingPersian = registered.filter(n=>!persianNums.includes(n));
  const originalWithoutIndex = originalNums.filter(n=>!registered.includes(n));
  const verifiedPersian = persian.filter(e=>(e.broadcastRefs||[]).some(r=>r.verified===true)).length;
  const shortPersian = persian.filter(e=>e.paragraphs.join(" ").trim().split(/\s+/).length<500).length;
  rows.push({
    slug,titleFa:show.titleFa||show.titleTr||slug,titleTr:show.titleTr||"",network:show.network||"",
    registrationStatus:show.status||"",registeredEpisodes:registered,registeredCount:registered.length,
    highestRegistered:registered.length?registered.at(-1):null,
    metadataOnlyCount:episodes.filter(ep=>ep.metadataOnly).length,
    episodeNumberGaps:uniqueSorted(gaps),
    originalEpisodes:originalNums,originalCount:original.length,
    persianParentEpisodes:persianNums,persianPartCount:persian.length,
    verifiedTvDubPartCount:verifiedPersian,shortPersianPartCount:shortPersian,
    missingOriginal,missingPersian,originalWithoutIndex,
    officialEpisodesUrl:show.official?.episodes||show.official?.website||"",
    caveat:show.archiveAudit?.note||(record?.production?.pavaraghiQueueReason||""),
  });
}
const sum = rows.reduce((o,r)=>({
  series:o.series+1,registeredEpisodes:o.registeredEpisodes+r.registeredCount,
  metadataOnlyEpisodes:o.metadataOnlyEpisodes+r.metadataOnlyCount,
  publishedOriginal:o.publishedOriginal+r.originalCount,
  publishedPersian:o.publishedPersian+r.persianPartCount,
  registeredWithoutOriginal:o.registeredWithoutOriginal+r.missingOriginal.length,
  registeredWithoutPersian:o.registeredWithoutPersian+r.missingPersian.length,
  originalWithoutIndex:o.originalWithoutIndex+r.originalWithoutIndex.length,
  seriesWithRecaps:o.seriesWithRecaps+(r.originalCount?1:0),
  verifiedTvDubParts:o.verifiedTvDubParts+r.verifiedTvDubPartCount,
  shortPersianParts:o.shortPersianParts+r.shortPersianPartCount
}),{series:0,registeredEpisodes:0,metadataOnlyEpisodes:0,publishedOriginal:0,publishedPersian:0,registeredWithoutOriginal:0,registeredWithoutPersian:0,originalWithoutIndex:0,seriesWithRecaps:0,verifiedTvDubParts:0,shortPersianParts:0});
const report={version:1,generatedAt:new Date().toISOString(),cutoffDate:date,method:"Registry overlap only; not a certification of all broadcast episodes or the completeness/accuracy of narrative recaps.",summary:sum,series:rows};
await writeFile(new URL("pavaraghi-audit.json",root),JSON.stringify(report,null,2)+"\n","utf8");
console.log("Pavaraghi audit",JSON.stringify(sum));
