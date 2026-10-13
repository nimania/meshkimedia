// Dedicated Qahveh Shoor channel publisher. Runs after build-site.mjs.
// Never imports the general Meshki Media Telegram publisher or its state.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const ROOT=new URL('../github-pages/',import.meta.url);
const DATA=new URL('data/',ROOT);
const BASE='https://nimania.github.io/meshkimedia';
const CHANNEL=(process.env.GHAHVEHSHOOR_CHAT||'@ghahvehshoor').trim();
const TOKEN=(process.env.GHAHVEHSHOOR_BOT_TOKEN||process.env.TELEGRAM_BOT_TOKEN||'').trim();
const DRY=process.argv.includes('--dry-run');
const STATE=new URL('ghahvehshoor-posted.json',DATA);
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim();
const txt=(h,key)=>{const m=h.match(new RegExp('<meta\\s+(?:property|name)="'+key+'"\\s+content="([^"]*)"','i'));return m?.[1]?.replace(/&amp;/g,'&').replace(/&quot;/g,'"')||'';};
const read=async f=>JSON.parse(await readFile(new URL(f,DATA),'utf8'));
const items=[];
const s=await read('series.json');
const main=s['tuzlu-kahve']||{};
for(const season of main.seasons||[])for(const ep of season.episodes||[]){
  if(ep.scheduled||!ep.number)continue;
  const url=`${BASE}/dizi/tuzlu-kahve/bolum-${ep.number}/`;
  items.push({id:`episode:${ep.number}`,date:ep.date||'',label:'🎬 قسمت تازه قهوه شور',title:`قسمت ${ep.number} قهوه شور`,summary:ep.summaryFa||ep.synopsisFa||ep.summary||'',image:ep.image||ep.images?.[0]||main.hero,url});
}
const news=await read('news.json');
for(const n of news.items||[]){
  if(!(n.entities?.series||[]).includes('tuzlu-kahve'))continue;
  if(!n.titleFa||!(n.bodyFa?.length))continue;
  items.push({id:'news:'+n.id,date:n.published||'',label:'📰 خبر قهوه شور',title:n.titleFa,summary:n.summaryFa||n.bodyFa[0],image:n.image||n.images?.[0],url:`${BASE}/haber/${n.id}/`});
}
const dir=new URL('pavaraghi/tuzlu-kahve/',ROOT);
for(const entry of await readdir(dir,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  try{
    const html=await readFile(new URL(entry.name+'/index.html',dir),'utf8');
    const title=txt(html,'og:title')||'پاورقی قهوه شور';
    const description=txt(html,'og:description');
    if(!html.includes('pavaraghi-text'))continue;
    items.push({id:'pavaraghi:'+entry.name,date:'',label:entry.name.startsWith('original-')?'📖 پاورقی نسخه اصلی':'📺 پاورقی دوبله فارسی',title:title.replace(/\\s*\\|\\s*مشکی.مدیا.*$/,'').trim(),summary:description,image:txt(html,'og:image'),url:`${BASE}/pavaraghi/tuzlu-kahve/${encodeURIComponent(entry.name)}/`});
  }catch{}
}
const unique=[...new Map(items.map(i=>[i.id,i])).values()];
const seenFile=await readFile(STATE,'utf8').catch(()=>null);
let state=seenFile?JSON.parse(seenFile):null;
if(!state||!Array.isArray(state.posted)){
  console.log(`Qahveh Shoor: first run, seed ${unique.length} existing entries; no archive flood.`);
  if(!DRY)await writeFile(STATE,JSON.stringify({posted:unique.map(i=>i.id),updated:new Date().toISOString()},null,2)+'\\n');
  process.exit(0);
}
const seen=new Set(state.posted);
const fresh=unique.filter(i=>!seen.has(i.id)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,Number(process.env.GHAHVEHSHOOR_MAX||8));
if(!TOKEN&&!DRY){console.log('Qahveh Shoor: missing Telegram bot token; skip without marking sent.');process.exit(0);}
async function send(method,body){
 const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 return r.json();
}
let success=0;
for(const item of fresh){
 const summary=clean(item.summary).slice(0,460);
 const url=esc(item.url);
 const caption=`${item.label}\\n\\n<b>${esc(clean(item.title).slice(0,180))}</b>\\n\\n${esc(summary)}\\n\\n🔗 <a href="${url}">مطالعه کامل در مشکی‌مدیا</a>\\n\\n#قهوه_شور`;
 if(DRY){console.log(item.id,item.url);continue;}
 try{
  let result=null;
  if(/^https:\\/\\//.test(item.image||''))result=await send('sendPhoto',{chat_id:CHANNEL,photo:item.image,caption,parse_mode:'HTML'});
  if(!result?.ok)result=await send('sendMessage',{chat_id:CHANNEL,text:caption,parse_mode:'HTML',link_preview_options:{is_disabled:false}});
  if(!result?.ok){console.error('Qahveh Shoor Telegram failed',item.id,result?.description);break;}
  state.posted.push(item.id);success++;
  await writeFile(STATE,JSON.stringify({posted:state.posted,updated:new Date().toISOString()},null,2)+'\\n');
  await new Promise(resolve=>setTimeout(resolve,1500));
 }catch(error){console.error('Qahveh Shoor Telegram error',item.id,error.message);break;}
}
console.log(`Qahveh Shoor: ${success} sent, ${fresh.length-success} pending, ${unique.length} total discovered.`);
