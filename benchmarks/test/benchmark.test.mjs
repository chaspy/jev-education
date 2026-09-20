import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { score, wilson } from '../metrics.mjs';
import { maeRequest } from '../requests.mjs';
import { majorityRank, lexicalRank } from '../baselines.mjs';

test('question groups are disjoint and target labels/explanations never enter model state', async () => {
  const data = JSON.parse(await readFile(new URL('../data/mae.json', import.meta.url)));
  const dev = new Set(data.cases.filter(r => r.split === 'dev').map(r => r.group));
  for (const row of data.cases.filter(r => r.split === 'test')) assert.ok(!dev.has(row.group));
  assert.equal(data.cases.length + data.exclusions.length, 220);
  assert.equal(Object.keys(data.labels).length, 55);
  for (const row of data.cases) {
    const state = maeRequest(row, data.labels).state;
    assert.deepEqual(Object.keys(state).sort(), ['correctAnswer','incorrectAnswer','question']);
    assert.ok(Object.hasOwn(data.labels, row.expected[0]));
  }
});

test('metrics distinguish ranking from abstention, and no accepted cases yields null accuracy', () => {
  const rows = [
    { id: '1', expected: ['a'], prediction: { ranked: ['a','b'], abstained: false } },
    { id: '2', expected: ['a'], prediction: { ranked: ['b','a'], abstained: true } },
    { id: '3', expected: ['b'], prediction: { ranked: ['a','c','d','b'], abstained: false } }
  ];
  const s = score(rows);
  assert.equal(s.top1, 1/3); assert.equal(s.top3, 2/3); assert.equal(s.mrrAt3, 0.5);
  assert.equal(s.coverage, 2/3); assert.equal(s.selectiveAccuracy, 0.5);
  assert.equal(score([{ ...rows[0], prediction: { ranked: ['a'], abstained: true } }]).selectiveAccuracy, null);
  assert.equal(wilson(0,0), null);
  assert.ok(s.top1Wilson95[0] < s.top1 && s.top1Wilson95[1] > s.top1);
});

test('simple baselines learn no test labels', () => {
  assert.deepEqual(majorityRank([{ expected: ['b'] }], ['a','b']), ['b','a']);
  assert.equal(lexicalRank({ question: 'subtract negative integers' }, { a: 'add fractions', b: 'subtract negative integers' })[0], 'b');
});
