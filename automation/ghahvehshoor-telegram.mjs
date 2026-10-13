// Multi-series Telegram publisher for Meshki Media. Each series has separate state.
// On first run, seed the existing archive without sending a flood of old posts.
import {readFile,writeFile,readdir} from 'node:fs/promises';
const root=new URL('../github-pages/',import.meta.url);
const data=new URL('data/',root);
const base='https://nimania.github.io/meshkimedia';
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
const dry=process.argv.includes('--dry-run');
const config=JSON.parse(await readFile(new URL('automation/telegram-series.json',new URL('../',import.meta.url)),'utf8'));
const series=JSON.parse(await readFile(new URL('series.json',data),'utf8'));
const news=JSON.parse(await readFile(new URL('news.json',data),'utf8'));
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const strip=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function meta(html,key){let m=html.match(new RegExp('<meta\\s+(?:property|name)="'+key+'"\\s+content="([^"]*)"','i'));return (m?.[1]||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"');}
async function telegram(method,body){
 const res=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 return res.json();
}
for(const cfg of config.channels||[]){
 if(cfg.enabled===false)continue;
 const slug=cfg.seriesSlug;
 const channel=cfg.channel;
 if(!/^[a-z0-9-]+$/.test(slug)||!/^@[a-zA-Z0-9_]{5,}$/.test(channel)||!series[slug]){console.warn('Invalid Telegram series configuration',slug);continue;}
 const record=series[slug], items=[];
 for(const season of record.seasons||[])for(const ep of season.episodes||[]){
  if(ep.scheduled||!ep.number)continue;
  items.push({id:'episode:'+ep.number,date:ep.date||'',label:'🎬 قسمت تازه',title:'قسمت '+ep.number+' '+record.titleFa,summary:ep.summaryFa||ep.synopsisFa||ep.summary||'',image:ep.image||ep.images?.[0]||record.hero,url:base+'/dizi/'+slug+'/bolum-'+ep.number+'/'});
 }
 for(const n of news.items||[]){
  if(!(n.entities?.series||[]).includes(slug)||!n.titleFa||!n.bodyFa?.length)continue;
  items.push({id:'news:'+n.id,date:n.published||'',label:'📰 خبر سریال',title:n.titleFa,summary:n.summaryFa||n.bodyFa[0],image:n.image||n.images?.[0]||record.hero,url:base+'/haber/'+n.id+'/'});
 }
 const folder=new URL('pavaraghi/'+slug+'/',root);
 try{
  for(const entry of await readdir(folder,{withFileTypes:true})){
   if(!entry.isDirectory())continue;
   try{
    const html=await readFile(new URL(entry.name+'/index.html',folder),'utf8');
    if(!html.includes('pavaraghi-text'))continue;
    items.push({id:'pavaraghi:'+entry.name,date:'',label:entry.name.startsWith('original-')?'📖 پاورقی نسخه اصلی':'📺 پاورقی دوبله فارسی',title:meta(html,'og:title').replace(/\s*\|\s*مشکی.مدیا.*$/,'')||record.titleFa,summary:meta(html,'og:description'),image:meta(html,'og:image')||record.hero,url:base+'/pavaraghi/'+slug+'/'+encodeURIComponent(entry.name)+'/'});
   }catch{}
  }
 }catch{}
 const entries=[...new Map(items.map(x=>[x.id,x])).values()];
 const stateUrl=new URL('telegram-series-'+slug+'-posted.json',data);
 let state=null;try{state=JSON.parse(await readFile(stateUrl,'utf8'));}catch{}
 if(!state||!Array.isArray(state.posted)){
  console.log(slug+': first run, seed '+entries.length+' existing entries; post none.');
  if(!dry)await writeFile(stateUrl,JSON.stringify({posted:entries.map(x=>x.id),updated:new Date().toISOString()},null,2)+'\n');
  continue;
 }
 if(!token&&!dry){console.log(slug+': missing bot secret, no posts.');continue;}
 const seen=new Set(state.posted);
 const fresh=entries.filter(x=>!seen.has(x.id)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,Math.max(1,Math.min(20,Number(cfg.maxPerRun||8))));
 for(const item of fresh){
  const summary=strip(item.summary).slice(0,420);
  const title=strip(item.title).slice(0,180);
  const caption=item.label+' | '+esc(record.titleFa)+'\n\n<b>'+esc(title)+'</b>\\n\\n'+esc(summary)+'\n\n🔗 <a href="'+esc(item.url)+'">مطالعه کامل در مشکی‌مدیا</a>\\n\\n#'+record.titleFa.replace(/\s+/g,'_');
  if(dry){console.log(slug,item.id,item.url);continue;}
  try{
   let result=null;
   if(/^https:\/\//.test(item.image||''))result=await telegram('sendPhoto',{chat_id:channel,photo:item.image,caption,parse_mode:'HTML'});
   if(!result?.ok)result=await telegram('sendMessage',{chat_id:channel,text:caption,parse_mode:'HTML',link_preview_options:{is_disabled:false}});
   if(!result?.ok){console.error(slug,item.id,result?.description||'Telegram failed');break;}
   state.posted.push(item.id);
   await writeFile(stateUrl,JSON.stringify({posted:state.posted,updated:new Date().toISOString()},null,2)+'\n');
   console.log(slug+' sent '+item.id);
   await new Promise(resolve=>setTimeout(resolve,1800));
  }catch(error){console.error(slug,item.id,error.message);break;}
 }
}
