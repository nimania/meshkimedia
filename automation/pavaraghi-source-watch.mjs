import fs from "node:fs/promises";
const data=JSON.parse(await fs.readFile("github-pages/data/dubbed.json","utf8"));
await fs.mkdir("automation/reports",{recursive:true});
const trim=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const rows=[];
for(const series of data.series||[]){
 const original=(series.entries||[]).filter(e=>e.kind==="original"&&e.status==="published");
 if(series.slug!=="tuzlu-kahve")continue;
 for(const e of original){
  const url="https://www.startv.com.tr/dizi/tuzlu-kahve/bolumler/"+e.originalEpisode+"-bolum";
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});
   if(!r.ok)throw Error("HTTP "+r.status);
   const html=await r.text();
   const metas=html.match(/<meta\b[^>]*>/gi)||[];
   let description="";
   for(const tag of metas){
    if(/(?:property|name)=["'](?:og:description|description)["']/i.test(tag)){
     const match=tag.match(/content=["']([^"']{1,5000})["']/i);
     if(match){description=trim(match[1]);break;}
    }
   }
   const count=description.split(/\s+/).filter(Boolean).length;
   rows.push({series:series.slug,episode:e.originalEpisode,url,status:count>=35?"review_required":"insufficient_source_text",description:description.slice(0,2000),sourceWords:count,note:"Metadata lead only; human scene verification required."});
  }catch(ex){rows.push({series:series.slug,episode:e.originalEpisode,url,status:"fetch_failed",error:String(ex.message||ex)});}
 }
}
const report={generatedAt:new Date().toISOString(),mode:"review_only_no_publication",rows};
await fs.writeFile("automation/reports/pavaraghi-leads.json",JSON.stringify(report,null,2)+"\n");
const md=["# گزارش روزانه منابع پاورقی","","این پایش هیچ پاورقی منتشرشده‌ای را تغییر نمی‌دهد.","","| قسمت | وضعیت | منبع |","|---:|---|---|",...rows.map(r=>"| "+r.episode+" | "+r.status+" | [منبع]("+r.url+") |"),"","## جزئیات قابل بررسی",...rows.filter(r=>r.status==="review_required").map(r=>"### قسمت "+r.episode+"\n\n"+r.description+"\n\n[منبع]("+r.url+")\n")].join("\n");
await fs.writeFile("automation/reports/pavaraghi-leads.md",md);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,md);
console.log("Checked "+rows.length+" official pages; report only; no publishing.");
