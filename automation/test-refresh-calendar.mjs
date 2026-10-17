import test from "node:test";
import assert from "node:assert/strict";
import {parseCalendar,validateCalendar,fold} from "./refresh-calendar.mjs";

const series={
  "daha-17":{titleTr:"Daha 17",network:"kanal-d"},
  "mercan-kosk":{titleTr:"Mercan Köşk",network:"atv"},
  "kizilcik-serbeti":{titleTr:"Kızılcık Şerbeti",network:"show-tv"},
  "uzak-sehir":{titleTr:"Uzak Şehir",network:"kanal-d"},
};
const networks={
  "kanal-d":{name:"Kanal D",ratingKeys:["KANAL D"]},
  atv:{name:"ATV",ratingKeys:["ATV"]},
  "show-tv":{name:"Show TV",ratingKeys:["SHOW TV"]},
};
test("verified rows retain real dates, source seasons, episodes and network",()=>{
 const html='<h1>Turkish TV Calendar</h1>'
 +'<h2>Today (Saturday, Oct 17)</h2><a href="/show/mercan-kosk"><div>Mercan Köşk</div><span>Season 1, Episode 7</span> <span>ATV</span> Season Finale</a>'
 +'<h2>Sunday, Oct 18</h2><a href="/show/daha-17">Daha 17 Season 1, Episode 21 Kanal D</a>'
 +'<h2>Monday, Oct 19</h2><a href="/show/uzak-sehir">Uzak Şehir Season 3, Episode 6 Kanal D</a>'
 +'<h2>Friday, Oct 23</h2><a href="/show/kizilcik-serbeti">Kızılcık Şerbeti Season 5, Episode 6 Show TV</a>';
 const found=parseCalendar(html,series,networks,"2026-10-17");
 assert.deepEqual(found.days["2026-10-17"],[{slug:"mercan-kosk",season:1,episode:7}]);
 assert.deepEqual(found.days["2026-10-18"],[{slug:"daha-17",season:1,episode:21}]);
 assert.deepEqual(found.days["2026-10-23"],[{slug:"kizilcik-serbeti",season:5,episode:6}]);
});
test("unknown premieres stay attributed; Turkish title normalization",()=>{
 const html='<h1>Turkish TV Calendar</h1><h2>Monday, Oct 19</h2>'
 +'<a href="/show/sevdam-karadeniz">Sevdam Karadeniz Season 1, Episode 1 NOW Series Premiere</a>'
 +'<a href="/show/mercan-kosk">Mercan Köşk Season 1, Episode 7 ATV</a>';
 const found=parseCalendar(html,series,networks,"2026-10-17");
 assert.deepEqual(found.days["2026-10-19"][0],{slug:"sevdam-karadeniz",season:1,episode:1,premiere:"series"});
 assert.equal(found.shows["sevdam-karadeniz"].network,"now");
 assert.equal(fold("Kızılcık Şerbeti"),"kizilcikserbeti");
});
test("reject thin or out-of-date extracts rather than overwrite verified snapshot",()=>{
 const bad={days:{"2026-10-12":[{slug:"daha-17",season:1,episode:2}]},shows:{}};
 assert.throws(()=>validateCalendar(bad,{days:{"2026-10-16":[]}},"2026-10-17"),/incomplete\/stale/);
});
test("match calendar dates across December to January year boundary",()=>{
 const html='<h1>Turkish TV Calendar</h1><h2>Monday, Dec 28</h2><a>Uzak Şehir Season 3, Episode 16 Kanal D</a>'
 +'<h2>Monday, Jan 4</h2><a>Uzak Şehir Season 3, Episode 17 Kanal D</a>';
 const d=parseCalendar(html,series,networks,"2026-12-30").days;
 assert.ok(d["2026-12-28"]);assert.ok(d["2027-01-04"]);
});
