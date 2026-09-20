import {writeFile,readFile} from 'node:fs/promises';
import {skills} from '../../apps/learning-path/public/content.js';
const curriculum=JSON.parse(await readFile(new URL('../../apps/learning-path/data/curriculum.json',import.meta.url)));
const objectives={
 'signed-add':['借金と所持金を数で表した後、増減を数直線で追って計算できるようにしたい。','負の数を含む足し算と引き算まで実施。掛け算は次回に回した。'],
 'signed-multiply':['マイナスを含む掛け算・割り算で、答えの符号を決めて計算できるようにしたい。','異符号・同符号の積と商を扱った。文字を用いる式には進んでいない。'],
 letter:['文字の場所に具体的な数を入れて、式の値を求める練習をさせたい。','掛け算記号を省く表し方と、数を入れたときの値を扱った。項の整理は次回。'],
 'like-terms':['同じ種類の文字の項をまとめ、数だけの項と区別する練習をさせたい。','文字の係数を足したり引いたりして整理した。かっこの処理はまだ扱っていない。'],
 distribution:['かっこの前の数を、中の全ての項へ掛ける操作を定着させたい。','定数項への掛け忘れを説明し、正負の係数でかっこを外した。方程式は次回。'],
 balance:['左右の等しさを保ちながら、両側に同じ計算をする意味を確認したい。','天秤の説明の後、両辺から同じ数を引く操作と同じ数で割る操作を扱った。移項という省略手続きは次回。'],
 transpose:['等号をまたいで項を動かす際、プラスとマイナスを取り違えない練習をさせたい。','両辺への同じ操作を根拠に、項を反対側へ動かす手順を扱った。分母をなくす操作は次回。'],
 fraction:['式の各項に同じ数を掛けて、分母をなくす操作を定着させたい。','分数がある方程式で、両辺の全ての項に掛ける例を説明した。'],
 equation:['かっこや文字の項を整理して、未知数の値まで求める一連の手順を練習させたい。','展開・項の整理・等式変形を組み合わせて最後まで解いた。解を元の式で確かめる内容は次回。'],
 verify:['求めた値が元の式の左右を等しくするか、数を入れて確認する練習をさせたい。','解いた後に元の式の左辺を計算して、右辺と一致するか確かめる方法を扱った。']};
function prerequisites(id){return [...new Set((skills.find(s=>s.id===id)?.prerequisites||[]).flatMap(p=>[p,...prerequisites(p)]))];}
let serial=0;
const materials=[];
for(const skill of skills){
 const common={grade:7,subject:'数学',curriculumId:skill.source,prerequisites:prerequisites(skill.id),
  attribution:'chaspy/jev-education public/content.js, CC BY 4.0',goldTopic:skill.id};
 materials.push({...common,id:`m${String(++serial).padStart(3,'0')}`,title:skill.name+'：説明',format:'explanation',minutes:skill.minutes,body:[skill.intro,...skill.steps].join('\n')});
 materials.push({...common,id:`m${String(++serial).padStart(3,'0')}`,title:skill.name+'：確認',format:'exercise',minutes:1,body:skill.check.prompt+'\n選択肢：'+skill.check.choices.join(' / '),answer:skill.check.choices[skill.check.answer]});
 for(const p of skill.practice)materials.push({...common,id:`m${String(++serial).padStart(3,'0')}`,title:skill.name+'：練習',format:'exercise',minutes:2,body:p.q,answer:p.a});
}
const cases=[];
for(const [index,skill] of skills.entries()){
 for(const variant of ['practice','explanation','short','unavailable']){
  const format=['explanation','unavailable'].includes(variant)?'explanation':'exercise';
  const maxMinutes=['short','unavailable'].includes(variant)?1:format==='exercise'?2:5;
  const [goal,actual]=objectives[skill.id];
  const context={subject:'数学',grade:7,textbook:{name:'公開デモ教材集 v1（架空の授業用。市販教科書ではない）',section:`数と式・第${index+1}節`,contentReference:skill.source},
   curriculum:curriculum.items.find(i=>i.id===skill.source),
   plan:{unitGoal:goal,nextLesson:'今日扱った内容を確認してから、次の操作に進む。'},
   actualLesson:{summary:actual,completedExamples:skill.steps.slice(0,1)},
   masteredSkills:prerequisites(skill.id),assignment:{goal,format,maxMinutesPerMaterial:maxMinutes,maxItems:3}};
  cases.push({id:`t${String(cases.length+1).padStart(3,'0')}`,split:['signed-add','letter'].includes(skill.id)?'dev':'test',group:skill.id,variant,context,goldTopic:skill.id});
 }
}
for(const [topic,goal] of [['geometry','三角形の内角の和を使って未知の角度を求める練習をさせたい。'],['proportion','比例の表から比例定数を求める練習をさせたい。']]){
 cases.push({id:`t${String(cases.length+1).padStart(3,'0')}`,split:'test',group:topic,variant:'missing-topic',goldTopic:topic,
 context:{subject:'数学',grade:7,textbook:{name:'公開デモ教材集 v1（架空の授業用）',section:topic},curriculum:{text:'この範囲に対応する指導要領項目は今回の収録資料にない。'},plan:{unitGoal:goal},actualLesson:{summary:goal,completedExamples:[]},masteredSkills:skills.map(s=>s.id),assignment:{goal,format:'exercise',maxMinutesPerMaterial:2,maxItems:3}}});
}
// Operational suitability, not an expert judgment: exact target topic plus declared constraints.
const violations=(q,m)=>[...(m.grade!==q.context.grade?['grade']:[]),...(m.subject!==q.context.subject?['subject']:[]),...(m.format!==q.context.assignment.format?['format']:[]),...(m.minutes>q.context.assignment.maxMinutesPerMaterial?['time']:[]),...(m.prerequisites.some(p=>!q.context.masteredSkills.includes(p))?['prerequisites']:[])];
for(const q of cases)q.judgments=Object.fromEntries(materials.map(m=>[m.id,{relevant:m.goldTopic===q.goldTopic&&violations(q,m).length===0,topicMatch:m.goldTopic===q.goldTopic,violations:violations(q,m)}]));
const data={version:1,license:'CC BY 4.0',author:'chaspy/jev-education; AI-authored contexts and annotations, no teacher review',
 provenance:'40 resources derived from the existing public original demo; no proprietary textbook or student data. Curriculum excerpts retain their original attribution.',
 assumptions:['Suitability gold is author-defined topic match plus explicit metadata constraints, not measured teacher acceptance.',
 'Prerequisites use the conservative author-defined demo graph; duration for checks=1min, practice=2min are estimates, not student timing.',
 '42 contexts: dev 8 on two topic groups, test 34 on disjoint topic groups; no result-driven tuning.',
 'Two no-match topics have no resources; explanation requests with a 1-minute budget have no matching target explanation.',
 'All context is fictional but explicit; grade, textbook scope, objective, actual lesson, prior knowledge, format and time are supplied.'],
 skills:skills.map(s=>({id:s.id,name:s.name})),materials,cases};
await writeFile(new URL('../data/material-search.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({materials:materials.length,cases:cases.length,dev:cases.filter(q=>q.split==='dev').length,test:cases.filter(q=>q.split==='test').length,noMatchTest:cases.filter(q=>q.split==='test'&&!Object.values(q.judgments).some(j=>j.relevant)).length}));
