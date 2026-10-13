// Dependency-free test: only fixtures. This MUST NOT call Telegram or YouTube.
import assert from 'node:assert/strict';
import {classifyOfficialVideo,parseYouTubeFeed,getOfficialChannelVideos} from './series-youtube.mjs';

const channelId='UCabcdefghijklmnopqrstuv';
const video=(id,title,published='2026-10-13T12:00:00+00:00')=>
 '<entry><yt:videoId>'+id+'</yt:videoId><title>'+title+'</title><published>'+published+'</published></entry>';
const xml='<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>'+channelId+'</yt:channelId>'+
 video('ABCDEFGHIjk','Muhtemel Aşk 18. Bölüm Fragmanı')+
 video('XYZpqrstu12','Tuzlu Kahve kamera arkası')+
 video('MNOpqrstu12','Defne ve Kadir sıradan sahne')+'</feed>';
assert.equal(classifyOfficialVideo('18. Bölüm Fragmanı')?.kind,'trailer');
assert.equal(classifyOfficialVideo('18. Bölüm')?.kind,'episode');
assert.equal(classifyOfficialVideo('Setten yeni görüntüler')?.kind,'behind-scenes');
assert.equal(classifyOfficialVideo('Oyuncularla Röportaj')?.kind,'interview');
assert.equal(classifyOfficialVideo('Rastgele sahne'),null);
assert.equal(classifyOfficialVideo('فال قهوه شور - پاورقی قسمت ۳','fa')?.kind,'recap');
assert.equal(classifyOfficialVideo('قهوه شور - تیزر قسمت بعد','fa')?.kind,'trailer');
assert.equal(classifyOfficialVideo('کلیپ نامرتبط','fa'),null);

const persianXml='<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>'+channelId+'</yt:channelId>'+
 video('PPPPPPPPPPP','پاورقی قسمت ۳ سریال قهوه شور')+'</feed>';
assert.equal(parseYouTubeFeed(persianXml,channelId,'fa').length,1);
const entries=parseYouTubeFeed(xml,channelId);
assert.equal(entries.length,2);
assert.equal(entries[0].id,'ABCDEFGHIjk');
assert.equal(entries[0].kind,'trailer');
assert.throws(()=>parseYouTubeFeed(xml,'UCaaaaaaaaaaaaaaaaaaaaaa'),/mismatch/);
const visited=[];
const mockFetch=async url=>{
 visited.push(url);
 return {ok:true,text:async()=>url.includes('/feeds/')?xml:'{"externalId":"'+channelId+'"}'};
};
const response=await getOfficialChannelVideos({handle:'muhtemelaskdizi',fetcher:mockFetch});
assert.equal(response.channelId,channelId);
assert.equal(response.videos.length,2);
assert.equal(visited.length,2);
console.log('Official YouTube fixture tests passed (channel verification, classification, feed parsing).');
