import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialRequest,followupRequest,probeRule,summarize} from '../simulation/core.mjs';
const data=JSON.parse(await readFile(new URL('../data/synthetic-followup.json',import.meta.url)));
test('all synthetic branches are fixed, wrong initial answers and balanced profiles',()=>{
  assert.equal(data.cases.length,90);
  assert.equal(new Set(data.cases.map(r=>r.group)).size,30);
  for(const label of Object.keys(data.labels)) assert.equal(data.cases.filter(r=>r.expected[0]===label).length,18);
  for(const row of data.cases) {
    assert.notEqual(row.initial.studentAnswer,row.initial.correctAnswer);
    assert.deepEqual(Object.keys(row.responses),data.probes.map(p=>p.id));
    for(const p of data.probes) {
      const r=row.responses[p.id];
      assert.equal(r.correct,r.answer===p.correctAnswer);
      if(row.hidden.regime==='clean') assert.equal(r.correct,!row.hidden.weakSkills.includes(p.skill));
    }
  }
});
test('hidden truth and unselected answers cannot enter either inference stage',()=>{
  for(const row of data.cases) {
    const altered=structuredClone(row);
    altered.expected=['injected'];altered.hidden={injected:true};altered.id='injected';altered.group='injected';
    assert.deepEqual(initialRequest(row,data),initialRequest(altered,data));
    for(const p of data.probes) {
      for(const other of data.probes.filter(x=>x.id!==p.id)) altered.responses[other.id]={answer:'injected',correct:false};
      altered.responses[p.id]=row.responses[p.id];
      assert.deepEqual(followupRequest(row,data,p.id),followupRequest(altered,data,p.id));
      assert.deepEqual(Object.keys(followupRequest(row,data,p.id).state),['initial','followup']);
    }
    assert.deepEqual(Object.keys(initialRequest(row,data).state),['initial']);
  }
});
test('simple rule uses observed selected response; paired deltas count regressions too',()=>{
  const row=data.cases[0],other={...row,expected:['slip'],hidden:{}};
  assert.deepEqual(probeRule(row,data,'p1'),probeRule(other,data,'p1'));
  const pred=label=>({ranked:[label],abstained:false});
  const rows=[{id:'a',expected:['distribution'],before:pred('slip'),after:pred('distribution'),rule:pred('distribution')},
    {id:'b',expected:['signed'],before:pred('signed'),after:pred('slip'),rule:pred('slip')}];
  assert.deepEqual(summarize(rows).transitions,{improved:1,worsened:1,bothCorrect:0,bothWrong:0});
  assert.equal(summarize(rows).delta,0);
});
