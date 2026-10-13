import assert from 'node:assert/strict';
import {matches,ratingsMessage,dayKey} from './series-ratings-format.mjs';
const record={slug:'muhtemel-ask',titleFa:'عشق احتمالی',ratingKey:'MUHTEMEL ASK'};
const day={date:'08.10.2026',categories:{
 total:[{rank:1,program:'SOME OTHER SHOW',rating:5.2}],
 ab:[{rank:2,program:'SOME OTHER SHOW',rating:3.2}],
 abc1:[{rank:7,program:'MUHTEMEL ASK',rating:2.97,share:9.23}]
}};
const hit=matches(day,record);
assert.deepEqual(Object.keys(hit),['abc1']);
const message=ratingsMessage(record,day,hit,'@ehtemalaneshgheh');
assert.match(message,/ریتینگ رسمی/);
assert.match(message,/ABC1/);
assert.match(message,/۲٫۹۷٪|۲\.۹۷٪/);
assert.match(message,/در فهرست ۱۰ برنامهٔ برتر ثبت نشده/);
assert.ok(!message.includes('NaN')&&!message.includes('undefined'));
assert.match(message,/https:\/\/t\.me\/ehtemalaneshgheh/);
assert.equal(dayKey(day),'2026-10-08');
const full={...day,categories:{
 total:[{rank:1,program:'TUZLU KAHVE',rating:5.44,share:15.91}],
 ab:[{rank:1,program:'TUZLU KAHVE',rating:6.76,share:20.82}],
 abc1:[{rank:1,program:'TUZLU KAHVE',rating:7.57,share:20.71}]
}};
const q=matches(full,{ratingKey:'TUZLU KAHVE'});
assert.deepEqual(Object.keys(q),['total','ab','abc1']);
assert.equal(matches(day,{ratingKey:'NOT THERE'}).total,undefined);
console.log('Series ratings Telegram tests passed: exact TIAK matches, partial category and Persian formatting.');
