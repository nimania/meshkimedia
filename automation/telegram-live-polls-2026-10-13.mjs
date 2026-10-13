// One-off channel smoke test requested 2026-10-13.
// Posts one grounded native Telegram poll per channel and writes receipts;
// a rerun must NOT repost a successfully confirmed poll.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const token=(process.env.SERIES_TELEGRAM_BOT_TOKEN||'').trim();
if(!token)throw new Error('Missing SERIES_TELEGRAM_BOT_TOKEN. No Telegram calls made.');
const dir=new URL('../github-pages/data/',import.meta.url);
const polls=[
 {
  slug:'tuzlu-kahve',channel:'@ghahvehshoor',
  question:'🧩 معمای قهوه شور | اسپویل قسمت ۱: درین چه چیزی را برای پایان رابطه با هاکان به دریا انداخت؟',
  options:['حلقهٔ نامزدی','عکس یادگاری','نامهٔ هاکان','کلید خانه'],
  type:'quiz',correct_option_id:0,is_anonymous:true,
  explanation:'پاسخ درست: حلقهٔ نامزدی. مرور کامل قسمت اول در مشکی‌مدیا: https://nimania.github.io/meshkimedia/pavaraghi/tuzlu-kahve/original-1/'
 },
 {
  slug:'muhtemel-ask',channel:'@ehtemalaneshgheh',
  question:'💞 نظرسنجی احتمالاً عشقه: دوست دارید در پاورقی بعدی بیشتر سراغ کدام گره داستان برویم؟',
  options:['استقلال و تردیدهای دفنه','گذشته و تصمیم‌های قادر','انگیزه‌های پنهان تولگا','رابطهٔ میان این سه نفر'],
  type:'regular',is_anonymous:true,allows_multiple_answers:false
 }
];
const receiptFile=new URL('telegram-live-polls-2026-10-13.json',dir);
let receipts={};
try{receipts=JSON.parse(await readFile(receiptFile,'utf8'));}catch{}
let failed=false;
for(const p of polls){
 if(receipts[p.slug]?.message_id){console.log(p.slug+': already confirmed; skip to prevent duplicates.');continue;}
 const {slug,channel,...details}=p;
 const body={chat_id:channel,...details};
 try{
  const resp=await fetch('https://api.telegram.org/bot'+token+'/sendPoll',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
  });
  const result=await resp.json();
  if(!resp.ok||!result.ok||!Number.isInteger(result.result?.message_id))
   throw new Error(result.description||'Telegram did not confirm delivery');
  receipts[slug]={
   channel,message_id:result.result.message_id,poll_id:result.result.poll?.id||null,
   url:'https://t.me/'+channel.slice(1)+'/'+result.result.message_id,
   sent_at:new Date().toISOString(),question:p.question
  };
  await mkdir(dir,{recursive:true});
  await writeFile(receiptFile,JSON.stringify(receipts,null,2)+'\n','utf8');
  console.log('DELIVERED '+slug+' '+receipts[slug].url);
 }catch(error){
  failed=true;
  console.error('FAILED '+slug+': '+error.message);
 }
}
if(failed)process.exitCode=1;
