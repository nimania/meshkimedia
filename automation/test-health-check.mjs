import test from "node:test";
import assert from "node:assert/strict";
import { assessLiveData } from "./health-check.mjs";

const NOW = new Date("2026-10-17T09:00:00Z");
function fixture() {
 return {
  home:true,
  news:{items:[{published:"2026-10-17T04:29:31.000Z"}]},
  ratings:{days:[{date:"15.10.2026"}]},
  calendar:{source:{checkedAt:"2026-10-17"},days:{
   "2026-10-17":[{slug:"x"}], "2026-10-23":[{slug:"y"}],
  }},
 };
}
test("current news, verified TİAK and future calendar are healthy",()=>{
 const r=assessLiveData(fixture(),NOW);
 assert.equal(r.status,"healthy");
 assert.equal(r.checks.length,4);
});
test("ratings get a weekend-aware grace period",()=>{
 const x=fixture();x.ratings.days=[{date:"13.10.2026"}];
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="ratings").level,"warning");
 x.ratings.days=[{date:"09.10.2026"}];
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="ratings").level,"critical");
});
test("news can stall even if archive remains populated",()=>{
 const x=fixture();x.news.items=[{published:"2026-10-14T04:00:00Z"}];
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="news").level,"critical");
});
test("calendar end date and last checked timestamp are both monitored",()=>{
 const x=fixture(); x.calendar.days={"2026-10-15":[{}]};
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="calendar").level,"critical");
 x.calendar.days={"2026-10-23":[{}]};x.calendar.source.checkedAt="2026-10-14";
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="calendar").level,"warning");
});
test("unavailable homepage or corrupt JSON is critical",()=>{
 const x=fixture();x.home=false;x.news=null;
 const r=assessLiveData(x,NOW);
 assert.equal(r.status,"critical");
 assert.deepEqual(r.checks.filter(x=>x.level==="critical").map(x=>x.key),["site","news"]);
});
test("validate malformed ISO-like calendar dates without crashing",()=>{
 const x=fixture();x.calendar.source.checkedAt="unknown";x.calendar.days={"bad":[{}]};
 assert.equal(assessLiveData(x,NOW).checks.find(x=>x.key==="calendar").level,"critical");
});
