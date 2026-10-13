// Source-grounded recurring quiz/poll candidates for the existing five-post schedule.
// Wed/Sat: quiz; Mon/Thu: opinion poll. Telegram accepts correct_option_ids as an array.
const weekdays={1:'regular',3:'quiz',4:'regular',6:'quiz'};
const dateParts=now=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=k=>parts.find(x=>x.type===k)?.value;
 const date=part('year')+'-'+part('month')+'-'+part('day');
 return {date,hour:Number(part('hour')),weekday:new Date(date+'T12:00:00Z').getUTCDay()};
};
const roleName=x=>String(x.roleFa||x.role||'').trim();
const actorName=x=>String(x.nameFa||x.name||'').trim();
const makeOptions=(id,value,others)=>{
 const unique=[value,...others.filter(x=>x&&x!==value)];
 const options=[...new Set(unique)].slice(0,4);
 const seed=[...id].reduce((n,ch)=>n+ch.codePointAt(0),0);
 const shift=seed%options.length;
 return options.slice(shift).concat(options.slice(0,shift)).map(text=>({text}));
};
const nativeQuiz=(id,question,correct,distractors,source)=>{
 const options=makeOptions(id,correct,distractors);
 if(options.length<3)return null;
 const explanation='✅ پاسخ: '+correct+'. اطلاعات بازیگران و داستان بر اساس منابع ثبت‌شده در مشکی‌مدیا: '+source;
 return {id,kind:'quiz',question,options,correct_option_ids:[options.findIndex(x=>x.text===correct)],
  explanation:explanation.slice(0,200)};
};
export function quizBank(record){
 const cast=(record.cast||[]).filter(x=>x.personSlug&&actorName(x)&&roleName(x));
 const source='https://nimania.github.io/meshkimedia/dizi/'+record.slug+'/';
 const out=[];
 for(const actor of cast){
  const others=cast.filter(x=>x.personSlug!==actor.personSlug);
  const q1=nativeQuiz('engagement:quiz:actor:'+actor.personSlug,
   '🎭 در سریال «'+record.titleFa+'» چه کسی نقش «'+roleName(actor)+'» را بازی می‌کند؟',
   actorName(actor),others.map(actorName),source);
  if(q1)out.push(q1);
  const q2=nativeQuiz('engagement:quiz:role:'+actor.personSlug,
   '🧩 '+actorName(actor)+' در سریال «'+record.titleFa+'» نقش کدام شخصیت را دارد؟',
   roleName(actor),others.map(roleName),source);
  if(q2)out.push(q2);
 }
 if(record.slug==='tuzlu-kahve'){
  const extra=[
   ['return','طبق معرفی داستان، کدام شخصیت پس از سال‌ها زندگی در خارج به ترکیه برمی‌گردد؟','محمد','درین','هاکان','فریال'],
   ['breakup','در ابتدای داستان، درین رابطه‌اش را با چه کسی قطع می‌کند؟','هاکان','محمد','مراد','فریال'],
   ['wedding','در داستان، چه کسی برادر محمد است؟','مراد','هاکان','درین','فریال'],
   ['families','نام خانوادگی محمد چیست؟','آیدین‌اوغلو','کوتایگیل','ایپکلی','بارتینر'],
   ['derin-family','درین به کدام خانواده تعلق دارد؟','کوتایگیل','ایپکلی','آیدین‌اوغلو','بارتینر']
  ];
  for(const [id,question,...choices] of extra){
   const q=nativeQuiz('engagement:quiz:story:'+id,'🧩 قهوه شور | '+question,choices[0],choices.slice(1),source);
   if(q)out.push(q);
  }
 }
 return out.filter(x=>x.options.every(o=>o.text.length<=100)&&x.question.length<=300);
}
const polls={
 'tuzlu-kahve':[
  ['family','☕ در قهوه شور، کدام بخش داستان برایتان جذاب‌تر است؟',['گذشتهٔ خانواده‌ها','آیندهٔ درین و محمد','تصمیم‌های نسل جوان','رقابت‌ها و سوءتفاهم‌ها']],
  ['trust','💬 به نظر شما برای بازسازی اعتماد در یک رابطه چه چیزی مهم‌تر است؟',['صداقت','زمان','گفت‌وگو','تغییر رفتار']],
  ['choice','💞 در داستان درین، کدام کشمکش برایتان مهم‌تر است؟',['انتخاب شخصی یا خانواده','اعتماد یا تردید','گذشته یا آینده','استقلال یا انتظار دیگران']],
  ['focus','🎭 دوست دارید در تحلیل بعدی قهوه شور سراغ چه کسی برویم؟',['درین','محمد','فریال','رابطهٔ دو خانواده']],
  ['discussion','📖 از پاورقی‌های قهوه شور چه چیزی بیشتر می‌خواهید؟',['جزئیات داستان','شناخت شخصیت‌ها','یادآوری آنچه گذشت','پیش‌بینی با برچسب اسپویل']],
  ['romance','💞 به نظرتان جذاب‌ترین عنصر یک داستان عاشقانه چیست؟',['شخصیت‌پردازی','گفت‌وگوهای قوی','چالش‌های خانوادگی','غافلگیری‌های منطقی']],
  ['conflict','🧩 کدام گره داستانی را دوست دارید بیشتر باز کنیم؟',['چرا اختلاف خانواده‌ها؟','تغییر نگاه درین','بازگشت محمد','نقش بزرگ‌ترهای خانواده']],
  ['format','📺 دوست دارید پست‌های کانال بیشتر چه فرمتی داشته باشند؟',['نظرسنجی و کوییز','خبرهای موثق','پاورقی داستان','معرفی بازیگران']],
  ['spoiler','🔮 درباره پست‌های پیش‌بینی قسمت بعد چه ترجیحی دارید؟',['کاملاً بدون اسپویل','با هشدار اسپویل','فقط تیزر رسمی','ترکیبی از هر سه']],
  ['moral','💬 اگر جای درین بودید، در تصمیم بزرگ زندگی چه چیزی اولویت داشت؟',['اعتماد به خود','مشورت با خانواده','آرامش و امنیت','فرصت برای فکرکردن']],
  ['cast','🎬 کدام بازیگر قهوه شور را بیشتر دنبال می‌کنید؟',['ادا اجه','بوغرا گولسوی','نباهت چهره','همهٔ بازیگران']],
  ['future','📖 در ادامه قهوه شور بیشتر منتظر چه نوع صحنه‌ای هستید؟',['رویارویی خانوادگی','گفت‌وگوی صادقانه','تصمیم مستقل','غافلگیری داستانی']]
 ],
 'muhtemel-ask':[
  ['triangle','💞 کدام ضلع داستان احتمالاً عشقه بیشتر کنجکاوتان کرده؟',['تصمیم‌های دفنه','گذشتهٔ قادر','انگیزه‌های تولگا','روابط هر سه']],
  ['independence','💬 در یک داستان عاشقانه، کدام ویژگی شخصیت اصلی مهم‌تر است؟',['استقلال','صداقت','شجاعت','قدرت تغییر']],
  ['future','🔮 بدون ادعای پیش‌بینی قطعی: دوست دارید دفنه در ادامه چه کند؟',['بیشتر به خودش فکر کند','با دیگران صادق باشد','گذشته را روشن کند','برای تصمیم عجله نکند']],
  ['kadir','🎭 کدام جنبهٔ قادر را بیشتر دوست دارید بررسی کنیم؟',['مسئولیت خانوادگی','تصمیم‌های احساسی','رفتار با دفنه','گذشتهٔ شخصیت']],
  ['tolga','🧩 دربارهٔ تولگا کدام سؤال برایتان جالب‌تر است؟',['هدف‌های پنهانش','گذشته و انگیزه‌ها','احساسش به دفنه','تغییر شخصیت او']],
  ['format','📺 از کانال احتمالاً عشقه بیشتر چه محتوایی می‌خواهید؟',['روایت قسمت‌ها','کوییز و نظرسنجی','پشت‌صحنه و بازیگران','خبر و ریتینگ']],
  ['topic','💞 در پاورقی بعدی کدام بحث را بیشتر بپردازیم؟',['عشق و استقلال','خانواده و مسئولیت','اعتماد و تردید','انتخاب‌های سخت']],
  ['emotion','💬 کدام ویژگی یک رابطه برایتان مهم‌تر است؟',['اعتماد','گفت‌وگو','آزادی فردی','وفاداری']],
  ['character','🎭 دوست دارید در پست بعدی به چه شخصیتی بیشتر بپردازیم؟',['دفنه','قادر','تولگا','ملیس']],
  ['speculation','🔮 برای مطالب آینده کدام سبک پیش‌بینی را ترجیح می‌دهید؟',['بر اساس تیزر رسمی','تحلیل رفتار شخصیت‌ها','نظرسنجی مخاطبان','بدون پیش‌بینی']],
  ['partnership','🧩 در رابطه دفنه و همکارانش، کدام موضوع جذاب‌تر است؟',['اعتماد بین شرکا','حمایت دوستان','تصمیم‌های حرفه‌ای','تعادل کار و زندگی']],
  ['actors','🎬 کدام بازیگر را در یک معرفی اختصاصی بشناسیم؟',['آیچا آیشین توران','اکین کوچ','فیاض شریف‌اوغلو','جانسل الچین']]
 ]
};
export function pollBank(record){
 const bank=polls[record.slug]||[];
 return bank.map(([key,question,answers])=>({
  id:'engagement:poll:'+key,kind:'regular',question,
  options:answers.map(text=>({text})),is_anonymous:true,allows_multiple_answers:false
 })).filter(x=>x.options.length>=2&&x.options.length<=12&&x.options.every(o=>o.text.length<=100)&&x.question.length<=300);
}
export function chooseEngagement(record,cfg,state,now=new Date()){
 if(!cfg.engagementEnabled)return null;
 const {date,hour,weekday}=dateParts(now);
 if(cfg.engagementStartDate&&date<cfg.engagementStartDate)return null;
 const kind=weekdays[weekday];
 const slot=Number.isInteger(cfg.engagementSlotIndex)?cfg.engagementSlotIndex:3;
 const slots=Array.isArray(cfg.dailyHours)?cfg.dailyHours:[9,12,15,18,21];
 if(!kind||!Number.isFinite(slots[slot])||hour<Number(slots[slot]))return null;
 const slotKey='slot:'+date+':'+slot;
 const posted=new Set(state.posted||[]);
 if(posted.has(slotKey)||posted.has('engagement-day:'+date))return null;
 const bank=kind==='quiz'?quizBank(record):pollBank(record);
 const candidate=bank.find(x=>!posted.has(x.id));
 return candidate?{...candidate,slotKey,date,kind:'engagement',pollType:candidate.kind}:null;
}
export function reservedEngagementSlot(cfg,now=new Date()){
 if(!cfg.engagementEnabled)return null;
 const {date,weekday}=dateParts(now);
 if(cfg.engagementStartDate&&date<cfg.engagementStartDate)return null;
 return weekdays[weekday]?Number.isInteger(cfg.engagementSlotIndex)?cfg.engagementSlotIndex:3:null;
}
