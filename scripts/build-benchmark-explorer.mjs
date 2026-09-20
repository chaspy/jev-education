import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const run='2026-09-20T05-59-46.615Z-material-search';
const data=JSON.parse(await read('benchmarks/data/material-search.json'));
const rows=(await read(`benchmarks/results/${run}/predictions.jsonl`)).trim().split('\n').map(JSON.parse);
const calls=(await read(`benchmarks/results/${run}/calls.jsonl`)).trim().split('\n').map(JSON.parse);
const summary=JSON.parse(await read(`benchmarks/results/${run}/summary.json`));
const bundle={run,skills:data.skills,materials:data.materials,cases:data.cases.filter(q=>q.split==='test'),rows,calls,summary};
const serialized=JSON.stringify(bundle).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const payload=`window.BENCHMARK_DATA = ${serialized};\n`;
await writeFile(new URL('apps/benchmark-explorer/public/data.js',root),payload);
const base='apps/benchmark-explorer/public/';
const html=await read(base+'index.html'),css=await read(base+'style.css'),model=await read(base+'model.js'),app=await read(base+'app.js');
const scripts=[payload,model,app];
const hashes=scripts.map(s=>`'sha256-${createHash('sha256').update(s).digest('base64')}'`).join(' ');
const styleHash=createHash('sha256').update(css).digest('base64');
let standalone=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${hashes}; style-src 'sha256-${styleHash}'; img-src data:; object-src 'none'; base-uri 'none'">`)
 .replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`)
 .replace(/  <script defer src="(?:data|model|app)\.js"><\/script>\n/g,'')
 .replace('</body>',()=>scripts.map(s=>`<script>${s}</script>`).join('\n')+'\n</body>');
await writeFile(new URL(base+'standalone.html',root),standalone);
console.log(`Built explorer: ${rows.length} cases, ${calls.length} API logs; standalone ${(Buffer.byteLength(standalone)/1024).toFixed(0)} KiB`);
