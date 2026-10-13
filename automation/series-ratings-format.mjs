// Pure, testable TIAK report formatter and exact-name lookup.
const source='https://tiak.com.tr/tablolar';
const modes=[['total','Total'],['ab','AB'],['abc1','ABC1']];
const fmtNumber=n=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(n);
const norm=s=>String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').replace(/ı/g,'I').replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export const isoDate=str=>{
 const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(str||'');
 return m?m[3]+'-'+m[2]+'-'+m[1]:null;
};
export const dayKey=d=>isoDate(d?.date)||'';
export function matches(day,record){
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
  lines.push(x?'<b>'+label+'</b>: رتبهٔ '+new Intl.NumberFormat('fa-IR').format(x.rank)+' | ریتینگ '+fmtNumber(x.rating)+'٪ | سهم تماشا '+(Number.isFinite(x.share)?fmtNumber(x.share)+'٪':'نامشخص'):'<b>'+label+'</b>: در فهرست ۱۰ برنامهٔ برتر ثبت نشده');
 }
 lines.push('','منبع: <a href="'+source+'">گزارش TİAK</a>',
 '📚 <a href="https://nimania.github.io/meshkimedia/dizi/'+encodeURIComponent(record.slug)+'/">صفحهٔ سریال در مشکی‌مدیا</a>',
 '📣 <a href="https://t.me/'+channel.slice(1)+'">عضویت در کانال اختصاصی '+esc(record.titleFa)+'</a>');
 return lines.join('\n');
}
