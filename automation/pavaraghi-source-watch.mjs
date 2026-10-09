import fs from "node:fs/promises";
const catalog = JSON.parse(await fs.readFile("github-pages/data/dubbed.json","utf8"));
const seriesData = JSON.parse(await fs.readFile("github-pages/data/series.json","utf8"));
const now = new Date();
const today = now.toISOString().slice(0,10);
const offline = process.argv.includes("--offline");
await fs.mkdir("automation/reports",{recursive:true});
const trim = s => String(s || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
const rootHost = s => {try {return new URL(s).hostname.toLowerCase().replace(/^www\./,"");} catch {return "";}};
const trusted = (link, official) => {
 try {
  const u = new URL(link);
  const host = rootHost(official);
  return u.protocol==="https:" && !!host && (u.hostname===host || u.hostname==="www."+host || u.hostname.endsWith("."+host));
 } catch {return false;}
};
const meta = html => {
 for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
  if (!/(?:name|property)\s*=\s*["'](?:og:description|description)["']/i.test(tag)) continue;
  const match = tag.match(/content\s*=\s*(["'])([\s\S]*?)\1/i);
  if (match) return trim(match[2]).slice(0,2400);
 }
 return "";
};
const queue=[];
for (const record of catalog.series || []) {
 const s=seriesData[record.originalSeriesSlug || record.slug];
 if (!s) continue;
 const originals=(record.entries||[]).filter(e=>e.kind==="original"&&e.status==="published");
 const dubbed=(record.entries||[]).filter(e=>e.kind==="dubbed"&&e.status==="published");
 const episodes=(s.seasons||[]).flatMap(se=>se.episodes||[]);
 if (!episodes.length) {
  queue.push({series:s.slug,title:s.titleFa,episode:null,status:"no_catalogued_episodes",publishedOriginals:originals.length,publishedDubbed:dubbed.length});
  continue;
 }
 for (const ep of episodes) {
  const published=originals.some(x=>Number(x.originalEpisode)===Number(ep.number));
  const future=!!ep.scheduled || !!(ep.date && ep.date>today);
  const url=ep.source || ep.watchUrl || "";
  const official=trusted(url,s.official?.website);
  queue.push({
   series:s.slug,title:s.titleFa,episode:ep.number,episodeDate:ep.date||null,
   status:future?"scheduled":!official?"official_source_needed":published?"published_recheck":"needs_editorial_recap",
   published,sourceUrl:official?url:null,
   existingSummary:ep.summary||"",photoAvailable:!!(ep.image||(ep.images||[]).length),
   publishedOriginals:originals.length,publishedDubbed:dubbed.length
  });
 }
}
const candidates=queue.filter(q=>q.sourceUrl && q.status!=="scheduled");
const checks=[];
for(let i=0;i<candidates.length;i+=5){
 const batch=candidates.slice(i,i+5);
 const block=await Promise.all(batch.map(async item=>{
  if(offline)return {...item,check:"not_checked_offline",description:""};
  try {
   const response=await fetch(item.sourceUrl,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MeshkiMediaEditorialResearch/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(14000)});
   if (!response.ok) throw Error("HTTP "+response.status);
   const html=await response.text();
   const description=meta(html);
   const words=description.split(/\s+/).filter(Boolean).length;
   return {series:item.series,episode:item.episode,sourceUrl:item.sourceUrl,check:words>=30?"text_to_review":"limited_metadata",description,descriptionWords:words,existingSummaryWords:item.existingSummary.split(/\s+/).filter(Boolean).length,note:"Page metadata only. Check full episode and provenance before drafting or changing a published recap."};
  }catch(err){return {series:item.series,episode:item.episode,sourceUrl:item.sourceUrl,check:"fetch_failed",error:String(err?.message||err).slice(0,250)};}
 }));
 checks.push(...block);
}
const output={generatedAt:now.toISOString(),mode:"review_only_no_publishing",seriesCount:(catalog.series||[]).length,episodeCount:queue.filter(x=>x.episode!==null).length,candidates:checks.length,queue,checks};
await fs.writeFile("automation/reports/pavaraghi-backlog.json",JSON.stringify(output,null,2)+"\n");
await fs.writeFile("automation/reports/pavaraghi-leads.json",JSON.stringify({generatedAt:output.generatedAt,mode:output.mode,checks},null,2)+"\n");
const md=[
 "# پایش روزانه منابع پاورقی","",
 "این گزارش تحقیقاتی است؛ نه متن پاورقی و نه تأیید درستی جزئیات داستان. هیچ مطلب عمومی با این اجرا تغییر نمی‌کند.","",
 "سریال‌های ثبت‌شده: "+output.seriesCount+" | قسمت‌های فهرست‌شده: "+output.episodeCount+" | منابع بررسی‌شده: "+checks.length,
 "",
 "## صف انتظار تولید",
 "| سریال | قسمت | وضعیت | تصویر |",
 "|---|---:|---|---|",
 ...queue.map(q=>"| "+q.title+" | "+(q.episode??"—")+" | "+q.status+" | "+(q.photoAvailable?"بله":"—")+" |"),
 "",
 "## بررسی منابع رسمی",
 "| سریال | قسمت | وضعیت دریافت | پیوند |",
 "|---|---:|---|---|",
 ...checks.map(c=>"| "+c.series+" | "+c.episode+" | "+c.check+" | [منبع]("+c.sourceUrl+") |"),
 "",
 "متن توضیحات بازیابی‌شده و خطاها در فایل JSON پیوست گزارش ذخیره می‌شوند."
].join("\n")+"\n";
await fs.writeFile("automation/reports/pavaraghi-leads.md",md);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,md);
console.log(JSON.stringify({series:output.seriesCount,episodes:output.episodeCount,officialSources:checks.length,pending:queue.filter(q=>q.status==="needs_editorial_recap").length,missingSources:queue.filter(q=>q.status==="official_source_needed").length,offline,changedPublicRecaps:0}));
