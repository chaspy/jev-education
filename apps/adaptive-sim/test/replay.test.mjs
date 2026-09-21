import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='apps/adaptive-sim/';
const replay=JSON.parse(fs.readFileSync(base+'public/replay.json'));
const calls=fs.readFileSync(base+'data/jev-calls.jsonl','utf8').trim().split('\n').map(JSON.parse);
test('saved decisions match every actual API response, with no fabricated calls',()=>{
 let count=0;
 for(const frame of replay.runs.jev)for(const pupil of frame.pupils){
  const call=calls.find(c=>c.week===frame.week&&c.pupils.includes(pupil.id));
  if(pupil.decision.engine==='single'){assert.equal(call,undefined);assert.equal(pupil.decision.candidates.length,1);continue;}
  assert.ok(call);const index=call.pupils.indexOf(pupil.id),answer=call.response.answers[`next${index}`];
  assert.equal(pupil.skill,answer.choice);assert.deepEqual(pupil.decision.probabilities,answer.probabilities);count++;
 }
 assert.equal(count,replay.summary.apiQuestions);assert.equal(calls.length,replay.summary.apiCalls);
});
test('frozen simulator files remain identical to their pre-run hashes',()=>{
 for(const [path,hash] of Object.entries(replay.summary.hashes))assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,path);
});
