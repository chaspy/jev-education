import { parseNumericAnswer } from './math.js';
import { skills, problems, skillById } from './content.js';
const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
let current = problems[0];
let result = null;
let busy = false;
let generation = 0;
const positions = {
  'signed-add': [15, 25], letter: [325, 25],
  'signed-multiply': [15, 115], 'like-terms': [215, 115], balance: [415, 115],
  distribution: [15, 210], transpose: [415, 210],
  fraction: [15, 310], equation: [215, 310], verify: [415, 355]
};
const labels = { ...Object.fromEntries(skills.map(s => [s.id, s.name])), arithmetic: '計算の見直し', correct: '正しい解答', incomplete: '途中まで正しい', unknown: '判断する情報が不足' };

function svgNode(tag, attrs, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
}
function pathEdges(from, to, visited = new Set()) {
  if (from === to) return [];
  if (visited.has(from)) return null;
  visited.add(from);
  for (const next of skills.filter(s => s.prerequisites.includes(from))) {
    const tail = pathEdges(next.id, to, new Set(visited));
    if (tail) return [`${from}:${next.id}`, ...tail];
  }
  return null;
}
function drawMap(selected) {
  const map = $('map'); map.replaceChildren();
  const defs = svgNode('defs', {});
  const marker = svgNode('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
  marker.append(svgNode('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#9cae9b' })); defs.append(marker); map.append(defs);
  const edges = pathEdges(selected, current.skill) || [];
  for (const skill of skills) {
    for (const parent of skill.prerequisites) {
      const [x1, y1] = positions[parent], [x2, y2] = positions[skill.id];
      map.append(svgNode('path', { d: `M ${x1 + 83} ${y1 + 42} C ${x1 + 83} ${y1 + 67}, ${x2 + 83} ${y2 - 25}, ${x2 + 83} ${y2}`, class: `edge ${edges.includes(`${parent}:${skill.id}`) ? 'path' : ''}`, 'marker-end': 'url(#arrow)' }));
    }
  }
  for (const skill of skills) {
    const [x, y] = positions[skill.id];
    const node = svgNode('g', { class: `node ${skill.id === current.skill ? 'target' : ''} ${skill.id === selected ? 'active' : ''}`, role: 'button', tabindex: '0', 'aria-label': `${skill.name}の教材を見る` });
    node.append(svgNode('rect', { x, y, width: 166, height: 42, rx: 9 }), svgNode('text', { x: x + 83, y: y + 26, 'text-anchor': 'middle' }, skill.short));
    const open = () => { if (!busy) { drawMap(skill.id); showLesson(skill.id, 'マップから選んだ復習教材'); } };
    node.addEventListener('click', open);
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    map.append(node);
  }
}
function reset() {
  generation++;
  result = null;
  for (const id of ['insight', 'learning', 'retry', 'debug']) $(id).hidden = true;
  $('status').textContent = ''; $('status').className = '';
  $('expression').textContent = current.expression;
  $('work').value = '';
  $('examples').replaceChildren();
  for (const example of current.examples) {
    const button = el('button', example.label); button.type = 'button';
    button.addEventListener('click', () => { if (!busy) { $('work').value = example.text; $('work').focus(); } });
    $('examples').append(button);
  }
  $('flow').replaceChildren(el('h3', '途中式から、戻り先の候補を探します。'), el('p', 'サンプルを選ぶか、自分の解き方を入力してください。マップの各項目から教材を直接見ることもできます。'));
  drawMap();
}
for (const p of problems) { const option = el('option', p.title); option.value = p.id; $('problem').append(option); }
$('problem').addEventListener('change', () => { current = problems.find(p => p.id === $('problem').value); reset(); });
$('work').addEventListener('input', () => {
  if (result) { $('status').textContent = '入力を変更しました。表示中の結果は前回の答案に対するものです。'; }
});

