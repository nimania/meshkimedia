// Verified TIAK top-10 ratings -> individual series Telegram channels.
// Runs immediately after build-pages-data.mjs, before the slower news/site build.
// Separate durable state per series; seed existing reports rather than backposting.
import {readFile,writeFile,rename} from 'node:fs/promises';
const root=new URL('../github-pages/data/',import.meta.url);
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
const dry=process.argv.includes('--dry-run');
const data=JSON.parse(await readFile(new URL('ratings.json',root),'utf8'));
const series=JSON.parse(await readFile(new URL('series.json',root),'utf8'));
const config=JSON.parse(await readFile(new URL('telegram-series.json',import.meta.url),'utf8'));
const source='https://tiak.com.tr/tablolar';
const modes=[['total','Total'],['ab','AB'],['abc1','ABC1']];
const fmtNumber=n=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(n);
const norm=s=>String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').replace(/ı/g,'I').replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const isoDate=str=>{
 const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(str||'');
 return m?m[3]+'-'+m[2]+'-'+m[1]:null;
};
const dayKey=d=>isoDate(d?.date)||'';
const safeWrite=async(url,obj)=>{
 const tmp=new URL(url.pathname+'.tmp',url);
 await writeFile(tmp,JSON.stringify(obj,null,2)+'\n','utf8');
 await rename(tmp,url);
};
function matches(day,record){
 const out={};const key=norm(record.ratingKey||record.titleTr);
 for(const [mode] of modes){
  const x=(day.categories?.[mode]||[]).find(row=>norm(row.program)===key);
  if(x&&Number.isInteger(x.rank)&&x.rank>=1&&x.rank<=10&&typeof x.rating==='number'&&Number.isFinite(x.rating))out[mode]=x;
 }
 return out;
}
export function ratingsMessage(record,day,rows,channel){
 const date=isoDate(day.date);
 const faDate=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(date+'T12:00:00Z'));
 const lines=['📊 <b>ریتینگ رسمی «'+esc(record.titleFa)+'»</b>',
 '📅 '+faDate+' | '+day.date,
 ''];
 for(const [mode,label] of modes){
  const x=rows[mode];
  lines.push(x?'<b>'+label+'</b>: رتبهٔ '+new Intl.NumberFormat('fa-IR').format(x.rank)+' | ریتینگ '+fmtNumber(x.rating)+' | سهم تماشا '+(Number.isFinite(x.share)?fmtNumber(x.share):'نامشخص'):'<b>'+label+'</b>: در فهرست ۱۰ برنامهٔ برتر ثبت نشده');
 }
 lines.push('','منبع: <a href="'+source+'">گزارش TİAK</a>',
 '📚 <a href="https://nimania.github.io/meshkimedia/dizi/'+encodeURIComponent(record.slug)+'/">جدول و صفحهٔ سریال در مشکی‌مدیا</a>',
 '📣 <a href="https://t.me/'+channel.slice(1)+'">عضویت در کانال اختصاصی '+esc(record.titleFa)+'</a>');
 return lines.join('\n');
}
async function send(chat,text){
 const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({chat_id:chat,text,parse_mode:'HTML',disable_web_page_preview:false}),
  signal:AbortSignal.timeout(30000)
 });
 const answer=await response.json();
 if(!response.ok||!answer.ok)throw new Error('Telegram '+response.status+': '+String(answer.description||'unknown'));
 return answer.result?.message_id;
}
const sorted=[...(data.days||[])].filter(d=>dayKey(d)&&d.hasNumbers?.total&&d.hasNumbers?.ab&&d.hasNumbers?.abc1).sort((a,b)=>dayKey(b).localeCompare(dayKey(a)));
const latest=sorted[0]?.date;
if(!latest){console.log('Ratings: no complete verified TIAK day; skip.');process.exit(0);}
for(const cfg of config.channels||[]){
 if(cfg.enabled===false||cfg.ratingsEnabled===false)continue;
 const slug=cfg.seriesSlug,record=series[slug],chat=cfg.channel;
 if(!record||!/^@[a-zA-Z0-9_]{5,}$/.test(chat||'')){console.warn('Invalid rating-channel mapping:',slug);continue;}
 const stateUrl=new URL('telegram-series-ratings-'+slug+'.json',root);
 let state=null;try{state=JSON.parse(await readFile(stateUrl,'utf8'));}catch{}
 if(!state||!state.initializedThrough){
  console.log('Ratings '+slug+': initializing through '+latest+'; old reports are not reposted.');
  if(!dry)await safeWrite(stateUrl,{initializedThrough:latest,postedDates:[],updated:new Date().toISOString()});
  continue;
 }
 const baseline=dayKey({date:state.initializedThrough});
 const last=dayKey({date:state.postedDates?.at(-1)})||baseline;
 const candidates=sorted.filter(day=>dayKey(day)>baseline&&dayKey(day)>last);
 const target=candidates.find(day=>Object.keys(matches(day,record)).length);
 if(!target){console.log('Ratings '+slug+': no new official top-10 results.');continue;}
 // Avoid blasting late backfills. An old missed report is still registered but not sent.
 const age=Date.now()-Date.parse(dayKey(target)+'T12:00:00Z');
 if(age>72*60*60*1000){
  console.log('Ratings '+slug+': old backfill '+target.date+' suppressed.');
  if(!dry)await safeWrite(stateUrl,{...state,postedDates:[...(state.postedDates||[]),target.date],updated:new Date().toISOString()});
  continue;
 }
 const message=ratingsMessage(record,target,matches(target,record),chat);
 if(dry){console.log('WOULD POST '+slug+' '+target.date+'\n'+message);continue;}
 if(!token){console.warn('Ratings '+slug+': bot secret absent; will retry.');continue;}
 try{
  const messageId=await send(chat,message);
  const next={...state,postedDates:[...(state.postedDates||[]),target.date],lastMessageId:messageId,updated:new Date().toISOString()};
  await safeWrite(stateUrl,next);
  console.log('Ratings '+slug+': SENT '+target.date+' messageId='+messageId);
 }catch(e){console.error('Ratings '+slug+': failed (will retry): '+e.message);process.exitCode=1;}
}
