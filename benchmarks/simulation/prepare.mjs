import { writeFile } from 'node:fs/promises';
// Author-defined error procedures, not empirically estimated student behavior.
const labels = {
  distribution: '分配法則で、かっこ内の定数項に係数を掛け忘れるつまずき。',
  signed: '移項・減算で符号を取り違え、引くべき定数を足してしまうつまずき。',
  balance: '等式の片辺だけから数を引き、もう片辺に同じ操作をしないつまずき。',
  mixed: '分配法則の掛け忘れと、移項・減算の符号の取り違えの両方につまずきがある。',
  slip: '上記の持続的なつまずきはなく、今回の誤答は一時的なミス。'
};
const weak = { distribution: ['distribution'], signed: ['signed'], balance: ['balance'], mixed: ['distribution','signed'], slip: [] };
const probes = [
  { id:'p1', skill:'distribution', question:'4(y + 3) を展開してください。', correctAnswer:'4y + 12', wrongAnswer:'4y + 3' },
  { id:'p2', skill:'signed', question:'z + 5 = 12 の両辺から5を引くと、zはいくつですか。', correctAnswer:'7', wrongAnswer:'17' },
  { id:'p3', skill:'balance', question:'z + 4 = 11 で左辺から4を引きます。等式を保つため右辺はどんな式にしますか。', correctAnswer:'11 - 4', wrongAnswer:'11のまま' }
];
const problems = [[3,2,15],[2,3,14],[4,2,24]];
const regimes = ['clean','lucky','careless'];
const cases = [];
const originalAnswer = (label,a,b,c) => ({distribution:(c-b)/a,signed:c/a+b,balance:c/a,mixed:(c+b)/a,slip:c/a-b+1})[label];
const number = x => Number(x.toFixed(6)).toString();
for (const [index,[a,b,c]] of problems.entries()) {
  for (const [label, skills] of Object.entries(weak)) {
    for (const initialMode of ['systematic','incidental']) {
      // An incidental numerical slip hides the underlying profile in the initial answer.
      const answer = initialMode === 'systematic' ? originalAnswer(label,a,b,c) : c/a-b+2;
      for (const regime of regimes) {
        const targetSkills = regime === 'lucky' ? skills : probes.map(p=>p.skill).filter(s=>!skills.includes(s));
        const flippedSkill = regime === 'clean' || !targetSkills.length ? null : targetSkills[index % targetSkills.length];
        const responses = Object.fromEntries(probes.map(probe => {
          let correct = !skills.includes(probe.skill);
          if (probe.skill === flippedSkill) correct = !correct;
          return [probe.id, { answer:correct ? probe.correctAnswer : probe.wrongAnswer, correct }];
        }));
        cases.push({ id:`q${index+1}-${label}-${initialMode}-${regime}`, group:`q${index+1}-${label}-${initialMode}`,
          expected:[label], hidden:{weakSkills:skills,regime,initialMode,flippedSkill},
          initial:{question:`${a}(x + ${b}) = ${c} を解いてください。`,correctAnswer:number(c/a-b),studentAnswer:number(answer)}, responses });
      }
    }
  }
}
const data = { version:1, license:'CC BY 4.0', author:'chaspy/jev-education, AI-assisted; not educator-reviewed',
  provenance:'All fictional. No MaE rows or real student records. All answers fixed before inference.',
  labels, probes, cases,
  assumptions:['Five balanced latent profiles; an additional unknown output is permitted.',
    'Three fixed equations, two initial-error modes, three probe-response regimes yield 90 scenarios in 30 paired groups.',
    'clean uses deterministic skill mastery; lucky flips one weak skill to correct; careless flips one mastered skill to wrong. These are stress scenarios, not population frequencies.',
    'Mixed profiles have two weaknesses. One probe cannot in general identify the entire profile.',
    'Incidental initial errors can occur in any latent profile. Latent truth is not uniquely identifiable from every observable transcript.',
    'No learning occurs during the probe; this measures diagnosis under an authored simulator, not learning gains.'] };
await writeFile(new URL('../data/synthetic-followup.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Prepared ${cases.length} frozen synthetic scenarios`);
