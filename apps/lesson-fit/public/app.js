(()=>{'use strict';
const data=window.LESSON_FIT_DATA,$=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scenario=data.cases[0],phrasing=0,permutation=0,pick=null,revealed=false;
const name=id=>id==='none'?'該当なし':id.toUpperCase();
const text=id=>id==='none'?'この3つには、目的に合う問題がない':scenario.materials.find(m=>m.id===id).body;
const row=engine=>data.runs[engine].rows.find(r=>r.scenarioId===scenario.id&&r.phrasing===phrasing&&r.permutation===permutation);
$('#scenario').innerHTML=data.cases.map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
function feedback(){const good=pick===scenario.expected;$('#feedback').hidden=false;$('#feedback').innerHTML=`<h3>${good?'採点表と同じ選択です':'今回の採点表では '+name(scenario.expected)+' を正解にしています'}</h3><p><b>あなたの選択：${name(pick)}</b> — ${esc(scenario.reasons[pick])}</p>${good?'':`<p><b>正解の理由：</b>${esc(scenario.reasons[scenario.expected])}</p>`}<p class="note">この答え合わせは実験前に作成したものです。教師が独立に確認した正解データではありません。</p>`;}
function render(){
 $('#lesson').textContent=scenario.lesson;$('#goal').textContent=scenario.goals[phrasing];
 const order=row('jev').order;
 $('#options').innerHTML=order.map(id=>`<button class="option ${pick===id?'selected':''}" data-option="${id}" aria-pressed="${pick===id}"><b>${name(id)}</b><span>${esc(text(id))}</span></button>`).join('');
 $('#feedback').hidden=pick===null;if(pick!==null)feedback();$('#answer').hidden=!revealed;$('#reveal').hidden=revealed;
 if(revealed)renderAnswers();
}
function renderAnswers(){
 $('#model-answers').innerHTML=['jev','kev'].map(engine=>{const r=row(engine);return `<article class="model-card"><span class="tag">${engine==='jev'?'Jev · 外部API':'Kev-0.5B · このMacで実行'}</span><h3 class="${r.correct?'ok':'bad'}">${name(r.choice)}を選択 · ${r.correct?'採点表と一致':'採点表と不一致'}</h3><p class="answer-text">${esc(text(r.choice))}</p><p>${esc(scenario.reasons[r.choice])}</p><p class="note">処理時間 ${Math.round(r.elapsedMs)}ms / 選んだ答えの確率 ${Math.round(r.probabilities[r.choice]*100)}%</p><p class="note">上の理由は採点表の説明で、モデルが生成した説明ではありません。</p></article>`;}).join('');
 const b=row('jev').baseline;$('#baseline').innerHTML=`<p><b>${name(b.choice)}：${esc(text(b.choice))}</b></p><p>${esc(scenario.reasons[b.choice])}</p>`;
 $('#variants').innerHTML=[0,1].flatMap(p=>[0,1].map(o=>{const get=e=>data.runs[e].rows.find(r=>r.scenarioId===scenario.id&&r.phrasing===p&&r.permutation===o);return `<article><b>${p?'言い換え':'元の依頼'}・順番${o+1}</b><p>${esc(scenario.goals[p])}</p><p>Jev：${name(get('jev').choice)} ／ Kev：${name(get('kev').choice)} ／ 正解：${name(scenario.expected)}</p></article>`;})).join('');
 raw();
}
function raw(){const r=row($('#raw-engine').value);$('#request').textContent=JSON.stringify(r.request,null,2);$('#response').textContent=JSON.stringify(r.response,null,2);}
function selectScenario(id){scenario=data.cases.find(s=>s.id===id)||data.cases[0];$('#scenario').value=scenario.id;phrasing=permutation=0;$('#variant').value='0-0';pick=null;revealed=false;render();}
$('#scenario').addEventListener('change',e=>selectScenario(e.target.value));
$('#options').addEventListener('click',e=>{const b=e.target.closest('[data-option]');if(!b)return;pick=b.dataset.option;render();});
$('#reveal').addEventListener('click',()=>{revealed=true;render();});
$('#variant').addEventListener('change',e=>{[phrasing,permutation]=e.target.value.split('-').map(Number);pick=null;render();});
$('#raw-engine').addEventListener('change',raw);
$('#summary').innerHTML=['jev','kev'].map(e=>{const m=data.runs[e].summary.metrics;return `<article class="model-card"><h3>${e==='jev'?'Jev':'Kev-0.5B'}</h3><p class="big">${m.allVariantsCorrect} / ${m.scenarioCount}場面</p><p>4回すべて正しく選べた</p><p class="note">全試行では ${m.correct} / ${m.trials}回 (${(m.correct/m.trials*100).toFixed(1)}%)<br>該当なしは ${m.noMatch.correct} / ${m.noMatch.trials}回</p></article>`;}).join('');
$('#result-rows').innerHTML=data.cases.map(s=>{const rs=e=>data.runs[e].rows.filter(r=>r.scenarioId===s.id),n=e=>rs(e).filter(r=>r.correct).length;return `<tr><td><button data-case="${esc(s.id)}">${esc(s.title)}</button></td><td>${n('jev')} / 4</td><td>${n('kev')} / 4</td><td>${rs('jev').filter(r=>r.baseline.choice===r.expected).length} / 4</td></tr>`;}).join('');
$('#result-rows').addEventListener('click',e=>{const b=e.target.closest('[data-case]');if(!b)return;selectScenario(b.dataset.case);$('#try').scrollIntoView({behavior:'smooth'});});
const j=data.runs.jev.summary.metrics,k=data.runs.kev.summary.metrics;
$('#costs').innerHTML=`<h3>時間と費用</h3><p>1回の応答時間の中央値：<b>Jev ${Math.round(j.latencyMs.median)}ms ／ Kev ${Math.round(k.latencyMs.median)}ms</b>。</p><p>Jevの48回の推定API料金：<b>$${j.apiCostUsd.toFixed(6)}</b>（1回約$${(j.apiCostUsd/j.trials).toFixed(6)}）。Kevの外部API料金は0です。</p><p class="note">Jevはネットワーク通信込み。KevはM1 Max・32GBのローカルHTTPで、モデル起動・読み込み時間を含みません。Kevの電力・機器・保守費は未計測。Jev料金は入力トークン数×$0.042/100万で推定しました。</p>`;
selectScenario(new URLSearchParams(location.search).get('case'));
})();
