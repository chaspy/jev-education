(() => {
  'use strict';
  const data = window.BENCHMARK_DATA, model = window.ExperimentModel;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const materials = new Map(data.materials.map(m => [m.id,m]));
  const skills = new Map(data.skills.map(s => [s.id,s.name]));
  const cases = new Map(data.cases.map(q => [q.id,q]));
  const rows = new Map(data.rows.map(r => [r.id,r]));
  const calls = new Map(data.calls.map(c => [c.queryId,c]));
  const variantNames = {practice:'練習・2分',explanation:'説明・5分',short:'確認・1分',unavailable:'説明・1分', 'missing-topic':'未収録の分野'};
  const format = value => value === 'exercise' ? '問題を解く教材' : '説明を読む教材';
  const reasons = {grade:'学年が違う',subject:'教科が違う',format:'教材形式が違う',time:'時間の上限を超える',prerequisites:'前提知識が既習範囲にない'};
  const featured = [
    {id:'t029',label:'改善した例：分母を払う',note:'検索＋条件フィルターでは、等式操作の別教材が先頭でした。Jevは「分母を払う」確認問題を先頭へ上げました。'},
    {id:'t005',label:'改善した例：符号の乗除',note:'足し引きの教材が先頭に残っていました。Jevが掛け算・割り算の教材を上に並べ替えた例です。'},
    {id:'t025',label:'検索で正解が漏れた例',note:'移項の正解教材は、最初の検索上位12件に入っていません。Jevは候補外を探せません。等式の性質の教材を使えるかには、採点用の基準の境界の問題もあります。'},
    {id:'t041',label:'該当教材がない例',note:'三角形の角度を扱う教材は、この40件に存在しません。候補の確率を低く付けても、順位だけなら表示されます。足切り値で非表示にする違いを確認できます。'},
    {id:'t035',label:'採点用の基準が粗い例',note:'「かっこや項の整理」の目標に対し、採点用の基準は同単元の単純な方程式も正解としました。Jevが低く評価したことを、ただちにモデルの誤りとは言えません。'},
    {id:'t032',label:'コードだけで除外する例',note:'1分以内の説明教材という条件を満たす候補がありません。コードの条件フィルターで全て落ちるので、Jev APIは呼んでいません。'}
  ];
  let selectedCase = cases.has(new URLSearchParams(location.search).get('case')) ? new URLSearchParams(location.search).get('case') : 't029';
  let stage = 1, threshold = .65, showAll = false;
  const stageNames = ['教材一覧','検索で候補化','条件で絞る','Jevで並べ替え','足切りして提示'];
  const stageDescriptions = [
    '実験の対象は、この公開自作教材40件。教材本文・模範解答・形式・想定時間を持っています。実際の2万教材を使った実験ではありません。',
    '先生の目標・授業実績・指導要領の文章を検索文にして、タイトルと本文を文字の一致で検索しました（BM25）。全40件から上位12件だけを残します。ここではJevを使いません。',
    '学年・教科・教材形式・時間・前提知識の条件をコードで確認します。除外された候補を灰色にして、理由を表示しています。この処理にもJevは不要です。',
    '条件を通った同じ候補について、授業の具体的な目標に直接合うかをJevに質問しました。Jevは各候補について「この依頼に合う」と見込む値を0〜1で返します。値が高くても、先生の評価で正しいと保証されるわけではありません。',
    '保存した適合確率が足切り値以上の教材を、最大3件提示します。高い値にすると候補は減ります。候補がなくなれば「該当なし」です。下のスライダーで再集計できます。'
  ];
  $('featured').innerHTML = featured.map(f => `<button type="button" data-case="${f.id}">${esc(f.label)}</button>`).join('');
  $('case-select').innerHTML = data.cases.map(q => `<option value="${q.id}">${q.id} · ${esc(skills.get(q.group) || (q.group==='geometry'?'三角形の角度':'比例'))} · ${esc(variantNames[q.variant])}</option>`).join('');
  function changeCase(id) {
    selectedCase=id;showAll=false;
    const url=new URL(location.href);url.searchParams.set('case',id);
    try {history.replaceState(null,'',url);} catch { /* local file navigation may disallow history updates */ }
    renderCase();
  }
  $('featured').addEventListener('click',e => {const b=e.target.closest('[data-case]');if(b)changeCase(b.dataset.case);});
  $('case-select').addEventListener('change',e => changeCase(e.target.value));
  $('pipeline').addEventListener('click',e => {const b=e.target.closest('[data-stage]');if(b){stage=Number(b.dataset.stage);renderStage();}});
  $('previous').addEventListener('click',()=>{stage=Math.max(0,stage-1);renderStage();});
  $('next').addEventListener('click',()=>{stage=Math.min(4,stage+1);renderStage();});
  $('materials').addEventListener('click',e=>{const b=e.target.closest('[data-material]');if(b)openMaterial(b.dataset.material);if(e.target.closest('[data-expand]')){showAll=true;renderStage();}});
  $('comparison').addEventListener('click',e=>{const b=e.target.closest('[data-material]');if(b)openMaterial(b.dataset.material);});
  $('close-dialog').addEventListener('click',()=>$('material-dialog').close());
  $('material-dialog').addEventListener('click',e=>{if(e.target===$('material-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  function contextMarkup(q) {
    const c=q.context;
    return `<dl><dt>教科・学年</dt><dd>${esc(c.subject)} · 中学${c.grade-6}年</dd><dt>教科書範囲（架空）</dt><dd>${esc(c.textbook.name)}\n${esc(c.textbook.section)}</dd><dt>指導要領（公開資料）</dt><dd>${esc(c.curriculum.text)}</dd><dt>授業計画</dt><dd>${esc(c.plan.unitGoal)}\n${esc(c.plan.nextLesson||'記載なし')}</dd><dt>実際に扱った例</dt><dd>${esc(c.actualLesson.completedExamples.join('\n')||'記載なし')}</dd><dt>既習の前提知識</dt><dd>${esc(c.masteredSkills.map(s=>skills.get(s)||s).join('、')||'この実験で指定した前提なし')}</dd><dt>課題の条件</dt><dd>${esc(format(c.assignment.format))} / 1教材${c.assignment.maxMinutesPerMaterial}分以内 / 最大${c.assignment.maxItems}件</dd></dl>`;
  }
  function renderCase() {
    const q=cases.get(selectedCase);
    $('case-select').value=selectedCase;
    document.querySelectorAll('[data-case]').forEach(b=>{const active=b.dataset.case===selectedCase;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('case-note').textContent=featured.find(f=>f.id===selectedCase)?.note||'実際の評価ケースです。検索・条件フィルター・Jevの段階を切り替えて、どの教材が残ったかを比較できます。';
    $('goal').textContent=q.context.assignment.goal;
    $('actual').textContent=q.context.actualLesson.summary;
    $('constraints').innerHTML=[format(q.context.assignment.format),`1教材${q.context.assignment.maxMinutesPerMaterial}分以内`,'最大3件'].map(t=>`<span>${esc(t)}</span>`).join('');
    $('context-detail').innerHTML=contextMarkup(q);
    renderStage();renderComparison();renderRaw();
  }
  function card(id,index,row,q) {
    const m=materials.get(id),gold=q.judgments[id],prob=row.ranked.find(p=>p.id===id)?.probability;
    const excluded=stage===2&&!row.candidates.includes(id);
    const original=row.shortlist.findIndex(p=>p.id===id);
    return `<article class="material ${excluded?'excluded':''}" data-card-id="${id}"><div class="card-top"><span>${stage===0?'教材':`${index+1}位`} · ${id}</span><span>${m.minutes}分 / ${m.format==='exercise'?'問題':'説明'}</span></div><h4>${esc(m.title)}</h4><div class="body">${esc(m.body)}</div>${stage===1?`<div class="muted">検索スコア ${row.shortlist.find(p=>p.id===id).score.toFixed(2)}（確率ではありません）</div>`:''}${stage>=3&&prob!==undefined?`<div class="probability"><span>適合</span><progress value="${prob}" max="1" aria-label="適合確率 ${prob.toFixed(2)}"></progress><strong>${prob.toFixed(2)}</strong></div><div class="muted">元の検索順位：${original+1}位</div>`:''}${stage===2?`<div class="reason">${excluded?gold.violations.map(v=>esc(reasons[v])).join(' / '):'条件通過'}</div>`:''}<div><span class="status ${gold.relevant?'':'bad'}">実験の採点：${gold.relevant?'正解に数える':'対象外'}</span></div><button type="button" class="open-material" data-material="${id}">本文・答え・採点根拠を見る ↗</button></article>`;
  }
  function renderStage() {
    const row=rows.get(selectedCase),q=cases.get(selectedCase),chosen=model.selected(row,threshold);
    const counts=[40,12,row.candidates.length,row.ranked.length,chosen.length];
    $('pipeline').innerHTML=stageNames.map((name,i)=>`<button type="button" data-stage="${i}" class="${stage===i?'active':''}" aria-pressed="${stage===i}"><span class="step-number">STEP ${i+1}</span>${name}<span class="step-count">${counts[i]}件</span></button>`).join('');
    $('stage-title').textContent=`${stage+1}. ${stageNames[stage]}`;
    $('stage-description').textContent=stageDescriptions[stage];
    $('previous').disabled=stage===0;$('next').disabled=stage===4;
    const inPool=row.goldRelevantIds.filter(id=>row.shortlist.some(p=>p.id===id));
    const call=calls.get(selectedCase);
    const summaries=[
      `この要求に対する採点表で正解とした教材：${row.goldRelevantIds.length} / 40件。カードのラベルは採点用で、Jevには渡していません。`,
      `検索候補内の適合教材：${inPool.length}件 / 全${row.goldRelevantIds.length}件。${row.goldRelevantIds.length&&!inPool.length?'この段階で正解候補がすべて落ちています。':'この12件を後続の全手法で共有します。'}`,
      `${row.candidates.length}件通過、${12-row.candidates.length}件除外。${!row.candidates.length?'候補がないためAPIは呼びません。':'灰色の候補はJevへの入力に入りません。'}`,
      call?`候補${row.candidates.length}件を1回のAPI呼び出しで判定。実測${call.elapsedMs}ms / 推定$${call.costUsd.toFixed(8)}。高い順に並べ、同点は検索順位を維持。`:'条件通過候補が0件のため、API呼び出し・費用ともに0。判定値を補ってはいません。',
      `下限${threshold.toFixed(2)}で${chosen.length}件提示。${threshold===.65?'実験で固定した下限と同じです。':'実験後の再集計です。新しい推論結果ではありません。'} 採点表の正解する教材は${chosen.filter(id=>q.judgments[id].relevant).length}件。`
    ];
    $('stage-summary').textContent=summaries[stage];
    const ids=model.stageIds(row,data.materials,stage,threshold),visible=stage===0&&!showAll?ids.slice(0,9):ids;
    $('materials').innerHTML=visible.length?visible.map((id,i)=>card(id,i,row,q)).join(''):'<div class="none">この段階に残る教材はありません。<br>「該当なし」は、候補・条件・足切り値の結果です。</div>';
    if(visible.length<ids.length)$('materials').insertAdjacentHTML('beforeend',`<div class="none">40件中9件を表示しています。<br><button type="button" data-expand>全40件を見る</button></div>`);
  }
  function renderComparison() {
    const q=cases.get(selectedCase),r=rows.get(selectedCase);
    const methods=[['検索だけ',r.output.retrieval],['条件フィルター',r.output.filtered],['Jevの並べ替え',r.output.jevRanked],[`下限${threshold.toFixed(2)}で提示`,model.selected(r,threshold)]];
    $('comparison').innerHTML=methods.map(([name,ids])=>{
      const m=materials.get(ids[0]),relevant=m&&q.judgments[m.id].relevant;
      return `<div><div class="method-label">${esc(name)}</div><p>${m?esc(m.title):'表示なし'}</p><strong class="${relevant?'pass':'fail'}">${m?(relevant?'採点表の正解':'採点表では対象外'):(r.goldRelevantIds.length?'適合教材は存在する':'該当なしと一致')}</strong>${m?`<p><button type="button" class="open-material" data-material="${m.id}">${esc(m.id)}を確認</button></p>`:''}</div>`;
    }).join('');
  }
  function renderRaw() {
    const call=calls.get(selectedCase),container=$('raw-content');container.replaceChildren();
    if(!call){container.textContent='このケースでは条件通過候補がなく、APIを呼んでいません。';return;}
    for(const [title,value] of [['APIへのリクエスト',call.request],['APIからのレスポンス',call.response]]){const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('pre');s.textContent=title;p.textContent=JSON.stringify(value,null,2);d.append(s,p);container.append(d);}
  }
  function openMaterial(id) {
    const m=materials.get(id),q=cases.get(selectedCase),row=rows.get(selectedCase),j=q.judgments[id];
    const pool=row.shortlist.findIndex(v=>v.id===id),p=row.ranked.find(v=>v.id===id);
    $('dialog-title').textContent=`${m.id} · ${m.title}`;
    $('dialog-body').innerHTML=`<div class="full-body">${esc(m.body)}</div>${m.answer?`<p><b>模範解答：</b>${esc(m.answer)}</p>`:''}<dl><dt>形式・想定時間</dt><dd>${esc(format(m.format))} / ${m.minutes}分（実験用の想定）</dd><dt>前提知識</dt><dd>${esc(m.prerequisites.map(s=>skills.get(s)||s).join('、')||'指定なし')}</dd><dt>この授業に対する実験前に決めた採点</dt><dd>目標タグ：${j.topicMatch?'一致':'不一致'}\n条件違反：${esc(j.violations.map(v=>reasons[v]).join('、')||'なし')}\n結論：${j.relevant?'正解に数える':'対象外'}</dd><dt>実験での扱い</dt><dd>${pool<0?'検索上位12件の外':`検索${pool+1}位`}\n${p?`Jevの適合確率：${p.probability.toFixed(2)}`:'Jevの判定対象外'}</dd></dl><p class="muted">「適合」の採点用の基準は、目標タグ一致＋条件通過で自動付与したものです。先生がこの教材を採用した実績ではありません。</p>`;
    $('material-dialog').showModal();
  }
  function renderResults() {
    const names={retrieval:'検索だけ',filtered:'検索＋条件フィルター',jevRanked:'さらにJevで並べ替え',jevSelected:'Jev 0.65以上だけ提示'};
    $('results-body').innerHTML=Object.entries(names).map(([k,name])=>{const s=data.summary.metrics[k];return `<tr><th scope="row">${name}</th><td>${Math.round(s.top1*24)} / 24<br><span class="muted">${(s.top1*100).toFixed(1)}%</span></td><td>${Math.round(s.successAt3*24)} / 24</td><td>${s.constraintViolations}件</td><td>${s.noMatchFalseRecommendations} / 10</td></tr>`;}).join('');
    const s=data.summary;
    $('costs').innerHTML=`<article><p>Jev API · 25回の実測</p><strong>${s.latencyMs.api.p50} ms</strong><p>中央値 / p95 ${s.latencyMs.api.p95}ms</p></article><article><p>34ケース全体の推定費用</p><strong>$${s.cost.totalUsd.toFixed(5)}</strong><p>1ケース平均 $${s.cost.perQueryUsd.mean.toFixed(8)}</p></article><article><p>候補への判定をまとめて実行</p><strong>${s.apiCalls}回 / ${s.scoredPairs}候補</strong><p>${s.skippedQueries}ケースはAPI不要。検索＋条件処理は中央値${s.latencyMs.filtered.p50.toFixed(2)}ms。</p></article>`;
    renderThreshold();
  }
  function renderThreshold() {
    $('threshold').value=threshold;$('threshold-value').value=threshold.toFixed(2);$('threshold-value').textContent=threshold.toFixed(2);
    const s=model.selectionSummary(data.rows,threshold);
    const values=[['最初の教材が正解',`${s.top1} / ${s.answerable}`,'適合教材がある要求'],['3件以内に正解',`${s.success} / ${s.answerable}`,'表示を減らすと取りこぼしも'],['表示した教材のうち正解',s.shown?`${(100*s.relevantShown/s.shown).toFixed(1)}%`:'表示なし',`${s.relevantShown} / ${s.shown}教材`],['該当なしへの誤推薦',`${s.falseRecommendations} / ${s.noMatch}`,'教材がない要求']];
    $('threshold-stats').innerHTML=values.map(([label,value,note])=>`<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  }
  $('threshold').addEventListener('input',e=>{threshold=Number(e.target.value);renderThreshold();renderComparison();renderStage();});
  $('reset-threshold').addEventListener('click',()=>{threshold=.65;renderThreshold();renderComparison();renderStage();});
  const storySteps = [
    ['先生は何を探した？', '<p>「分母をなくすため、全ての項に同じ数を掛ける操作」を練習させたい。条件は<strong>問題形式・2分以内</strong>です。</p><p>授業では既にその操作を説明した、という文脈も渡しました。Jevに教師の意図をゼロから推測させてはいません。</p>'],
    ['AIを使う前に、どこまで絞れた？', '<p>40教材を文章の一致で検索して12件に絞り、形式・時間・既習事項をコードで確認しました。</p><p class="story-value">40件 → 12件 → 4件</p><p>この4件を、検索順位のまま見せる場合と、Jevで並べ替える場合で比較します。</p>'],
    ['検索順位のままだと、最初はこれ', '<div class="story-pair"><article><h3>3x = 12 を解こう。</h3><p>実際に条件チェック後の先頭に残った教材です。方程式を解く教材で、形式と時間は合っています。</p></article><article><h3>先生の目的との違い</h3><p>練習するのは両辺を3で割る操作。今回練習させたい「分母をなくすため全ての項に掛ける操作」とは違います。</p></article></div>'],
    ['Jevには、何を聞いた？', '<blockquote>授業の実績と課題の目標に対して、この教材をそのまま使うのは適切ですか？</blockquote><p>4教材それぞれについて独立に聞きました。4つの質問を1回のAPI呼び出しにまとめています。採点用の答え合わせ表は渡していません。</p>'],
    ['Jevが先頭に上げたのは、これ', '<div class="story-pair"><article><h3>x/2 + 3 = 7 の両辺に2を掛けると？</h3><p>正解は x + 6 = 14。定数項の3にも2を掛けられるかを確認します。</p></article><article><h3>保存された判定値</h3><p class="story-value">0.84</p><p>この教材が4候補の中で最高。両辺で割り算する問題は0.08でした。0.84は実験の正答率ではありません。</p></article></div>'],
    ['この1件では、何が改善した？', '<p>同じ4候補の中で、先頭が<strong>「両辺を割る問題」から「分母をなくす問題」</strong>に変わりました。こちらの採点表でも、後者を正解としていました。</p><p>これは改善した1例です。次の全体結果では、同じ改善が他の依頼でも起きたかを数えます。全ての依頼で改善したわけではありません。</p><p><a href="#results">全34件の結果へ ↓</a></p>']
  ];
  let storyIndex=0;
  function renderStory(){
    $('story-progress').textContent=`${storyIndex+1} / ${storySteps.length}`;
    $('story-content').innerHTML=`<h3>${storySteps[storyIndex][0]}</h3>${storySteps[storyIndex][1]}`;
    $('story-prev').disabled=storyIndex===0;
    $('story-next').disabled=storyIndex===storySteps.length-1;
    $('story-next').textContent=storyIndex===storySteps.length-1?'ここまでが1件の流れ':'次へ →';
  }
  $('story-prev').addEventListener('click',()=>{storyIndex=Math.max(0,storyIndex-1);renderStory();});
  $('story-next').addEventListener('click',()=>{storyIndex=Math.min(storySteps.length-1,storyIndex+1);renderStory();});
  renderStory();
  renderCase();renderResults();
})();
