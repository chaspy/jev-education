import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {retrieve,eligible,requestFor,validate,evaluateRanking,aggregate} from './core.mjs';
import {percentile} from '../metrics.mjs';
const root=new URL('./',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const load=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
if(!process.env.TYPESAFE_API_KEY)throw new Error('TYPESAFE_API_KEY required');
const data=await load('../data/material-search.json'),protocol=await load('protocol.json');
const queries=data.cases.filter(q=>q.split==='test');
const plans=queries.map(q=>{
 const start=performance.now();const ranking=retrieve(q.context,data.materials);const retrievalMs=performance.now()-start;
 const begin=performance.now();const shortlist=ranking.slice(0,protocol.candidateLimit);const candidates=shortlist.map(r=>data.materials.find(m=>m.id===r.id)).filter(m=>eligible(q.context,m));const filterMs=performance.now()-begin;
 return {q,ranking,shortlist,candidates,retrievalMs,filterMs,request:candidates.length?requestFor(q,candidates,data):null};
});
const runId=`${new Date().toISOString().replaceAll(':','-')}-material-search`,dir=new URL(`../results/${runId}/`,root);
await mkdir(dir,{recursive:true});
const metadata={runId,startedAt:new Date().toISOString(),protocol,gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 dataSha256:hash(JSON.stringify(data)),requestSetSha256:hash(JSON.stringify(plans.map(p=>p.request))),
 sourceFiles:Object.fromEntries(await Promise.all(['prepare.mjs','core.mjs','run.mjs','../metrics.mjs'].map(async p=>[p,hash(await readFile(new URL(p,root)))])))};
await writeFile(new URL('metadata.json',dir),JSON.stringify(metadata,null,2)+'\n');
const calls=[],rows=[];
try{
 for(const [index,p] of plans.entries()){
  let ranked=[],apiMs=0,costUsd=0;
  if(p.request){
   const start=performance.now();const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p.request),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error(`HTTP ${response.status} at ${p.q.id}`);
   const raw=await response.json();apiMs=Math.round(performance.now()-start);
   costUsd=Number.isInteger(raw.usage?.input_tokens)?raw.usage.input_tokens*.042/1e6:null;
   const call={queryId:p.q.id,request:p.request,response:raw,elapsedMs:apiMs,costUsd};
   await appendFile(new URL('calls.jsonl',dir),JSON.stringify(call)+'\n');calls.push(call);
   const answers=validate(raw,p.request);
   ranked=p.candidates.map((m,i)=>({id:m.id,probability:answers[`fit${i}`].noul,originalRank:i})).sort((a,b)=>b.probability-a.probability||a.originalRank-b.originalRank);
  }
  const output={retrieval:p.ranking.slice(0,3).map(m=>m.id),filtered:p.candidates.slice(0,3).map(m=>m.id),jevRanked:ranked.slice(0,3).map(m=>m.id),jevSelected:ranked.filter(m=>m.probability>=protocol.acceptanceThreshold).slice(0,3).map(m=>m.id)};
  const relevant=Object.entries(p.q.judgments).filter(([,j])=>j.relevant).map(([id])=>id);
  const row={id:p.q.id,group:p.q.group,variant:p.q.variant,shortlist:p.shortlist,candidates:p.candidates.map(m=>m.id),ranked,output,
   goldRelevantIds:relevant,candidateRecall:relevant.length?p.shortlist.filter(m=>relevant.includes(m.id)).length/relevant.length:null,
   metrics:Object.fromEntries(Object.entries(output).map(([k,ids])=>[k,evaluateRanking(p.q,ids)])),
   timing:{retrievalMs:p.retrievalMs,filterMs:p.filterMs,apiMs,endToEndMs:p.retrievalMs+p.filterMs+apiMs},costUsd};
  rows.push(row);await appendFile(new URL('predictions.jsonl',dir),JSON.stringify(row)+'\n');
  if((index+1)%5===0||index===plans.length-1)console.log(`material-search ${index+1}/${plans.length}; API calls ${calls.length}`);
 }
}catch(error){await writeFile(new URL('failure.json',dir),JSON.stringify({message:error.message,completed:rows.length},null,2));throw error;}
const stats=xs=>({count:xs.length,mean:xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null,p50:percentile(xs,.5),p95:percentile(xs,.95)});
const methods=Object.keys(rows[0].metrics);
const summary={...metadata,status:'complete',completedAt:new Date().toISOString(),metrics:Object.fromEntries(methods.map(k=>[k,aggregate(rows,k)])),
 noMatchByKind:Object.fromEntries(['unavailable','missing-topic'].map(v=>[v,Object.fromEntries(methods.map(k=>[k,aggregate(rows.filter(r=>r.variant===v),k)]))])),
 candidateRecall:stats(rows.filter(r=>r.candidateRecall!==null).map(r=>r.candidateRecall)),
 apiCalls:calls.length,skippedQueries:rows.filter(r=>!r.candidates.length).length,scoredPairs:rows.reduce((s,r)=>s+r.candidates.length,0),
 latencyMs:{retrieval:stats(rows.map(r=>r.timing.retrievalMs)),filtered:stats(rows.map(r=>r.timing.retrievalMs+r.timing.filterMs)),api:stats(calls.map(c=>c.elapsedMs)),endToEnd:stats(rows.map(r=>r.timing.endToEndMs))},
 cost:{totalUsd:calls.every(c=>c.costUsd!==null)?calls.reduce((s,c)=>s+c.costUsd,0):null,perQueryUsd:stats(rows.map(r=>r.costUsd)),perAPICallUsd:stats(calls.map(c=>c.costUsd))},
 tokens:{input:calls.reduce((s,c)=>s+c.response.usage.input_tokens,0),output:calls.reduce((s,c)=>s+c.response.usage.output_tokens,0)}};
await writeFile(new URL('summary.json',dir),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({directory:dir.pathname,metrics:summary.metrics,candidateRecall:summary.candidateRecall,latency:summary.latencyMs.api,cost:summary.cost.totalUsd},null,2));
