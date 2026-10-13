// Poll the YouTube Atom feed of one explicitly configured official series channel.
// No YouTube API key, no unofficial search and no video download/reupload.
const idPattern=/^UC[A-Za-z0-9_-]{22}$/;
const videoPattern=/^[A-Za-z0-9_-]{11}$/;
const decode=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(amp|lt|gt|quot|apos);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x]));
const tag=(xml,name)=>decode(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'').trim();
const safeFetch=async(url,fetcher)=>{
 const res=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; MeshkiMedia/1.0; +https://nimania.github.io/meshkimedia/)','accept':'application/atom+xml,text/xml,text/html;q=0.8'},signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw new Error('HTTP '+res.status+' fetching official YouTube source');
 return res.text();
};
export function classifyOfficialVideo(title){
 const t=title.toLocaleLowerCase('tr-TR');
 if(/fragman|tanıtım|tanitim|teaser|trailer|ön izleme|on izleme/.test(t))return {kind:'trailer',label:'🎬 تیزر رسمی تازه',description:'تیزر تازهٔ سریال در یوتیوب رسمی منتشر شده است.'};
 if(/kamera arkası|kamera arkasi|setten|behind the scenes|çekim arkası/.test(t))return {kind:'behind-scenes',label:'🎥 پشت‌صحنهٔ رسمی',description:'ویدئوی تازه‌ای از پشت‌صحنهٔ سریال منتشر شده است.'};
 if(/röportaj|roportaj|söyleşi|soylesi|oyuncularla|interview/.test(t))return {kind:'interview',label:'🎤 گفت‌وگو با عوامل یا بازیگران',description:'گفت‌وگوی تازه‌ای در کانال رسمی سریال منتشر شده است.'};
 if(/\b(?:bölüm|bolum|episode)\b/.test(t)&&!/sahne|sahneler|özet|ozet|kesit|tanıtım|fragman/.test(t))return {kind:'episode',label:'📺 قسمت کامل در یوتیوب',description:'قسمت تازه‌ای در کانال رسمی سریال قرار گرفته است.'};
 return null; // avoid flooding channels with dozens of recycled scenes / shorts
}
export function parseYouTubeFeed(xml,expectedId=''){
 if(!/<feed[\s>]/.test(xml))throw new Error('Not a valid YouTube Atom feed');
 const channel=tag(xml,'yt:channelId');
 if(expectedId&&channel&&expectedId!==channel)throw new Error('YouTube channel ID mismatch');
 return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>{
  const entry=m[1],id=tag(entry,'yt:videoId'),title=tag(entry,'title'),published=tag(entry,'published');
  const kind=classifyOfficialVideo(title);
  if(!videoPattern.test(id)||!title||!Number.isFinite(Date.parse(published))||!kind)return null;
  return {id,title,published,channel,videoUrl:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',...kind};
 }).filter(Boolean).sort((a,b)=>b.published.localeCompare(a.published));
}
export async function getOfficialChannelVideos({handle,channelId,fetcher=fetch}){
 let resolved=channelId;
 if(!resolved){
  if(!/^[a-zA-Z0-9._-]{3,60}$/.test(handle||''))throw new Error('Invalid configured YouTube handle');
  const html=await safeFetch('https://www.youtube.com/@'+encodeURIComponent(handle),fetcher);
  // On actual channel HTML, externalId is the immutable current page's channel ID.
  const match=html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/)||
   html.match(/<meta\s+itemprop="channelId"\s+content="(UC[A-Za-z0-9_-]{22})"/)||
   html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/);
  resolved=match?.[1];
 }
 if(!idPattern.test(resolved||''))throw new Error('Could not verify official YouTube channel ID for @'+handle);
 const xml=await safeFetch('https://www.youtube.com/feeds/videos.xml?channel_id='+resolved,fetcher);
 return {channelId:resolved,videos:parseYouTubeFeed(xml,resolved)};
}
