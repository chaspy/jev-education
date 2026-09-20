import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const source = await readFile(new URL('data/mae-source.json', root));
const rows = JSON.parse(source);
const hash = text => createHash('sha256').update(text).digest('hex');
const labels = Object.fromEntries(rows.map(r => [r['Misconception ID'], r.Misconception.trim()]));
const cases = [], exclusions = [];
for (const row of rows) {
  const id = `${row['Misconception ID']}-ex${row['Example Number']}`;
  const imageFields = ['Question image', 'Learner Answer image', 'Correct Answer image'].filter(k => String(row[k] || '').trim());
  if (imageFields.length) { exclusions.push({ id, reason: 'image_required', fields: imageFields }); continue; }
  const state = { question: row.Question, incorrectAnswer: row['Incorrect Answer'], correctAnswer: row['Correct Answer'] };
  if (Object.values(state).some(x => typeof x !== 'string' || !x.trim())) { exclusions.push({ id, reason: 'missing_text' }); continue; }
  const group = hash(state.question.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim());
  cases.push({ id, group, split: parseInt(group.slice(0, 8), 16) % 5 === 0 ? 'dev' : 'test', expected: [row['Misconception ID']], state });
}
const manifest = {
  dataset: 'MaE (Math Misconceptions and Errors)',
  source: 'https://github.com/nancyotero-projects/math-misconceptions',
  revision: '12bee142d49dfb3c874149035cfbad28547a818b',
  sourceSha256: hash(source), license: 'MIT', licenseFile: 'data/MAE-LICENSE',
  authors: 'Nancy Otero, Stefania Druga, Andrew Lan',
  rawRows: rows.length, eligibleRows: cases.length, excludedRows: exclusions.length,
  devRows: cases.filter(c => c.split === 'dev').length, testRows: cases.filter(c => c.split === 'test').length,
  splitPolicy: 'SHA256(NFKC lowercase whitespace-normalized question), first 8 hex digits modulo 5 = 0 -> dev; others -> test. No post-result reassignment.',
  inputFields: ['Question', 'Incorrect Answer', 'Correct Answer'],
  excludedInputFields: ['Misconception ID', 'Misconception (row label)', 'Topic', 'Explanation', 'Source', 'Example Number'],
  notes: ['Original English. No Japanese translation.', '55 descriptions are shared candidate definitions; per-row label and explanation never enter state.', 'Image-bearing rows conservatively excluded. No outcome-based filtering or gold-label repairs.', 'Held out from this project development only; model training contamination is unknown.']
};
await writeFile(new URL('data/mae.json', root), JSON.stringify({ manifest, labels, cases, exclusions }, null, 2) + '\n');
console.log(manifest);