$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const work = $('work').value.trim();
  if (!work) { $('status').textContent = '途中式を入力してください。'; return; }
  const version = ++generation;
  busy = true; $('diagnose').disabled = true; $('problem').disabled = true; $('work').disabled = true;
  document.querySelectorAll('#examples button').forEach(b => b.disabled = true);
  $('status').className = ''; $('status').textContent = 'Jev が途中式を確認しています…';
  for (const id of ['insight', 'learning', 'retry', 'debug']) $(id).hidden = true;
  $('flow').replaceChildren(el('p', '判定中…'));
  drawMap();
  const started = performance.now();
  try {
    const response = await fetch('/api/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemId: current.id, work }), signal: AbortSignal.timeout(35000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '判定に失敗しました。');
    if (version !== generation) return;
    result = { ...data, totalMs: Math.round(performance.now() - started), observedAt: new Date().toISOString() };
    $('status').textContent = '判定が届きました。確認問題で確かめましょう。';
    renderResult();
  } catch (error) {
    result = null;
    $('status').className = 'error'; $('status').textContent = error.name === 'TimeoutError' ? '時間がかかっています。もう一度お試しください。' : error.message;
    $('flow').replaceChildren(el('p', '判定できませんでした。入力は残っています。再実行できます。'));
  } finally {
    busy = false; $('diagnose').disabled = false; $('problem').disabled = false; $('work').disabled = false;
    document.querySelectorAll('#examples button').forEach(b => b.disabled = false);
  }
});
function renderResult() {
  const { answer, recommendation: rec } = result;
  $('insight').hidden = false; $('insight').replaceChildren();
  const titles = { candidate: 'ここを確認してみましょう', correct: '正しい解き方と判定されました', uncertain: '戻り先は、まだ絞れません', incomplete: '続きの途中式を見せてください', arithmetic: 'まず計算を見直してみましょう' };
  const heading = el('div', undefined, 'candidate');
  heading.append(el('span', 'JEV の候補 / 理解度の診断ではありません', 'eyebrow'), el('h3', titles[rec.mode]));
  if (rec.skillId && rec.mode === 'candidate') heading.append(el('p', labels[rec.skillId]));
  $('insight').append(heading);
  for (const [id, p] of Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    const row = el('div', undefined, 'probability'), bar = el('progress'); bar.max = 1; bar.value = p; bar.setAttribute('aria-label', labels[id]);
    row.append(el('span', labels[id]), bar, el('span', `${Math.round(p * 100)}%`)); $('insight').append(row);
  }
  $('insight').append(el('p', '候補間の確率です。正解率や、その内容を理解していない確率ではありません。', 'small'));
  drawMap(rec.skillId);
  $('flow').replaceChildren();
  if (rec.mode === 'candidate') showCheck(rec.skillId);
  else if (rec.mode === 'correct') {
    $('flow').append(el('h3', '最後は、元の式に代入して確認。'), el('p', 'AI の判定に加え、数値の解をコードでも照合できます。'));
    showRetry();
    action($('flow'), '解の確認を復習する', () => showLesson('verify', '解を確かめる教材'));
  } else if (rec.mode === 'incomplete') {
    $('flow').append(el('h3', '途中までは正しそうです。'), el('p', 'x の値まで計算し、途中式を追記してもう一度実行してください。'));
  } else if (rec.mode === 'arithmetic') {
    $('flow').append(el('h3', '一度の計算ミスでは、単元の理解不足とは言えません。'), el('p', '途中の数値計算を見直すか、元の問題にもう一度取り組んでみましょう。'));
    showRetry(); action($('flow'), '正負の数の確認問題を試す', () => showCheck('signed-add'));
  } else {
    $('flow').append(el('h3', '途中式を追加するか、確認したい内容を選びましょう。'), el('p', '答えだけでは、どこでつまずいたか判断できないことがあります。'));
    for (const id of current.candidates) action($('flow'), labels[id], () => { drawMap(id); showCheck(id); });
  }
  $('debug').hidden = false;
  $('raw-request').textContent = JSON.stringify(result.request, null, 2);
  $('raw-response').textContent = JSON.stringify(result.response, null, 2);
  $('metrics').replaceChildren(
    el('p', `API ${result.elapsedMs} ms · 全体 ${result.totalMs} ms · ${result.response.model}`),
    el('p', `推定コスト ${result.costUsd === null ? '不明' : `$${result.costUsd.toFixed(8)} USD`} · 入力 ${result.response.usage?.input_tokens ?? '不明'} / 出力 ${result.response.usage?.output_tokens ?? '不明'} tokens`)
  );
  const price = el('a', '料金根拠：入力 $0.042 / 100万 tokens・出力無料（2026-09-20確認）'); price.href = 'https://docs.typesafe.ai/models'; price.target = '_blank'; price.rel = 'noreferrer'; $('metrics').append(price);
}
function action(parent, title, handler, primary = false) {
  const button = el('button', title, primary ? 'primary' : 'secondary'); button.type = 'button'; button.addEventListener('click', handler); parent.append(button); return button;
}
function showCheck(id) {
  const skill = skillById[id];
  $('learning').hidden = true; $('retry').hidden = true;
  const flow = $('flow'); flow.replaceChildren(el('span', 'まずは1問、確かめる', 'eyebrow'), el('h3', skill.check.prompt));
  const choices = el('div', undefined, 'choices');
  skill.check.choices.forEach((choice, index) => {
    const b = action(choices, choice, () => {
      choices.querySelectorAll('button').forEach((n, i) => { n.disabled = true; if (i === skill.check.answer) n.classList.add('correct'); });
      b.classList.add('selected');
      const passed = index === skill.check.answer;
      flow.append(el('div', `${passed ? '正解です。この1問では、つまずきは確認されませんでした。' : 'この操作を、いったん復習してみましょう。'} ${skill.check.explanation}`, 'feedback'));
      if (passed) {
        action(flow, '元の問題に再挑戦する', showRetry, true);
        action(flow, '念のため復習教材を見る', () => showLesson(id, '任意の復習教材'));
      } else {
        showLesson(id, '確認問題をもとにした復習候補');
      }
    });
  });
  flow.append(choices, el('p', '1問の結果で理解度は確定しません。復習する場所を探すための確認です。', 'small'));
}
function showLesson(id, context) {
  const skill = skillById[id];
  const section = $('learning'); section.hidden = false; section.replaceChildren();
  section.append(el('span', `03 / ${context}`, 'eyebrow'), el('h2', `${skill.name} · 約${skill.minutes}分`));
  const grid = el('div', undefined, 'learning-grid'), lesson = el('div'), practice = el('div');
  lesson.append(el('h3', '短い解説'), el('p', skill.intro));
  const list = el('ol', undefined, 'lesson-steps'); skill.steps.forEach(step => list.append(el('li', step))); lesson.append(list);
  practice.append(el('h3', '練習してみよう'));
  for (const [index, item] of skill.practice.entries()) {
    const block = el('div', undefined, 'practice'); block.append(el('p', `${index + 1}. ${item.q}`));
    const details = el('details'); details.append(el('summary', '答えを確認する'), el('p', item.a)); block.append(details); practice.append(block);
  }
  grid.append(lesson, practice); section.append(grid);
  const source = el('p', undefined, 'lesson-source');
  source.append(document.createTextNode('教材・前提関係：本デモ独自の編集（CC BY 4.0）。対応する学習内容：'));
  const link = el('a', '学習指導要領LOD'); link.href = `https://jp-cos.github.io/${skill.source}`; link.target = '_blank'; link.rel = 'noreferrer'; source.append(link); section.append(source);
  const tools = el('div', undefined, 'toolbar');
  action(tools, '元の問題に再挑戦 →', showRetry, true);
  action(tools, '宿題セットを保存', () => download(`もどり道-${id}.md`, homework(skill), 'text/markdown;charset=utf-8'));
  section.append(tools, el('p', '宿題セットは解説・練習2問・元の問題をまとめた Markdown ファイルです。末尾に先生用の解答を含みます。', 'small'));
}
function homework(skill) {
  return `# 復習：${skill.name}\n\n目安：約${skill.minutes + 5}分\n\n## 解説\n${skill.steps.map(x => `- ${x}`).join('\n')}\n\n## 練習\n${skill.practice.map((p, i) => `${i + 1}. ${p.q}`).join('\n')}\n\n## 元の問題に再挑戦\n${current.expression} を解きなさい。\n\n---\n## 先生用の解答（配布時は必要に応じて削除）\n${skill.practice.map((p, i) => `${i + 1}. ${p.a}`).join('\n')}\n元の問題：x = ${current.answer}\n\n教材：chaspy / jev-education, CC BY 4.0\nhttps://creativecommons.org/licenses/by/4.0/\n学習内容の出典：学習指導要領LOD https://jp-cos.github.io/${skill.source}\n前提関係と教材の対応はデモ独自の編集です。\n`;
}
function showRetry() {
  const section = $('retry'); section.hidden = false;
  section.replaceChildren(el('span', '04 / もう一度', 'eyebrow'), el('h2', `${current.expression} を解いてみよう`));
  const form = el('form'); form.id = 'retry-form';
  const field = el('div'), label = el('label', 'x の値'); label.htmlFor = 'retry-answer';
  const input = el('input'); input.id = 'retry-answer'; input.placeholder = '例：3、−4、13/3'; input.required = true; input.maxLength = 40; field.append(label, input);
  const button = el('button', '答え合わせ', 'primary'); button.type = 'submit'; form.append(field, button);
  const feedback = el('p'); feedback.setAttribute('role', 'status');
  form.addEventListener('submit', e => {
    e.preventDefault(); const value = parseNumericAnswer(input.value);
    feedback.textContent = value === null ? '数値または分数で入力してください。' : Math.abs(value - current.answer) < 1e-9 ? '正解です！元の問題に戻って解けました。数値の一致をコードで確認しました。' : 'まだ一致しません。解説や途中式を見直して、もう一度試しましょう。';
  });
  section.append(form, feedback);
  const solution = el('details'); solution.append(el('summary', '解き方の例を見る')); current.solution.forEach(x => solution.append(el('p', x))); section.append(solution);
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download-log').addEventListener('click', () => { if (result) download(`jev-${result.id}.json`, JSON.stringify(result, null, 2), 'application/json'); });
reset();
