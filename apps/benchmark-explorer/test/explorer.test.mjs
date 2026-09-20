import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import '../public/model.js';
const root=new URL('../public/',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const payload=await read('data.js');
const data=JSON.parse(payload.replace(/^window\.BENCHMARK_DATA = /,'').trim().replace(/;$/,''));
const {selected,selectionSummary,stageIds}=globalThis.ExperimentModel;
test('explorer selection at the frozen cutoff matches recorded benchmark counts',()=>{
 assert.equal(data.cases.length,34);assert.equal(data.rows.length,34);assert.equal(data.materials.length,40);assert.equal(data.calls.length,25);
 const actual=selectionSummary(data.rows,.65);
 assert.deepEqual(actual,{answerable:24,top1:20,success:20,shown:29,relevantShown:26,noMatch:10,falseRecommendations:0});
 for(const row of data.rows)assert.deepEqual(selected(row,.65),row.output.jevSelected);
 const raw=selectionSummary(data.rows,0);assert.equal(raw.top1,21);assert.equal(raw.shown,60);assert.equal(raw.falseRecommendations,2);
});
test('threshold only removes saved candidates and absent calls never receive invented predictions',()=>{
 for(const row of data.rows){
  for(const cutoff of [0,.2,.65,.9,1]){
   const ids=selected(row,cutoff);assert.ok(ids.length<=3);
   for(const id of ids)assert.ok(row.ranked.some(r=>r.id===id&&r.probability>=cutoff));
  }
  if(!row.candidates.length){assert.equal(data.calls.some(c=>c.queryId===row.id),false);assert.deepEqual(selected(row,0),[]);}
  assert.deepEqual(stageIds(row,data.materials,1,.65),row.shortlist.map(m=>m.id));
 }
});
test('standalone HTML contains current scripts with matching CSP hashes and no external assets',async()=>{
 const html=await read('standalone.html');
 for(const file of ['data.js','model.js','app.js']){
  const source=await read(file);assert.ok(html.includes(`<script>${source}</script>`));
  assert.ok(html.includes(`sha256-${createHash('sha256').update(source).digest('base64')}`));
 }
 assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/<link[^>]+stylesheet/.test(html));
});
