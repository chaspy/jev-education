import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {plansFor,validate,summarize} from './core.mjs';
const engine=process.argv[2];if(!['jev','kev'].includes(engine))throw new Error('Usage: run.mjs jev|kev');
if(engine==='jev'&&!process.env.TYPESAFE_API_KEY)throw new Error('Missing TYPESAFE_API_KEY');
const model=engine==='jev'?'jev-1.13.0':'kev-0.5b',endpoint=engine==='jev'?'https://api.typesafe.ai/v1/systemone':'http://127.0.0.1:8009/v1/systemone';
const source=await readFile(new URL('cases.json',import.meta.url),'utf8'),data=JSON.parse(source),plans=plansFor(data,model),hash=s=>createHash('sha256').update(s).digest('hex');
const dir=new URL(`results/${engine}/`,import.meta.url);await mkdir(dir,{recursive:true});
try{await readFile(new URL('calls.jsonl',dir));throw new Error('Existing results; refusing overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const metadata={engine,model,endpoint,startedAt:new Date().toISOString(),dataSha256:hash(source),requestsSha256:hash(JSON.stringify(plans.map(p=>p.request))),gitRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),warmup:'Kev was warmed by the separate SDK smoke test. Jev network/API time includes provider overhead.',costBasis:engine==='jev'?'input_tokens * 0.042 / 1e6 (estimate)':'external API fee 0; hardware, power and operations unmeasured'};
await writeFile(new URL('metadata.json',dir),JSON.stringify(metadata,null,2)+'\n');
const rows=[];
try{for(const [i,p] of plans.entries()){
 const t=performance.now();const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(engine==='jev'?{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`}:{})},body:JSON.stringify(p.request),signal:AbortSignal.timeout(60000)});
 if(!res.ok)throw new Error(`HTTP ${res.status} at ${p.id}`);
 const response=await res.json(),elapsedMs=performance.now()-t,answer=validate(response,p.request);
 const costUsd=engine==='jev'?response.usage.input_tokens*.042/1e6:0;
 const row={...p,response,choice:answer.choice,probabilities:answer.probabilities,confidence:answer.confidence,correct:answer.choice===p.expected,elapsedMs,costUsd};
 await appendFile(new URL('calls.jsonl',dir),JSON.stringify(row)+'\n');rows.push(row);
 if((i+1)%12===0)console.log(`${engine}: ${i+1}/${plans.length}`);
}
const summary={...metadata,status:'complete',completedAt:new Date().toISOString(),metrics:summarize(rows),baseline:summarize(rows.map(r=>({...r,choice:r.baseline.choice,correct:r.baseline.choice===r.expected,elapsedMs:0,costUsd:0})))};
await writeFile(new URL('summary.json',dir),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary.metrics,null,2));
}catch(e){await writeFile(new URL('failure.json',dir),JSON.stringify({message:e.message,completed:rows.length},null,2));throw e;}
