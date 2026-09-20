import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {summarize} from './core.mjs';
// Post-hoc descriptive analysis only; no inference, prompt edits or threshold tuning.
const directory=process.argv[2];
if(!directory) throw new Error('Usage: node benchmarks/simulation/analyze.mjs <result-directory>');
const rows=(await readFile(join(resolve(directory),'predictions.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const forced=rows.map(row=>({...row,...Object.fromEntries(['before','after'].map(k=>[k,{...row[k],ranked:row[k].ranked.filter(label=>label!=='unknown')}]))}));
const compact=rs=>{const s=summarize(rs);return {count:s.count,beforeCorrect:s.before.top1Count,afterCorrect:s.after.top1Count,before:s.before.top1,after:s.after.top1,delta:s.delta,transitions:s.transitions};};
const output={analysis:'Post-hoc: rank only the five latent profiles, excluding unknown. This is a forced ranking, not the deployed abstention decision. No new API calls.',
  all:compact(forced),byRegime:Object.fromEntries(['clean','lucky','careless'].map(regime=>[regime,compact(forced.filter(r=>r.regime===regime))]))};
await writeFile(join(resolve(directory),'forced-ranking-analysis.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
