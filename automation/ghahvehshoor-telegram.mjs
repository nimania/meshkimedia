// Multi-series Telegram publisher for Meshki Media. Each series has separate state.
// On first run, seed the existing archive without sending a flood of old posts.
import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getOfficialChannelVideos} from './series-youtube.mjs';
import {chooseEngagement,reservedEngagementSlot} from './series-engagement.mjs';
const root=new URL('../github-pages/',import.meta.url);
const data=new URL('data/',root);
const base='https://nimania.github.io/meshkimedia';
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
const dry=process.argv.includes('--dry-run');
const config=JSON.parse(await readFile(new URL('automation/telegram-series.json',new URL('../',import.meta.url)),'utf8'));
const series=JSON.parse(await readFile(new URL('series.json',data),'utf8'));
const news=JSON.parse(await readFile(new URL('news.json',data),'utf8'));
const dubbed=JSON.parse(await readFile(new URL('dubbed.json',data),'utf8'));
const hash=s=>createHash('sha256').update(strip(s).replace(/[\u064b-\u065f\u200c]/g,'').toLowerCase()).digest('hex').slice(0,24);
async function saveState(file,state){const tmp=new URL(file.pathname+'.tmp',file);await writeFile(tmp,JSON.stringify(state,null,2)+'\n');await rename(tmp,file);}
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
 // Only create editorial posts with a stable source-based identity.
 const editorial=[];
 const excluded=new Set(cfg.excludeRecapEpisodeNumbers||[]);
 const pv=(dubbed.series||[]).find(x=>x.slug===slug||x.originalSeriesSlug===slug);
 for(const entry of pv?.entries||[]){
  if(entry.status!=='published'||!Array.isArray(entry.paragraphs)||excluded.has(Number(entry.originalEpisode)))continue;
  const ep=(record.seasons||[]).flatMap(se=>se.episodes||[]).find(x=>x.number===entry.originalEpisode);
  const photo=entry.coverImage||ep?.image||record.hero;
  for(const angle of [{index:0,type:'recap',label:'📖 روایت قسمت'},
    {index:3,type:'detail',label:'🔎 جزئیات داستان'},
    {index:6,type:'question',label:'💬 دربارهٔ این قسمت'}]){
   const p=entry.paragraphs[angle.index];
   if(typeof p!=='string'||p.trim().length<90)continue;
   const summary=strip(p).slice(0,340)+(angle.type==='question'?' شما دربارهٔ این بخش چه فکر می‌کنید؟':'');
   editorial.push({id:'editorial:'+entry.slug+':'+angle.index,
    subject:'episode:'+entry.originalEpisode,type:angle.type,label:angle.label,
    title:(entry.title||record.titleFa)+' | '+(angle.index===0?'روایت':angle.index===3?'جزئیات':'پرسش') ,
    summary,image:photo,url:base+'/pavaraghi/'+(pv.slug||slug)+'/'+entry.slug+'/'});
  }
 }
 for(const actor of record.cast||[]){
  if(!actor.name||!actor.personSlug)continue;
  const name=actor.nameFa||actor.name,role=actor.roleFa||actor.role||'';
  editorial.push({id:'editorial:cast:'+actor.personSlug,subject:'actor:'+actor.personSlug,type:'actor',
   label:'🎭 بازیگران سریال',title:name+' در نقش '+role,
   summary:'در سریال '+record.titleFa+'، '+name+' نقش '+role+' را بازی می‌کند. '+(actor.description||''),
   image:actor.image||record.hero,url:base+'/oyuncu/'+actor.personSlug+'/'});
 }
 const tzParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const val=k=>tzParts.find(p=>p.type===k)?.value;
 const today=val('year')+'-'+val('month')+'-'+val('day');
 const hour=Number(val('hour'));
 const slots=Array.isArray(cfg.dailyHours)&&cfg.dailyHours.length?cfg.dailyHours:[9,12,15,18,21];
 const entries=[...new Map(items.map(x=>[x.id,x])).values()];
 const stateUrl=new URL('telegram-series-'+slug+'-posted.json',data);
 let state=null;try{state=JSON.parse(await readFile(stateUrl,'utf8'));}catch{}
 if(!state||!Array.isArray(state.posted)){
  console.log(slug+': first run, seed '+entries.length+' existing entries; post none.');
  if(!dry)await saveState(stateUrl,{posted:entries.map(x=>x.id),contentHashes:[],lastSubjects:{},updated:new Date().toISOString()});
  continue;
 }
 if(cfg.resumeFromTehran&&today<cfg.resumeFromTehran){console.log(slug+': publishing held until '+cfg.resumeFromTehran+' Tehran date.');continue;}
 if(!token&&!dry){console.log(slug+': missing bot secret, no posts.');continue;}
 // A series may have multiple official or owner-provided YouTube sources.
 // Bootstrap each source independently, without reposting existing uploads.
 const freshVideos=[];
 const videoSources=Array.isArray(cfg.youtubeSources)&&cfg.youtubeSources.length
  ? cfg.youtubeSources
  : cfg.youtubeHandle?[{handle:cfg.youtubeHandle,language:'tr',label:'کانال رسمی',priority:2}]:[];
 state.youtubeSources ||= {};
 for(const src of videoSources){
  if(!/^[a-zA-Z0-9._-]{3,60}$/.test(src.handle||''))continue;
  try{
   const prior=state.youtubeSources[src.handle]||null;
   const {channelId,videos}=await getOfficialChannelVideos({
    handle:src.handle,channelId:src.channelId||prior?.channelId||(videoSources.length===1?state.youtubeChannelId:null),language:src.language||'tr'
   });
   if(prior?.channelId&&prior.channelId!==channelId)throw new Error('Channel ID changed; needs review');
   if(!prior){
    const oldSeen=src.handle===cfg.youtubeHandle&&Array.isArray(state.youtubeSeen)?state.youtubeSeen:[];
    state.youtubeSources[src.handle]={channelId,seen:[...new Set([...oldSeen,...videos.map(x=>x.id)])],initializedAt:new Date().toISOString()};
    state.updated=new Date().toISOString();
    if(!dry)await saveState(stateUrl,state);
    console.log(slug+': YouTube @'+src.handle+' initialized: '+videos.length+' existing eligible videos recorded.');
    continue;
   }
   const known=new Set([...(prior.seen||[]),...(state.youtubeSeen||[]),...state.posted.filter(x=>x.startsWith('youtube:')).map(x=>x.slice(8))]);
   for(const v of videos){
    const age=Date.now()-Date.parse(v.published);
    if(known.has(v.id)||age<0||age>36*60*60*1000)continue;
    freshVideos.push({
     id:'youtube:'+v.id,platform:'youtube',type:v.kind,
     label:v.label,title:v.title,summary:v.description,
     url:v.videoUrl,image:v.thumbnail,date:v.published,
     subject:'youtube:'+v.id,videoId:v.id,videoSource:src.handle,
     youtubeSourceLabel:src.label||'یوتیوب',youtubePriority:Number(src.priority||3)
    });
   }
   console.log(slug+': YouTube @'+src.handle+' new eligible videos: '+freshVideos.filter(x=>x.videoSource===src.handle).length);
  }catch(error){console.warn(slug+': YouTube @'+src.handle+' unavailable, skipping: '+error.message);}
 }
 const seen=new Set(state.posted);
 const seenHashes=new Set(state.contentHashes||[]);
 const subjects=state.lastSubjects||{};
 const pending=editorial.filter(x=>!seen.has(x.id)&&!seenHashes.has(hash(x.summary)));
 const types=['recap','actor','detail','question','recap'];
 const reservedSlot=reservedEngagementSlot(cfg);
 let selected=null;
 for(let slot=0;slot<slots.length;slot++){
  if(slot===reservedSlot||hour<Number(slots[slot])||seen.has('slot:'+today+':'+slot))continue;
  const cooldown=Math.max(1,Math.min(14,Number(cfg.topicCooldownDays||3)));
  const pool=pending.filter(x=>!subjects[x.subject]||(Date.parse(today)-Date.parse(subjects[x.subject]))/86400000>=cooldown);
  const preferred=types[slot%types.length];
  const candidate=pool.find(x=>x.type===preferred)||pool[0];
  if(candidate){selected={...candidate,slotKey:'slot:'+today+':'+slot};break;}
 }
 if(!selected){
  const recent=items.filter(x=>!seen.has(x.id)&&!seenHashes.has(hash(x.summary))&&strip(x.summary).length>45);
  selected=recent.find(x=>x.id.startsWith('news:'))||recent[0]||null;
 }
 // A new official trailer takes precedence over routine posts, followed by recent
 // verified news. Videos have a separate two-per-day cap to avoid short-clip floods.
 const youtubeDaily=(state.youtubePostedDates||[]).filter(d=>d===today).length;
 if(freshVideos.length&&youtubeDaily<Number(cfg.youtubeMaxPerDay||2)){
  const pri={trailer:0,recap:1,'behind-scenes':2,interview:3,episode:4};
  freshVideos.sort((a,b)=>(a.youtubePriority||3)-(b.youtubePriority||3)||(pri[a.type]??9)-(pri[b.type]??9)||b.date.localeCompare(a.date));
  selected=freshVideos[0];
 }else if(!selected){
  const newsFresh=items.filter(x=>x.id.startsWith('news:')&&!seen.has(x.id)&&!seenHashes.has(hash(x.summary))&&x.date&&Date.now()-Date.parse(x.date)<24*60*60*1000);
  if(newsFresh.length)selected=newsFresh.sort((a,b)=>b.date.localeCompare(a.date))[0];
 }
 // An interaction replaces the regular 18:00 slot on four days each week.
 // Fresh official YouTube alerts remain separate and can be sent in another hourly run.
 const engagement=chooseEngagement(record,cfg,state);
 if(engagement&&selected?.platform!=='youtube')selected=engagement;
 const fresh=selected?[selected]:[];
 console.log(slug+': '+fresh.length+' unique item(s) selected; '+pending.length+' unused editorial subjects.');
 for(const item of fresh){
  const summary=strip(item.summary).slice(0,420);
  const title=strip(item.title).slice(0,180);
  const joinUrl='https://t.me/'+channel.slice(1);
  const action=item.platform==='youtube'
   ? '▶️ <a href="'+esc(item.url)+'">تماشای ویدئو در '+esc(item.youtubeSourceLabel||'یوتیوب')+'</a>'
   : '🔗 <a href="'+esc(item.url)+'">مطالعه کامل در مشکی‌مدیا</a>';
  const siteLink=item.platform==='youtube'?'📚 <a href="'+base+'/dizi/'+slug+'/">صفحهٔ سریال در مشکی‌مدیا</a>':'';
  const caption=[item.label+' | '+esc(record.titleFa),'<b>'+esc(title)+'</b>',esc(summary),action,siteLink,'📣 <a href="'+esc(joinUrl)+'">عضویت در کانال اختصاصی '+esc(record.titleFa)+'</a> · این پست را با علاقه‌مندان سریال به اشتراک بگذارید.','#'+record.titleFa.replace(/\s+/g,'_')].filter(Boolean).join('\n\n');
  if(dry){console.log(slug,item.id,item.url||item.question);continue;}
  try{
   let result=null;
   if(item.kind==='engagement'){
    const body={chat_id:channel,question:item.question,options:item.options,
     type:item.pollType,is_anonymous:true};
    if(item.pollType==='quiz'){
     body.correct_option_ids=item.correct_option_ids;
     body.explanation=item.explanation;
    }else{
     body.allows_multiple_answers=false;
    }
    result=await telegram('sendPoll',body);
   }
   if(!result&&item.platform!=='youtube'&&/^https:\/\//.test(item.image||''))result=await telegram('sendPhoto',{chat_id:channel,photo:item.image,caption,parse_mode:'HTML'});
   if(!result?.ok&&item.kind!=='engagement')result=await telegram('sendMessage',{chat_id:channel,text:caption,parse_mode:'HTML',link_preview_options:{is_disabled:false}});
   if(!result?.ok){console.error(slug,item.id,result?.description||'Telegram failed');break;}
   state.posted.push(item.id);
   if(item.kind==='engagement'){
    state.posted.push('engagement-day:'+today);
    state.engagementReceipts={...(state.engagementReceipts||{}),[item.id]:{
     message_id:result.result?.message_id,poll_id:result.result?.poll?.id||null,
     date:today,channel,url:'https://t.me/'+channel.slice(1)+'/'+result.result?.message_id
    }};
   }
   if(item.videoId){state.youtubeSeen=[...(state.youtubeSeen||[]),item.videoId].slice(-5000);if(item.videoSource&&state.youtubeSources?.[item.videoSource])state.youtubeSources[item.videoSource].seen=[...(state.youtubeSources[item.videoSource].seen||[]),item.videoId].slice(-5000);state.youtubePostedDates=[...(state.youtubePostedDates||[]),today].slice(-60);}
   if(item.slotKey)state.posted.push(item.slotKey);
   if(item.kind!=='engagement')state.contentHashes=[...(state.contentHashes||[]),hash(item.summary)].slice(-5000);
   state.lastSubjects={...(state.lastSubjects||{}),...(item.subject?{[item.subject]:today}:{})};
   state.updated=new Date().toISOString();
   await saveState(stateUrl,state);
   console.log(slug+' sent '+item.id);
   await new Promise(resolve=>setTimeout(resolve,1800));
  }catch(error){console.error(slug,item.id,error.message);break;}
 }
}
