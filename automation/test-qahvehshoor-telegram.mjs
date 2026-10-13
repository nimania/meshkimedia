// One-time live channel delivery check. Persist a marker only after Telegram confirms success.
import {readFile,writeFile} from 'node:fs/promises';
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
const chat='@ghahvehshoor';
const marker=new URL('../github-pages/data/telegram-qahvehshoor-test.json',import.meta.url);
try{await readFile(marker,'utf8');console.log('Qahveh Shoor test already confirmed; skipping.');process.exit(0);}catch{}
if(!token){console.error('Missing SERIES_TELEGRAM_BOT_TOKEN');process.exit(1);}
const image='https://static.sayidaty.net/2026-08/506804.jpg';
const url='https://nimania.github.io/meshkimedia/dizi/tuzlu-kahve/';
const caption='☕️ <b>قهوه شور | به کانال اختصاصی سریال خوش آمدید</b>\n\nاز این پس خبرهای تازه، پاورقی قسمت‌های اصلی و دوبلهٔ فارسی و مطالب مربوط به سریال را همین‌جا دنبال کنید.\n\n🔗 <a href="'+url+'">صفحه اختصاصی قهوه شور در مشکی‌مدیا</a>\n\n#قهوه_شور';
async function send(method,payload){
 const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 return response.json();
}
let result=await send('sendPhoto',{chat_id:chat,photo:image,caption,parse_mode:'HTML'});
if(!result.ok){console.log('Image delivery unavailable; trying link-preview text.');result=await send('sendMessage',{chat_id:chat,text:caption,parse_mode:'HTML',link_preview_options:{is_disabled:false}});}
if(!result.ok){console.error('Qahveh Shoor test failed: '+String(result.description||'unknown Telegram error'));process.exit(1);}
await writeFile(marker,JSON.stringify({channel:chat,telegram_message_id:result.result?.message_id,confirmed_at:new Date().toISOString()},null,2)+'\n');
console.log('Qahveh Shoor test SENT: message_id='+result.result?.message_id);
