// Offline tests for recurring Telegram interactions. Never calls Telegram.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {quizBank,pollBank,chooseEngagement,reservedEngagementSlot} from './series-engagement.mjs';
const series=JSON.parse(await readFile(new URL('../github-pages/data/series.json',import.meta.url),'utf8'));
const cfg={engagementEnabled:true,engagementStartDate:'2026-10-14',
 engagementSlotIndex:3,dailyHours:[9,12,15,18,21]};
const wednesday=new Date('2026-10-14T15:00:00Z');
const thursday=new Date('2026-10-15T15:00:00Z');
const saturday=new Date('2026-10-17T15:00:00Z');
const monday=new Date('2026-10-19T15:00:00Z');
for(const slug of ['tuzlu-kahve','muhtemel-ask']){
 const record=series[slug];
 assert.ok(record);
 const quizzes=quizBank(record),polls=pollBank(record);
 assert.ok(quizzes.length>=10,slug+' needs enough factual quizzes to prevent repeats');
 assert.ok(polls.length>=10,slug+' needs enough distinct audience polls');
 const unique=new Set([...quizzes,...polls].map(p=>p.id));
 assert.equal(unique.size,quizzes.length+polls.length,'Duplicate IDs');
 for(const quiz of quizzes){
  assert.equal(quiz.kind,'quiz');
  assert.ok(quiz.correct_option_ids.length===1);
  assert.ok(quiz.correct_option_ids[0]>=0&&quiz.correct_option_ids[0]<quiz.options.length);
  assert.equal(new Set(quiz.options.map(o=>o.text)).size,quiz.options.length);
  assert.ok(quiz.explanation.includes('https://nimania.github.io/meshkimedia/'));
  assert.ok(quiz.question.length<=300&&quiz.explanation.length<=200);
 }
 const first=chooseEngagement(record,cfg,{posted:[]},wednesday);
 assert.equal(first?.pollType,'quiz');
 assert.equal(first?.slotKey,'slot:2026-10-14:3');
 assert.equal(chooseEngagement(record,cfg,{posted:[]},new Date('2026-10-14T13:30:00Z')),null,'No early posting');
 assert.equal(chooseEngagement(record,cfg,{posted:[]},new Date('2026-10-13T15:00:00Z')),null,'No launch on trial day');
 assert.equal(chooseEngagement(record,cfg,{posted:[first.id]},wednesday)?.id,quizzes[1].id,'Should rotate after post');
 assert.equal(chooseEngagement(record,cfg,{posted:[first.id,first.slotKey]},wednesday),null,'Do not post twice in same scheduled slot');
 assert.equal(chooseEngagement(record,cfg,{posted:['engagement-day:2026-10-14']},wednesday),null,'Do not post twice on same day');
 const second=chooseEngagement(record,cfg,{posted:[]},thursday);
 assert.equal(second?.pollType,'regular');
 assert.equal(chooseEngagement(record,cfg,{posted:[second.id]},thursday)?.id,polls[1].id);
 assert.equal(chooseEngagement(record,cfg,{posted:[]},saturday)?.pollType,'quiz');
 assert.equal(chooseEngagement(record,cfg,{posted:[]},monday)?.pollType,'regular');
 assert.equal(chooseEngagement(record,cfg,{posted:[]},new Date('2026-10-16T15:00:00Z')),null,'No interaction Friday');
 assert.equal(reservedEngagementSlot(cfg,thursday),3);
 assert.equal(reservedEngagementSlot(cfg,new Date('2026-10-16T15:00:00Z')),null);
 assert.equal(chooseEngagement(record,{...cfg,engagementEnabled:false},{posted:[]},wednesday),null);
 const exhausted=chooseEngagement(record,cfg,{posted:quizzes.map(x=>x.id)},wednesday);
 assert.equal(exhausted,null,'Do not recycle exhausted quiz inventory');
}
console.log('Recurring quiz/poll tests PASS (verified sources, slot reservations, weekly cadence, dedupe, exhaustion).');
