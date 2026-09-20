import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildOpenAIRequest,parseResponse,estimatedCost,config} from './adapter.mjs';
import {prediction,followupRequest,probeRule,summarize} from '../simulation/core.mjs';
import {score,percentile} from '../metrics.mjs';
const root=new URL('./',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const lines=async p=>(await readFile(new URL(p,root),'utf8')).trim().split('\n').map(JSON.parse);
const suite=process.argv[2];
if(!['simulation','mae'].includes(suite)) throw new Error('Usage: node benchmarks/openai/run.mjs simulation|mae');
if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');
const protocol=await json('protocol.json'),reference=protocol[suite].reference;
const referenceSummary=await json(`../results/${reference}/summary.json`);
const referenceRows=await lines(`../results/${reference}/predictions.jsonl`);
const referenceCalls=suite==='simulation'?await lines(`../results/${reference}/calls.jsonl`):referenceRows.map(r=>({id:sha(JSON.stringify(r.request)),...r}));
const data=suite==='simulation'?await json('../data/synthetic-followup.json'):null;
const originalRequests=referenceCalls.map(c=>c.request);
const possibleRequests=suite==='simulation'?[...originalRequests,...data.cases.flatMap(r=>data.probes.map(p=>followupRequest(r,data,p.id)))]:originalRequests;
const runId=`${new Date().toISOString().replaceAll(':','-')}-luna-${suite}`,directory=new URL(`../results/${runId}/`,root);
await mkdir(directory,{recursive:true});
const metadata={runId,suite,reference,startedAt:new Date().toISOString(),protocol,
 gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 originalRequestSetSha256:sha(JSON.stringify(originalRequests)),possibleOpenAIRequestSetSha256:sha(JSON.stringify(possibleRequests.map(buildOpenAIRequest))),
 referencePredictionsSha256:sha(JSON.stringify(referenceRows)),
 sourceFiles:Object.fromEntries(await Promise.all(['adapter.mjs','run.mjs','../simulation/core.mjs','../metrics.mjs'].map(async p=>[p,sha(await readFile(new URL(p,root)))])))};
await writeFile(new URL('metadata.json',directory),JSON.stringify(metadata,null,2)+'\n');
const cache=new Map(),calls=[];let failed=null;
// Within each phase no downstream dependency is evaluated concurrently.
async function evaluate(request) {
 const id=sha(JSON.stringify(request));if(cache.has(id)) return cache.get(id);
 const promise=(async()=>{
  const apiRequest=buildOpenAIRequest(request),start=performance.now();
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(apiRequest),signal:AbortSignal.timeout(120000)});
  if(!res.ok) throw new Error(`OpenAI HTTP ${res.status}; request ${id}`);
  const raw=await res.json();
  const record={id,request,apiRequest,response:raw,elapsedMs:Math.round(performance.now()-start),costUsd:estimatedCost(raw.usage)};
  // Preserve original API output even if semantic validation below fails.
  await appendFile(new URL('calls.jsonl',directory),JSON.stringify(record)+'\n');
  if(raw.model!==config.model && !raw.model?.startsWith(config.model+'-')) throw new Error(`Unexpected response model ${raw.model}`);
  record.parsed=parseResponse(raw,request);calls.push(record);
  if(calls.length%10===0) console.log(`${suite}: ${calls.length} unique API calls completed`);
  return record;
 })();cache.set(id,promise);return promise;
}
async function runPhase(requests) {
 const unique=[...new Map(requests.map(r=>[sha(JSON.stringify(r)),r])).values()];let next=0;
 await Promise.all(Array.from({length:protocol.concurrency},async()=>{
  while(!failed&&next<unique.length){const r=unique[next++];try{await evaluate(r);}catch(e){failed ||= e;}}
 }));
 if(failed) throw failed;
}
const compactScore=s=>({count:s.count,top1:s.top1,top3:s.top3,coverage:s.coverage,selectiveAccuracy:s.selectiveAccuracy});
function distribution(values) {return {count:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,p50:percentile(values,.5),p95:percentile(values,.95)};}
function resources(cs) {return {apiCalls:cs.length,latencyMs:distribution(cs.map(c=>c.elapsedMs)),
 totalCostUsd:cs.every(c=>c.costUsd!==null)?cs.reduce((s,c)=>s+c.costUsd,0):null,
 meanCostUsd:cs.every(c=>c.costUsd!==null)?cs.reduce((s,c)=>s+c.costUsd,0)/cs.length:null,
 inputTokens:cs.reduce((s,c)=>s+(c.response.usage?.input_tokens||0),0),outputTokens:cs.reduce((s,c)=>s+(c.response.usage?.output_tokens||0),0),
 cachedInputTokens:cs.reduce((s,c)=>s+(c.response.usage?.input_tokens_details?.cached_tokens||0),0)};}
