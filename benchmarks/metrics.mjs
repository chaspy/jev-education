export function rank(probabilities) {
  return Object.entries(probabilities).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label);
}
export function wilson(successes, count) {
  if (!count) return null;
  const z = 1.96, p = successes / count, denominator = 1 + z * z / count;
  const middle = (p + z * z / (2 * count)) / denominator;
  const delta = z * Math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / denominator;
  return [middle - delta, middle + delta];
}
export function score(rows, predictionKey = 'prediction') {
  const count = rows.length;
  let top1 = 0, top3 = 0, accepted = 0, acceptedCorrect = 0, reciprocal = 0;
  const classes = new Set(rows.flatMap(r => r.expected));
  const perClass = {}, confusion = {}, errors = [];
  for (const row of rows) {
    const pred = row[predictionKey];
    const first = pred.ranked[0];
    const correct = row.expected.includes(first);
    const index = pred.ranked.slice(0, 3).findIndex(id => row.expected.includes(id));
    if (correct) top1++;
    if (index !== -1) { top3++; reciprocal += 1 / (index + 1); }
    if (!pred.abstained) { accepted++; if (correct) acceptedCorrect++; }
    const gold = row.expected[0];
    perClass[gold] ||= { total: 0, correct: 0 };
    perClass[gold].total++; if (correct) perClass[gold].correct++;
    confusion[gold] ||= {}; confusion[gold][first] = (confusion[gold][first] || 0) + 1;
    if (!correct) errors.push({ id: row.id, expected: row.expected, predicted: first, abstained: pred.abstained });
  }
  const macroF1 = [...classes].reduce((sum, label) => {
    const tp = rows.filter(r => r.expected.includes(label) && r[predictionKey].ranked[0] === label).length;
    const fp = rows.filter(r => !r.expected.includes(label) && r[predictionKey].ranked[0] === label).length;
    const fn = rows.filter(r => r.expected.includes(label) && r[predictionKey].ranked[0] !== label).length;
    return sum + (2 * tp / (2 * tp + fp + fn) || 0);
  }, 0) / (classes.size || 1);
  return { count, top1Count: top1, top1: count ? top1 / count : null, top3: count ? top3 / count : null,
    mrrAt3: count ? reciprocal / count : null, macroF1, top1Wilson95: wilson(top1, count),
    accepted, abstained: count - accepted, coverage: count ? accepted / count : null,
    selectiveAccuracy: accepted ? acceptedCorrect / accepted : null, perClass, confusion, errors };
}
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b); return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
