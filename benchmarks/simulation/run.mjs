import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {initialRequest,followupRequest,prediction,probeRule,summarize} from './core.mjs';
import {validateResponse} from '../../apps/learning-path/src/diagnosis.mjs';
import {percentile} from '../metrics.mjs';
const root=new URL('./',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
if(!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY required');
const data=await read('../data/synthetic-followup.json');
const protocol=await read('protocol.json');
const runId=`${new Date().toISOString().replaceAll(':','-')}-simulation`;
const directory=new URL(`../results/${runId}/`,root);
await mkdir(directory,{recursive:true});
// Freeze every possible branch before the first request. Selection never sees answers.
const requestPlans=data.cases.map(row=>({initial:initialRequest(row,data),followups:Object.fromEntries(data.probes.map(p=>[p.id,followupRequest(row,data,p.id)]))}));
const metadata={runId,startedAt:new Date().toISOString(),protocol,
  gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  gitDirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
  dataSha256:sha(JSON.stringify(data)),protocolSha256:sha(JSON.stringify(protocol)),requestPlansSha256:sha(JSON.stringify(requestPlans)),
  sourceFiles:Object.fromEntries(await Promise.all(['prepare.mjs','core.mjs','run.mjs','../metrics.mjs','../../apps/learning-path/src/diagnosis.mjs'].map(async p=>[p,sha(await readFile(new URL(p,root)))])))};
await writeFile(new URL('metadata.json',directory),JSON.stringify(metadata,null,2)+'\n');
const cache=new Map(),calls=[],rows=[];
async function evaluate(request) {
  const id=sha(JSON.stringify(request));
  if(cache.has(id)) return cache.get(id);
  const start=performance.now();
  const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw=await response.json();
  if(raw.model!==protocol.model) throw new Error(`Unexpected model: ${raw.model}`);
  validateResponse(raw,request);
  if(request.questions.probe) validateResponse({answers:{diagnosis:raw.answers?.probe}},{questions:{diagnosis:request.questions.probe}});
  const call={id,request,response:raw,elapsedMs:Math.round(performance.now()-start),costUsd:Number.isInteger(raw.usage?.input_tokens)?raw.usage.input_tokens*0.042/1e6:null};
  await appendFile(new URL('calls.jsonl',directory),JSON.stringify(call)+'\n');
  calls.push(call);cache.set(id,call);return call;
}
try {
  for(const [index,row] of data.cases.entries()) {
    const before=await evaluate(requestPlans[index].initial);
    const probeId=before.response.answers.probe.choice;
    const after=await evaluate(requestPlans[index].followups[probeId]);
    const probe=data.probes.find(p=>p.id===probeId);
    const record={id:row.id,group:row.group,expected:row.expected,regime:row.hidden.regime,initialMode:row.hidden.initialMode,
      before:prediction(before.response.answers.diagnosis),after:prediction(after.response.answers.diagnosis),rule:probeRule(row,data,probeId),
      probeId,probeCorrect:row.responses[probeId].correct,probeTargetsWeakness:row.hidden.weakSkills.includes(probe.skill),
      beforeCallId:before.id,afterCallId:after.id};
    rows.push(record);await appendFile(new URL('predictions.jsonl',directory),JSON.stringify(record)+'\n');
    if((index+1)%15===0) console.log(`simulation ${index+1}/${data.cases.length}; unique API calls ${calls.length}`);
  }
} catch(error) {
  await writeFile(new URL('failure.json',directory),JSON.stringify({error:error.message,completed:rows.length,apiCalls:calls.length},null,2));throw error;
}
const grouped=key=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(value=>[value,summarize(rows.filter(r=>r[key]===value))]));
const summary={...metadata,status:'complete',completedAt:new Date().toISOString(),...summarize(rows),byRegime:grouped('regime'),byInitialMode:grouped('initialMode'),
  byProfile:Object.fromEntries(Object.keys(data.labels).map(label=>[label,summarize(rows.filter(r=>r.expected.includes(label)))])),
  selection:{counts:Object.fromEntries(data.probes.map(p=>[p.id,rows.filter(r=>r.probeId===p.id).length])),
    weakProfileCases:rows.filter(r=>r.expected[0]!=='slip').length,
    targetsWeakness:rows.filter(r=>r.expected[0]!=='slip'&&r.probeTargetsWeakness).length},
  apiCalls:calls.length,logicalCalls:rows.length*2,cachedCalls:rows.length*2-calls.length,
  latencyMs:{uniqueCallP50:percentile(calls.map(c=>c.elapsedMs),0.5),uniqueCallP95:percentile(calls.map(c=>c.elapsedMs),0.95)},
  totalCostUsd:calls.every(c=>c.costUsd!==null)?calls.reduce((s,c)=>s+c.costUsd,0):null,
  usage:{input:calls.reduce((s,c)=>s+(c.response.usage?.input_tokens||0),0),output:calls.reduce((s,c)=>s+(c.response.usage?.output_tokens||0),0)}};
await writeFile(new URL('summary.json',directory),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({directory:directory.pathname,before:summary.before.top1,after:summary.after.top1,rule:summary.rule.top1,transitions:summary.transitions,apiCalls:summary.apiCalls,cost:summary.totalCostUsd},null,2));
