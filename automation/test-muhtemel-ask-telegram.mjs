// One-time live welcome post for "Muhtemel Ask". No backlog is posted.
// Keep the marker in the published data folder so the existing workflow persists it.
import {readFile,writeFile} from 'node:fs/promises';
const channel='@ehtemalaneshgheh';
const slug='muhtemel-ask';
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
const marker=new URL('../github-pages/data/telegram-muhtemel-ask-welcome.json',import.meta.url);
try {
  const previous=JSON.parse(await readFile(marker,'utf8'));
  if(previous?.telegram_message_id){ console.log('Muhtemel Ask welcome previously sent; skipping.');process.exit(0); }
}catch{}
if(!token){console.error('Missing SERIES_TELEGRAM_BOT_TOKEN.');process.exit(1);}
const all=JSON.parse(await readFile(new URL('../github-pages/data/series.json',import.meta.url),'utf8'));
const series=all[slug];
if(!series){console.error('Missing muhtemel-ask in series.json');process.exit(1);}
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const url='https://nimania.github.io/meshkimedia/dizi/'+slug+'/';
const join='https://t.me/ehtemalaneshgheh';
const caption=[
  '💞 <b>احتمالاً عشقه | به کانال اختصاصی سریال خوش آمدید</b>',
  'از این پس تازه‌ترین خبرهای معتبر، پاورقی قسمت‌ها، معرفی بازیگران، داستان شخصیت‌ها و پرسش‌های روز را اینجا دنبال کنید.',
  '🎬 <a href="'+url+'">صفحهٔ سریال در مشکی‌مدیا</a>',
  '📣 <a href="'+join+'">لینک عضویت در کانال احتمالاً عشقه</a> — کانال را به دوستداران سریال معرفی کنید.',
  '#احتمالا_عشقه'
].join('\n\n');
async function send(method,body){
 const res=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 return res.json();
}
let result=null;
if(/^https:\/\//.test(series.hero||'')){
 result=await send('sendPhoto',{chat_id:channel,photo:series.hero,caption,parse_mode:'HTML'});
 if(!result.ok)console.log('Image delivery failed; using text with webpage preview.');
}
if(!result?.ok)result=await send('sendMessage',{chat_id:channel,text:caption,parse_mode:'HTML',link_preview_options:{is_disabled:false}});
if(!result?.ok){console.error('Telegram welcome failed: '+String(result?.description||'unknown error'));process.exit(1);}
await writeFile(marker,JSON.stringify({channel,slug,telegram_message_id:result.result?.message_id,confirmed_at:new Date().toISOString()},null,2)+'\n');
console.log('Muhtemel Ask welcome SENT to '+channel+'; message_id='+result.result?.message_id);
