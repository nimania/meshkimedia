// Pull only confirmed, dated episode rows from Dizilah's public calendar.
// Never invent weekly dates or episode numbers. A failed/partial scrape leaves
// the last verified snapshot untouched.
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DATA = new URL("../github-pages/data/calendar.json", import.meta.url);
const SERIES = new URL("../github-pages/data/series.json", import.meta.url);
const NETWORKS = new URL("../github-pages/data/networks.json", import.meta.url);
const SOURCE = "https://www.dizilah.com/calendar";

export function fold(value) {
  return String(value || "").toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ş/g, "s")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ç/g, "c")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
const slug = (value) => String(value || "").toLocaleLowerCase("tr")
  .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ş/g, "s")
  .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ç/g, "c")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const entities = (value) => String(value || "")
  .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, x) => {
    const n = x[0].toLowerCase() === "x" ? parseInt(x.slice(1), 16) : Number(x);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  })
  .replace(/&(?:nbsp|amp|quot|apos|lt|gt|hellip);/gi, (x) => ({
    "&nbsp;":" ","&amp;":"&","&quot;":'"',"&apos;":"'","&lt;":"<","&gt;":">","&hellip;":"…"
  })[x.toLowerCase()] || x);
const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const NETWORK_NAMES = {
  atv:"atv", "showtv":"show-tv", "startv":"star-tv",
  "kanald":"kanal-d", "trt1":"trt-1", "now":"now", "nowtv":"now",tv8:"tv8"
};
const dayStamp = (heading, today) => {
  const x = heading.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*,\s*([A-Za-z]+)\s+(\d{1,2})/i);
  if (!x) return null;
  const month = MONTHS[x[1].slice(0,3).toLowerCase()], day = Number(x[2]);
  if (month == null || day < 1 || day > 31) return null;
  const year = Number(today.slice(0,4));
  const selected = [year-1,year,year+1].map(y => {
    const d = new Date(Date.UTC(y,month,day,12));
    return {iso:d.toISOString().slice(0,10), delta:Math.abs(d-Date.parse(today+"T12:00:00Z")),valid:d.getUTCMonth()===month&&d.getUTCDate()===day};
  }).filter(x=>x.valid).sort((a,b)=>a.delta-b.delta)[0];
  return selected?.iso || null;
};
export function parseCalendar(source, series, networks, today) {
  let text = source
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/a\s*>/gi,"\n")
    .replace(/<\/(?:section|article|li)\s*>/gi,"\n")
    .replace(/<[^>]*>/g, " ");
  text = entities(text).replace(/\r/g, "").replace(/[\t ]+/g, " ");
  const start = text.indexOf("Turkish TV Calendar");
  if (start !== -1) text = text.slice(start);
  // Headings may contain "Today (Saturday, Oct 17)".
  const dayRe = /(?:Today\s*\(\s*)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*,\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\s*\)?/gi;
  const headings = Array.from(text.matchAll(dayRe));
  const catalogue = new Map(Object.entries(series).map(([key,show])=>[fold(show.titleTr),key]));
  const keys = new Map(Object.entries(networks).flatMap(([key,network])=>
    [network.name,...(network.ratingKeys||[])].map(name=>[fold(name),key])));
  const days = {}, shows = {};
  for (let i=0;i<headings.length;i++) {
    const date=dayStamp(headings[i][0],today);
    if (!date) continue;
    const tail = text.slice(headings[i].index+headings[i][0].length, headings[i+1]?.index ?? text.length);
    const rows = tail.split(/\n+/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
    for (const row of rows) {
      const hit=row.match(/(.{2,160}?)\s+Season\s+(\d+)\s*,?\s*Episode\s+(\d+)\s+(ATV|Show\s*TV|Star\s*TV|Kanal\s*D|TRT\s*1|NOW(?:\s*TV)?|TV8)(?:\s+(Series|Season)\s+(Premiere|Finale))?/i);
      if (!hit) continue;
      let title=hit[1].replace(/^\s*[\[\]\u2022\-]+/,"").replace(/\s*\]\s*$/,"").trim();
      // Normalized title lookup also rescues links with a stray leading label.
      let known=catalogue.get(fold(title));
      if (!known) for (const [candidate,key] of catalogue) {
        if (fold(title).endsWith(candidate) && candidate.length>6) {known=key;title=series[key].titleTr;break;}
      }
      const network=keys.get(fold(hit[4])) || NETWORK_NAMES[fold(hit[4])];
      if (!network || title.length>120 || title.length<2) continue;
      const showSlug=known || slug(title);
      if (!showSlug) continue;
      const entry={slug:showSlug,season:Number(hit[2]),episode:Number(hit[3])};
      if (/series/i.test(hit[5]||"") && /premiere/i.test(hit[6]||"")) entry.premiere="series";
      if (!days[date]) days[date]=[];
      if (!days[date].some(x=>x.slug===showSlug)) days[date].push(entry);
      if (!series[showSlug]) shows[showSlug]={titleTr:title,network};
    }
  }
  return {days:Object.fromEntries(Object.entries(days).sort(([a],[b])=>a.localeCompare(b))),shows};
}

export function validateCalendar(parsed,previous,today) {
  const dates=Object.keys(parsed.days).sort();
  const count=Object.values(parsed.days).reduce((n,rows)=>n+rows.length,0);
  const previousCount=Object.values(previous.days||{}).reduce((n,rows)=>n+rows.length,0);
  const future=dates.filter(date=>date>=today);
  const maxFuture=Date.parse((future.at(-1)||"1970-01-01")+"T12:00:00Z");
  const minFuture=Date.parse(today+"T12:00:00Z") + 3*86400000;
  if (dates.length<6 || count<15 || (previousCount>0 && count<Math.floor(previousCount*0.45)) ||
      future.length<3 || maxFuture<minFuture) {
    throw new Error("Dizilah calendar incomplete/stale; refusing overwrite ("+dates.length+" dates, "+count+" entries, last "+dates.at(-1)+")");
  }
  for(const [date,rows] of Object.entries(parsed.days)) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||rows.some(x=>!x.slug||!Number.isInteger(x.season)||!Number.isInteger(x.episode)||x.season<1||x.episode<1))
      throw new Error("Invalid confirmed episode on "+date);
  }
  return {days:dates.length,entries:count,last:dates.at(-1)};
}

async function main() {
  const [old,series,networks]=await Promise.all([DATA,SERIES,NETWORKS].map(async p=>JSON.parse(await readFile(p,"utf8"))));
  const today=process.env.CALENDAR_TODAY || new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const response=await fetch(SOURCE,{headers:{"User-Agent":"MeshkiMediaCalendar/1.0 (+https://github.com/nimania/meshkimedia)","Accept":"text/html","Accept-Language":"en-US,en;q=0.9"},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error("Dizilah calendar HTTP "+response.status);
  const parsed=parseCalendar(await response.text(),series,networks,today);
  const stats=validateCalendar(parsed,old,today);
  const newer={source:{name:"Dizilah",url:"https://dizilah.com/calendar",checkedAt:today},shows:{...old.shows,...parsed.shows},days:parsed.days};
  const current=JSON.stringify({shows:old.shows,days:old.days});
  const next=JSON.stringify({shows:newer.shows,days:newer.days});
  if(current!==next || old.source?.checkedAt!==today)
    await writeFile(DATA,JSON.stringify(newer,null,2)+"\n");
  console.log("Verified Dizilah calendar: "+stats.entries+" broadcasts, "+stats.days+" days, through "+stats.last+".");
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(e=>{console.error("Calendar refresh failed; prior verified data preserved:",e.message);process.exitCode=1;});