function confidenceStats(rows,key,callMap,callField) {
 const stats=rs=>({count:rs.length,confidence:distribution(rs.map(r=>callMap.get(r[callField]).parsed.answers.diagnosis.confidence)),
  probability:distribution(rs.map(r=>Math.max(...Object.values(callMap.get(r[callField]).parsed.answers.diagnosis.probabilities))))});
 const wrong=rows.filter(r=>!r.expected.includes(r[key].ranked[0]));
 return {wrong:stats(wrong),correct:stats(rows.filter(r=>r.expected.includes(r[key].ranked[0]))),wrongAccepted:stats(wrong.filter(r=>!r[key].abstained))};
}
function profileScore(rows){return summarize(rows.map(r=>({...r,...Object.fromEntries(['before','after'].map(k=>[k,{...r[k],ranked:r[k].ranked.filter(v=>v!=='unknown')}]))})));}
function workflowResources(rows,lookup){const pairs=rows.map(r=>[lookup.get(r.beforeCallId),lookup.get(r.afterCallId)]);return {
 description:'Sum of two measured request latencies per logical scenario; replay cache is not treated as a zero-latency inference. Student response time excluded. Costs reuse observed token usage, not a new uncached billing estimate.',
 latencyMs:distribution(pairs.map(p=>p.reduce((s,c)=>s+c.elapsedMs,0))),
 costUsd:distribution(pairs.map(p=>p.reduce((s,c)=>s+c.costUsd,0))),
 logicalCases:rows.length};}
try {
 console.log(`Running Luna ${suite}; reference ${reference}; output ${directory.pathname}`);
 await runPhase(originalRequests);
 let report;
 if(suite==='mae') {
  const rows=[];
  for(const row of referenceRows){const c=await evaluate(row.request);rows.push({id:row.id,expected:row.expected,prediction:prediction(c.parsed.answers.diagnosis),callId:c.id,jev:row.prediction});}
  await writeFile(new URL('predictions.jsonl',directory),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  report={jev:score(rows,'jev'),luna:score(rows),confidence:confidenceStats(rows,'prediction',new Map(calls.map(c=>[c.id,c])),'callId'),referenceResources:resources(referenceCalls)};
 } else {
  const ownRequests=[];
  for(const row of data.cases){const ref=referenceRows.find(r=>r.id===row.id);const original=referenceCalls.find(c=>c.id===ref.beforeCallId);const c=await evaluate(original.request);ownRequests.push(followupRequest(row,data,c.parsed.answers.probe.choice));}
  await runPhase(ownRequests);
  const fixed=[],adaptive=[];
  for(const row of data.cases){
   const ref=referenceRows.find(r=>r.id===row.id),before=await evaluate(referenceCalls.find(c=>c.id===ref.beforeCallId).request);
   for(const [mode,probeId,target] of [['fixed',ref.probeId,fixed],['adaptive',before.parsed.answers.probe.choice,adaptive]]){
    const after=await evaluate(followupRequest(row,data,probeId));
    target.push({id:row.id,expected:row.expected,group:row.group,regime:row.hidden.regime,initialMode:row.hidden.initialMode,mode,probeId,
     before:prediction(before.parsed.answers.diagnosis),after:prediction(after.parsed.answers.diagnosis),rule:probeRule(row,data,probeId),beforeCallId:before.id,afterCallId:after.id});
   }
  }
  const lookup=new Map(calls.map(c=>[c.id,c]));
  const summarizeMode=rows=>({...summarize(rows),forcedProfiles:profileScore(rows),
   byRegime:Object.fromEntries(['clean','lucky','careless'].map(regime=>[regime,profileScore(rows.filter(r=>r.regime===regime))])),
   probeCounts:Object.fromEntries(data.probes.map(p=>[p.id,rows.filter(r=>r.probeId===p.id).length])),
   beforeConfidence:confidenceStats(rows,'before',lookup,'beforeCallId'),afterConfidence:confidenceStats(rows,'after',lookup,'afterCallId'),workflow:workflowResources(rows,lookup)});
  await writeFile(new URL('predictions.jsonl',directory),[...fixed,...adaptive].map(r=>JSON.stringify(r)).join('\n')+'\n');
  const refLookup=new Map(referenceCalls.map(c=>[c.id,c]));
  report={jev:{...summarize(referenceRows),forcedProfiles:profileScore(referenceRows),workflow:workflowResources(referenceRows,refLookup)},fixed:summarizeMode(fixed),adaptive:summarizeMode(adaptive),referenceResources:resources(referenceCalls),
   fixedEvidenceResources:resources(calls.filter(c=>referenceCalls.some(r=>sha(JSON.stringify(r.request))===c.id)))};
 }
 const summary={...metadata,status:'complete',completedAt:new Date().toISOString(),...report,resources:resources(calls),actualResponseModels:[...new Set(calls.map(c=>c.response.model))]};
 await writeFile(new URL('summary.json',directory),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({runId,...(suite==='mae'?{jev:compactScore(report.jev),luna:compactScore(report.luna)}:{jev:report.jev.forcedProfiles.after.top1,fixed:report.fixed.forcedProfiles.after.top1,adaptive:report.adaptive.forcedProfiles.after.top1,probeCounts:report.adaptive.probeCounts}),resources:summary.resources},null,2));
} catch(error) {
 await writeFile(new URL('failure.json',directory),JSON.stringify({message:error.message,completedCalls:calls.length},null,2));throw error;
}
