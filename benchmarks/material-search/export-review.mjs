import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicMaterial} from './core.mjs';
const data=JSON.parse(await readFile(new URL('../data/material-search.json',import.meta.url)));
const header=['pair_id','teacher_context','material_id','material','teacher_rating_0_1_or_unclear','reason','reviewer'];
const rows=data.cases.filter(q=>q.split==='test').flatMap(q=>data.materials.map(m=>{
 const context=structuredClone(q.context);context.masteredSkills=context.masteredSkills.map(id=>data.skills.find(s=>s.id===id).name);
 return [`${q.id}/${m.id}`,JSON.stringify(context),m.id,JSON.stringify(publicMaterial(m,data.skills)),'','',''];
}));
rows.sort((a,b)=>createHash('sha256').update(a[0]).digest('hex').localeCompare(createHash('sha256').update(b[0]).digest('hex')));
const csv=[header,...rows].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
await writeFile(new URL('teacher-review.csv',import.meta.url),csv);
console.log(`Exported ${rows.length} pairs without model scores or provisional labels`);
