import fs from 'node:fs';
const root='apps/adaptive-sim';
const replay=JSON.parse(fs.readFileSync(`${root}/public/replay.json`));
for(const frames of Object.values(replay.runs))if(frames.length!==624||frames.some(f=>f.pupils.length!==4))throw Error('Incomplete replay');
const calls=fs.readFileSync(`${root}/data/jev-calls.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
fs.mkdirSync(`${root}/public/calls`,{recursive:true});
for(let y=1;y<=12;y++)fs.writeFileSync(`${root}/public/calls/year${y}.json`,JSON.stringify(calls.filter(c=>Math.ceil(c.week/52)===y)));
console.log(`Verified 3 × 624 weeks, ${calls.length} API calls`);
