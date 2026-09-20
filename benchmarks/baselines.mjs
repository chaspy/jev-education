// No fitted language model. Lexical comparison to the same candidate descriptions as Jev.
export function lexicalRank(state, descriptions) {
  const tokens = text => text.toLowerCase().match(/[a-z]+|\d+|[+*/=^-]/g) || [];
  const labels = Object.keys(descriptions);
  const docs = labels.map(id => tokens(descriptions[id]));
  const df = new Map();
  for (const doc of docs) for (const t of new Set(doc)) df.set(t, (df.get(t) || 0) + 1);
  const vector = words => {
    const v = new Map();
    for (const token of words) v.set(token, (v.get(token) || 0) + 1);
    for (const [t, value] of v) v.set(t, (1 + Math.log(value)) * (Math.log((docs.length + 1) / ((df.get(t) || 0) + 1)) + 1));
    return v;
  };
  const q = vector(tokens(Object.values(state).join(' ')));
  const norm = v => Math.sqrt([...v.values()].reduce((sum, x) => sum + x*x, 0)) || 1;
  return docs.map((doc, i) => {
    const d = vector(doc);
    const similarity = [...q].reduce((sum, [t, value]) => sum + value * (d.get(t) || 0), 0) / norm(q) / norm(d);
    return [labels[i], similarity];
  }).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
}
export function majorityRank(devRows, labels) {
  const counts = Object.fromEntries(labels.map(id => [id, 0]));
  for (const row of devRows) counts[row.expected[0]]++;
  return labels.toSorted((a,b) => counts[b]-counts[a] || a.localeCompare(b));
}
export function demoRule(problemId, work) {
  const s = work.normalize('NFKC').replaceAll('−','-').replace(/\s/g,'');
  const correct = { brackets: '3', negative: '-4', fractions: '9' };
  if (s.endsWith(`x=${correct[problemId]}`)) return 'correct';
  if (problemId === 'brackets' && s.includes('3x+2=15')) return 'distribution';
  if (problemId === 'brackets' && (s.includes('3x=21') || s.includes('15+6'))) return 'transpose';
  if (problemId === 'negative' && s.includes('-2x=8') && s.endsWith('x=4')) return 'signed-multiply';
  if (problemId === 'negative' && (s.includes('-2x=20') || s.includes('14+6'))) return 'transpose';
  if (problemId === 'fractions' && s.includes('x+2=15')) return 'fraction';
  return 'unknown';
}
