import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {retrieve,eligible,requestFor,validate,evaluateRanking,aggregate} from '../material-search/core.mjs';
const data=JSON.parse(await readFile(new URL('../data/material-search.json',import.meta.url)));
test('teacher contexts have disjoint topic splits and gold respects declared constraints',()=>{
 const dev=new Set(data.cases.filter(q=>q.split==='dev').map(q=>q.group));
 assert.equal(data.materials.length,40);assert.equal(data.cases.filter(q=>q.split==='test').length,34);
 for(const q of data.cases){
  if(q.split==='test')assert.ok(!dev.has(q.group));
  for(const m of data.materials)if(q.judgments[m.id].relevant)assert.ok(eligible(q.context,m));
  for(const field of ['textbook','curriculum','plan','actualLesson','masteredSkills','assignment'])assert.ok(q.context[field]);
 }
 const queries=data.cases.filter(q=>q.group==='distribution');
 assert.ok(Object.values(queries.find(q=>q.variant==='explanation').judgments).some(j=>j.relevant));
 assert.ok(!Object.values(queries.find(q=>q.variant==='unavailable').judgments).some(j=>j.relevant));
});
test('retrieval and model requests are invariant to hidden ground truth and IDs',()=>{
 const q=data.cases.find(q=>q.split==='test'),m=data.materials.slice(0,4);
 const altered={...q,id:'hidden',goldTopic:'hidden',judgments:{hidden:true}};
 assert.deepEqual(requestFor(q,m,data),requestFor(altered,m.map(x=>({...x,goldTopic:'hidden',id:'hidden'})),data));
 assert.deepEqual(retrieve(q.context,data.materials),retrieve(q.context,data.materials.map(x=>({...x,goldTopic:'hidden'}))));
 const req=requestFor(q,m,data);
 assert.equal(Object.keys(req.questions).length,4);
 const raw={model:req.model,answers:Object.fromEntries(Object.keys(req.questions).map(k=>[k,{type:'noul',noul:.8}]))};
 assert.deepEqual(validate(raw,req),raw.answers);
 assert.throws(()=>validate({...raw,answers:{fit0:{type:'noul',noul:2}}},req));
});
test('ranking evaluation separates no-match queries, exposure and constraint violations',()=>{
 const q={judgments:{a:{relevant:true,violations:[]},b:{relevant:false,violations:['time']},c:{relevant:true,violations:[]}}};
 const m=evaluateRanking(q,['b','a','c']);assert.equal(m.top1,0);assert.equal(m.successAt3,1);assert.equal(m.violations,1);assert.ok(m.ndcgAt3<1);
 const n=evaluateRanking({judgments:{b:{relevant:false,violations:[]}}},['b']);
 const s=aggregate([{metrics:{r:m}},{metrics:{r:n}}],'r');
 assert.equal(s.answerable,1);assert.equal(s.noMatch,1);assert.equal(s.noMatchFalseRecommendationRate,1);assert.equal(s.displayPrecision,.5);
 const none=evaluateRanking(q,[]);assert.equal(none.ndcgAt3,0);assert.equal(none.returned,0);
});
