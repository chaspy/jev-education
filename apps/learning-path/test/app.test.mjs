import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { skills, skillById, problems } from '../public/content.js';
import { parseNumericAnswer } from '../public/math.js';
import { buildRequest, recommendation, validateResponse } from '../src/diagnosis.mjs';
import worker from '../src/worker.mjs';

const env = { TYPESAFE_API_KEY: 'test-secret', RATE_LIMITER: { limit: async () => ({ success: true }) }, GLOBAL_LIMITER: { limit: async () => ({ success: true }) } };
const req = (input, headers = {}) => new Request('https://example.test/api/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) });
const answer = (choice, confidence = 0.95) => ({ type: 'choice', choice, confidence, probabilities: { [choice]: 0.95, unknown: 0.05 } });

test('graph is acyclic; every lesson has verifiable curriculum attribution and practice', async () => {
  const data = JSON.parse(await readFile(new URL('../data/curriculum.json', import.meta.url)));
  const ids = new Set(data.items.map(x => x.id));
  const walk = (id, parents = []) => {
    assert.ok(skillById[id]); assert.ok(!parents.includes(id), `cycle at ${id}`);
    skillById[id].prerequisites.forEach(p => walk(p, [...parents, id]));
  };
  for (const skill of skills) {
    walk(skill.id); assert.ok(ids.has(skill.source));
    assert.ok(skill.check.choices[skill.check.answer]); assert.equal(skill.practice.length, 2);
  }
  for (const problem of problems) {
    assert.ok(skillById[problem.skill]); problem.candidates.forEach(id => assert.ok(skillById[id]));
  }
});

test('uncertain and unsupported answers do not automatically choose a remedial skill', () => {
  assert.equal(recommendation(answer('distribution')).skillId, 'distribution');
  assert.equal(recommendation(answer('distribution', 0.2)).mode, 'uncertain');
  assert.equal(recommendation(answer('unknown')).skillId, null);
  assert.equal(recommendation(answer('correct')).mode, 'correct');
  assert.equal(recommendation(answer('incomplete')).mode, 'incomplete');
});

test('numeric checking handles fractions and Unicode without evaluating arbitrary code', () => {
  assert.equal(parseNumericAnswer('ｘ＝−４'), -4);
  assert.equal(parseNumericAnswer('x = 6/2'), 3);
  assert.equal(parseNumericAnswer('1/0'), null);
  assert.equal(parseNumericAnswer('alert(1)'), null);
  assert.equal(parseNumericAnswer('3abc'), null);
});

test('server validates input, missing key, foreign origins and rate limits before inference', async () => {
  for (const input of [null, {}, { problemId: 'bad', work: 'x=3' }, { problemId: 'brackets', work: ' '.repeat(10) }, { problemId: 'brackets', work: 'x'.repeat(2001) }]) {
    assert.equal((await worker.fetch(req(input), env)).status, 400);
  }
  const input = { problemId: 'brackets', work: '3x+2=15' };
  assert.equal((await worker.fetch(req(input, { Origin: 'https://evil.test' }), env)).status, 403);
  assert.equal((await worker.fetch(req(input), { ...env, TYPESAFE_API_KEY: '' })).status, 503);
  assert.equal((await worker.fetch(req(input), { ...env, RATE_LIMITER: undefined })).status, 503);
  assert.equal((await worker.fetch(req(input), { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal((await worker.fetch(req(input), { ...env, GLOBAL_LIMITER: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal((await worker.fetch(req({ work: 'x'.repeat(17000) }), env)).status, 413);
});

test('API requests use trusted problem data; successful response exposes no secret and logs no work', async t => {
  const input = { problemId: 'brackets', work: '3x+2=15\nx=13/3' };
  const request = buildRequest(input.problemId, input.work);
  const probabilities = Object.fromEntries(Object.keys(request.questions.diagnosis.criteria).map(k => [k, k === 'distribution' ? 1 : 0]));
  const data = { model: 'jev-1.13.0', answers: { diagnosis: { type: 'choice', choice: 'distribution', confidence: 1, probabilities } }, usage: { input_tokens: 1000, output_tokens: 70 } };
  const logs = [];
  t.mock.method(console, 'log', s => logs.push(s));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.deepEqual(JSON.parse(options.body), request);
    return Response.json(data);
  });
  const response = await worker.fetch(req(input), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.recommendation.skillId, 'distribution');
  assert.equal(body.costUsd, 0.000042);
  assert.deepEqual(body.response, data);
  assert.ok(!JSON.stringify(body).includes('test-secret'));
  assert.ok(!logs.join('').includes(input.work));
  assert.ok(!logs.join('').includes('test-secret'));
});

test('upstream failures and malformed probabilities produce explicit errors', async t => {
  const input = { problemId: 'brackets', work: 'x=3' };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'private vendor error' }, { status: 401 }));
  assert.equal((await worker.fetch(req(input), env)).status, 502);
  assert.throws(() => validateResponse({ answers: { diagnosis: answer('made-up') } }, buildRequest(input.problemId, input.work)));
});
