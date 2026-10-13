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
 // Five editorial slots per Tehran calendar day, even when no new external news arrives.
 // Source-grounded formats only: story, cast, character, episode recap and audience question.
 const tzParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const val=k=>tzParts.find(p=>p.type===k)?.value;
 const today=val('year')+'-'+val('month')+'-'+val('day');
 const hour=Number(val('hour'));
 const dayIndex=Math.floor(Date.parse(today+'T00:00:00Z')/86400000);
 const slots=Array.isArray(cfg.dailyHours)&&cfg.dailyHours.length===5?cfg.dailyHours:[9,12,15,18,21];
 if(cfg.dailyMinimum>=5){
  const cast=record.cast||[];
  const actor=cast.length?cast[dayIndex%cast.length]:null;
  const second=cast.length?cast[(dayIndex+1)%cast.length]:null;
  const episodes=(record.seasons||[]).flatMap(se=>se.episodes||[]).filter(ep=>ep.summary && ep.number);
  const episode=episodes.length?episodes[dayIndex%episodes.length]:null;
  const seriesLink=base+'/dizi/'+slug+'/';
  const actorLink=actor?.personSlug?base+'/oyuncu/'+actor.personSlug+'/':seriesLink;
  const question=actor&&second?'شما داستان را بیشتر از زاویهٔ '+(actor.roleFa||actor.nameFa)+' دنبال می‌کنید یا '+(second.roleFa||second.nameFa)+'؟ دلیل انتخابتان چیست؟':'کدام لحظه از داستان بیش از همه در خاطرتان مانده است؟';
  const facts=[
   {label:'☕ داستان قهوه شور',title:'داستان از کجا آغاز می‌شود؟',summary:record.synopsis||'با ما داستان و شخصیت‌های این سریال را دنبال کنید.',image:record.hero,url:seriesLink},
   {label:'🎭 چهره‌های سریال',title:actor?'آشنایی با '+(actor.nameFa||actor.name):'آشنایی با بازیگران '+record.titleFa,summary:actor?('نقش: '+(actor.roleFa||actor.role||'')+'. '+(actor.description||'')+' اطلاعات بازیگر و نقش را در مشکی‌مدیا دنبال کنید.'):record.synopsis,image:actor?.image||record.hero,url:actorLink},
   {label:'📖 آنچه گذشت',title:episode?'مرور قسمت '+episode.number+' '+record.titleFa:'مرور داستان '+record.titleFa,summary:episode?.summary||record.synopsis,image:episode?.image||record.hero,url:episode?base+'/dizi/'+slug+'/bolum-'+episode.number+'/':seriesLink},
   {label:'💬 سؤال روز',title:'شما چه فکر می‌کنید؟',summary:question+' نظر خود را در گفت‌وگوی کانال یا برای دوستانتان مطرح کنید.',image:record.hero,url:seriesLink},
   {label:'🔎 شخصیت زیر ذره‌بین',title:second?'شخصیت '+(second.roleFa||second.role||second.nameFa):'دربارهٔ شخصیت‌های سریال',summary:second?.description||record.synopsis,image:second?.image||record.hero,url:second?.personSlug?base+'/oyuncu/'+second.personSlug+'/':seriesLink}
  ];
  for(let i=0;i<5;i++){
   if(hour<Number(slots[i]))continue;
   items.push({...facts[i],id:'daily:'+today+':'+i,date:today+'T'+String(slots[i]).padStart(2,'0')+':00:00'});
  }
 }
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
 const fresh=entries.filter(x=>!seen.has(x.id)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,Math.max(1,Math.min(4,Number(cfg.maxPerRun||3))));
 for(const item of fresh){
  const summary=strip(item.summary).slice(0,420);
  const title=strip(item.title).slice(0,180);
  const joinUrl='https://t.me/'+channel.slice(1);
  const caption=[item.label+' | '+esc(record.titleFa),'<b>'+esc(title)+'</b>',esc(summary),'🔗 <a href="'+esc(item.url)+'">مطالعه کامل در مشکی‌مدیا</a>','☕️ <a href="'+esc(joinUrl)+'">عضویت در کانال اختصاصی '+esc(record.titleFa)+'</a> · این پست را با علاقه‌مندان سریال به اشتراک بگذارید.','#'+record.titleFa.replace(/\s+/g,'_')].join('\n\n');
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
