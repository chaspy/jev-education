import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { maeRequest, demoRequest } from './requests.mjs';
import { validateResponse, recommendation } from '../apps/learning-path/src/diagnosis.mjs';
import { rank, score, percentile } from './metrics.mjs';
import { lexicalRank, majorityRank, demoRule } from './baselines.mjs';
const root = new URL('./', import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const load = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const suite = process.argv[2];
if (!['mae', 'demo'].includes(suite)) throw new Error('Usage: node --env-file=.env benchmarks/run.mjs mae|demo');
if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is required');
const protocol = await load('protocol.json');
const data = await load(suite === 'mae' ? 'data/mae.json' : 'data/demo-regression.json');
const cases = suite === 'mae' ? data.cases.filter(c => c.split === 'test') : data.cases;
const requests = cases.map(c => suite === 'mae' ? maeRequest(c, data.labels) : demoRequest(c));
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${suite}`;
const directory = new URL(`results/${runId}/`, root);
await mkdir(directory, { recursive: true });
const meta = {
  runId, suite, startedAt: new Date().toISOString(), gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  gitDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  protocol, protocolSha256: digest(JSON.stringify(protocol)), datasetSha256: digest(JSON.stringify(data)),
  requestSetSha256: digest(JSON.stringify(requests)), expectedCases: cases.length,
  sourceFiles: Object.fromEntries(await Promise.all(['run.mjs','requests.mjs','metrics.mjs','baselines.mjs','../apps/learning-path/src/diagnosis.mjs','../apps/learning-path/public/content.js'].map(async file => [file, digest(await readFile(new URL(file, root)))])))
};
await writeFile(new URL('metadata.json', directory), JSON.stringify(meta, null, 2) + '\n');
const majority = suite === 'mae' ? majorityRank(data.cases.filter(c => c.split === 'dev'), Object.keys(data.labels)) : null;
const rows = [];
console.log(`Running ${suite}: ${cases.length} cases; requests fixed before first call; output ${directory.pathname}`);
try {
  // Sequential intentionally: stop immediately on the first failed request, preserve completed records.
  for (const [index, row] of cases.entries()) {
    const request = requests[index];
    const started = performance.now();
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request), signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${row.id}`);
    const raw = await response.json();
    const answer = validateResponse(raw, request);
    const ranked = rank(answer.probabilities);
    const abstained = suite === 'demo' ? recommendation(answer).mode === 'uncertain' : answer.confidence < 0.5 || Math.max(...Object.values(answer.probabilities)) < 0.65;
    const record = {
      id: row.id, expected: row.expected, ...(suite === 'demo' ? { shouldAbstain: row.shouldAbstain, kind: row.kind, problemId: row.problemId, recommendation: recommendation(answer) } : { group: row.group }),
      prediction: { ranked, abstained, confidence: answer.confidence }, elapsedMs: Math.round(performance.now() - started),
      request, response: raw,
      costUsd: raw.model === 'jev-1.13.0' && Number.isInteger(raw.usage?.input_tokens) ? raw.usage.input_tokens * 0.042 / 1e6 : null
    };
    if (suite === 'mae') {
      record.lexical = { ranked: lexicalRank(row.state, data.labels), abstained: false };
      record.majority = { ranked: majority, abstained: false };
    } else {
      const rule = demoRule(row.problemId, row.work);
      record.rule = { ranked: [rule], abstained: rule === 'unknown' };
    }
    rows.push(record);
    await appendFile(new URL('predictions.jsonl', directory), JSON.stringify(record) + '\n');
    if ((index + 1) % 10 === 0 || index === cases.length - 1) console.log(`${suite}: ${index + 1}/${cases.length}`);
  }
} catch (error) {
  await writeFile(new URL('failure.json', directory), JSON.stringify({ error: error.message, completed: rows.length, expected: cases.length }, null, 2));
  throw error;
}
const summary = {
  ...meta, completedAt: new Date().toISOString(), status: 'complete', jev: score(rows),
  baselines: Object.fromEntries((suite === 'mae' ? ['lexical', 'majority'] : ['rule']).map(k => [k, score(rows, k)])),
  latencyMs: { p50: percentile(rows.map(r => r.elapsedMs), 0.5), p95: percentile(rows.map(r => r.elapsedMs), 0.95) },
  totalCostUsd: rows.every(r => r.costUsd !== null) ? rows.reduce((sum,r) => sum + r.costUsd, 0) : null,
  usage: { input: rows.reduce((sum,r) => sum + (r.response.usage?.input_tokens || 0), 0), output: rows.reduce((sum,r) => sum + (r.response.usage?.output_tokens || 0), 0) }
};
if (suite === 'demo') {
  const ambiguous = rows.filter(r => r.shouldAbstain);
  summary.abstentionSafety = { shouldAbstain: ambiguous.length, actuallyAbstained: ambiguous.filter(r => r.prediction.abstained).length,
    falseAssertions: ambiguous.filter(r => !r.prediction.abstained).map(r => r.id) };
}
await writeFile(new URL('summary.json', directory), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ suite, count: summary.jev.count, top1: summary.jev.top1, top3: summary.jev.top3, coverage: summary.jev.coverage, selectiveAccuracy: summary.jev.selectiveAccuracy, totalCostUsd: summary.totalCostUsd, latencyMs: summary.latencyMs }, null, 2));
