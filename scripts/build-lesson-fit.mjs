import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),base='apps/lesson-fit/public/';
const source=JSON.parse(await read('benchmarks/lesson-fit/cases.json')),runs={};
for(const engine of ['jev','kev']){const prefix=`benchmarks/lesson-fit/results/${engine}/`;runs[engine]={summary:JSON.parse(await read(prefix+'summary.json')),rows:(await read(prefix+'calls.jsonl')).trim().split('\n').map(JSON.parse)};if(runs[engine].summary.status!=='complete'||runs[engine].rows.length!==48)throw new Error('Incomplete run');}
const payload=`window.LESSON_FIT_DATA = ${JSON.stringify({...source,runs}).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')};\n`;
await writeFile(new URL(base+'data.js',root),payload);
const html=await read(base+'index.html'),css=await read(base+'style.css'),app=await read(base+'app.js');
const hash=s=>`'sha256-${createHash('sha256').update(s).digest('base64')}'`;
const standalone=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${hash(payload)} ${hash(app)}; style-src ${hash(css)}; img-src data:; object-src 'none'; base-uri 'none'">`).replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`).replace('<script defer src="data.js"></script><script defer src="app.js"></script>','').replace('</body>',()=>`<script>${payload}</script><script>${app}</script></body>`);
await writeFile(new URL(base+'standalone.html',root),standalone);
await mkdir(new URL(base+'previous/',root),{recursive:true});
for(const file of ['index.html','style.css','app.js','data.js','model.js','standalone.html'])await cp(new URL('apps/benchmark-explorer/public/'+file,root),new URL(base+'previous/'+file,root));
console.log('Built new lesson-fit experiment, 12 scenarios, 96 model calls; previous experiment archived');
