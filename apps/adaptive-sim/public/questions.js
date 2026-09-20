// Original CC BY 4.0 exercise templates. No external textbook questions.
export function random(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const fmt=n=>Number.isInteger(n)?String(n):String(Number(n.toFixed(4)));
export function question(id,seed){const r=random(seed),int=(lo,hi)=>lo+Math.floor(r()*(hi-lo+1));const a=int(2,8),b=int(2,8),c=int(2,6);let prompt,answer,explanation,visual=null,wrong=[];
 switch(id){
 case'add':prompt=`${a} + ${b} = ?`;answer=a+b;explanation=`${a}個に${b}個を合わせて${answer}個。`;wrong=[a-b,a*b];break;
 case'sub':prompt=`${a+b} − ${b} = ?`;answer=a;explanation=`${a+b}個から${b}個を取ると${a}個。`;wrong=[a+2*b,b];break;
 case'shape':{const n=int(0,1)?3:4;prompt=`${n===3?'さんかく':'しかく'}の、かどはいくつ？`;answer=n;explanation=`かどを1つずつ数えると${n}つ。`;visual={kind:n===3?'triangle':'rectangle',labels:false};break;}
 case'add2':prompt=`${a*10+b} + ${c*10+a} = ?`;answer=(a+c)*10+b+a;explanation=`十の位を合わせて${(a+c)*10}、一の位を合わせて${a+b}。合計${answer}。`;break;
 case'multiply':prompt=`${a} × ${b} = ?`;answer=a*b;explanation=`${a}が${b}つ分で${answer}。`;wrong=[a+b,a*(b-1)];break;
 case'length':prompt=`${a} m は何 cm？`;answer=a*100;explanation=`1 m = 100 cm。${a} × 100 = ${answer} cm。`;wrong=[a*10,a];break;
 case'divide':prompt=`${a*b} ÷ ${b} = ?`;answer=a;explanation=`${b} × ${a} = ${a*b}なので、商は${a}。`;wrong=[a*b-b,b];break;
 case'decimal':prompt=`${fmt(a/10)} + ${fmt(b/10)} = ?`;answer=(a+b)/10;explanation=`0.1が${a+b}個なので${fmt(answer)}。`;wrong=[a+b,Math.abs(a-b)/10];break;
 case'diameter':prompt=`半径${a} cmの円の直径は何 cm？`;answer=2*a;explanation=`直径は半径の2倍。${a} × 2 = ${answer} cm。`;visual={kind:'circle',r:a};wrong=[a,a*a];break;
 case'fraction':prompt=`1/${a} + 1/${a} = □/${a}。□は？`;answer=2;explanation=`分母は${a}のまま、分子1+1=2。約分前の分子を答える。`;wrong=[1,a*2];break;
 case'rectangle':prompt=`縦${a} cm、横${b} cmの長方形の面積は何 cm²？`;answer=a*b;explanation=`縦×横 = ${a} × ${b} = ${answer} cm²。`;visual={kind:'rectangle',a,b};wrong=[2*(a+b),a+b];break;
 case'angle':prompt=`直角${int(1,3)}個分の角度は何度？`;{const n=Number(prompt.match(/直角(\d)/)[1]);answer=90*n;explanation=`直角は90°。90 × ${n} = ${answer}°。`;}break;
 case'fraction2':prompt=`1/${a} + 1/${a*2} = □/${a*2}。通分後の□は？`;answer=3;explanation=`1/${a} = 2/${a*2}なので、2+1=3。約分前の分子を答える。`;wrong=[2,1];break;
 case'percent':prompt=`${a*100}円の${b*10}%は何円？`;answer=a*10*b;explanation=`${a*100} × ${fmt(b/10)} = ${answer}円。`;wrong=[a*b,a*100-b*10];break;
 case'volume':prompt=`縦${a} cm、横${b} cm、高さ${c} cmの直方体の体積は何 cm³？`;answer=a*b*c;explanation=`縦×横×高さ = ${a} × ${b} × ${c} = ${answer} cm³。`;wrong=[a*b,a+b+c];break;
 case'fraction3':prompt=`${a}/${a+1} × ${b}/${b+1} = □/${(a+1)*(b+1)}。約分前の□は？`;answer=a*b;explanation=`分子どうし、分母どうしを掛ける。分子は${a} × ${b} = ${answer}。`;wrong=[a+b,a*(b+1)];break;
 case'ratio':prompt=`赤:青 = ${a}:${b}。赤が${a*c}個なら青は何個？`;answer=b*c;explanation=`赤が${c}倍なので、青も${b} × ${c} = ${answer}個。`;wrong=[b,a*c];break;
 case'circle':prompt=`半径${a} cmの円の面積は何 cm²？ 円周率は3.14とする。`;answer=Number((a*a*3.14).toFixed(2));explanation=`半径×半径×3.14 = ${a} × ${a} × 3.14 = ${answer} cm²。`;visual={kind:'circle',r:a};wrong=[Number((2*a*3.14).toFixed(2)),a*a];break;
 case'signed':prompt=`(−${a}) + ${b} = ?`;answer=b-a;explanation=`${a}と${b}の差をとり、絶対値が大きい側の符号にする。答えは${answer}。`;wrong=[a+b,-a-b,a-b];break;
 case'equation':prompt=`${a}x + ${b} = ${a*c+b}。xは？`;answer=c;explanation=`両辺から${b}を引き、${a}で割る。x = ${a*c} ÷ ${a} = ${c}。`;wrong=[a*c,(a*c+2*b)/a];break;
 case'proportion':prompt=`y = ${a}x。x = ${b}のときyは？`;answer=a*b;explanation=`xに${b}を代入して、y = ${a} × ${b} = ${answer}。`;wrong=[a+b,b/a];break;
 case'simultaneous':prompt=`x + y = ${a+b}、x − y = ${a-b}。xは？`;answer=a;explanation=`2式を足すと2x = ${2*a}。したがってx = ${a}。`;wrong=[a+b,b,2*a];break;
 case'linear':prompt=`y = ${a}x + ${c}。x = ${b}のときyは？`;answer=a*b+c;explanation=`y = ${a} × ${b} + ${c} = ${answer}。`;wrong=[a*b,a+b+c];break;
 case'triangle':prompt=`三角形の2つの内角が${a*10}°と${b*10}°。残りの角は何度？`;answer=180-a*10-b*10;explanation=`内角の和は180°。180 − ${a*10} − ${b*10} = ${answer}°。`;visual={kind:'triangle',a:a*10,b:b*10};wrong=[a*10+b*10,360-a*10-b*10];break;
 case'quadratic':prompt=`x² = ${a*a} の正の解は？`;answer=a;explanation=`x = ±${a}。正の解だけを聞いているので${a}。`;wrong=[-a,a*a,a*a/2];break;
 case'quadraticFn':prompt=`y = ${a}x²。x = ${b}のときyは？`;answer=a*b*b;explanation=`xを先に2乗して、${a} × ${b*b} = ${answer}。`;wrong=[a*b,(a*b)**2];break;
 case'pythagorean':prompt=`直角をはさむ2辺が${3*a} cmと${4*a} cm。斜辺の長さは何 cm？`;answer=5*a;explanation=`斜辺² = ${3*a}² + ${4*a}² = ${25*a*a}。正の平方根は${answer}。`;visual={kind:'triangle',right:true,a:3*a,b:4*a};wrong=[7*a,a];break;
 case'minimum':prompt=`y = (x − ${a})² + ${b} の最小値は？`;answer=b;explanation=`2乗は0以上。x=${a}のとき0になり、最小値は${b}。`;wrong=[a,-b,a*a+b];break;
 case'trig':prompt=`直角三角形で、斜辺が${2*a} cm、角θの向かい側の辺が${a} cm。sin θは？`;answer=.5;explanation=`sin θ = 対辺 ÷ 斜辺 = ${a}/${2*a} = 0.5。`;wrong=[2,a,1];break;
 case'probability':prompt=`赤球${a}個、青球${b}個の袋から1個取り出す。赤の確率を${a}/□と書く。□は？`;answer=a+b;explanation=`全体は${a+b}個なので、赤の確率は${a}/${a+b}。約分前の分母を答える。`;wrong=[a,b,a*b];break;
 case'sequence':prompt=`初項${a}、公差${b}の等差数列の第${c}項は？`;answer=a+(c-1)*b;explanation=`初項+(項数−1)×公差 = ${a} + ${c-1} × ${b} = ${answer}。`;wrong=[a+c*b,a*b*c];break;
 case'log':prompt=`log₂(${2**c}) = ?`;answer=c;explanation=`2の${c}乗が${2**c}なので、対数は${c}。`;wrong=[2**c,2,c+1];break;
 case'derivative':prompt=`f(x) = ${a}x²。x = ${b}での微分係数f′(${b})は？`;answer=2*a*b;explanation=`f′(x) = ${2*a}x。x=${b}を代入して${answer}。`;wrong=[a*b*b,2*a,a*b];break;
 case'integral':prompt=`∫₀^${b} ${3*a}x² dx = ?`;answer=a*b**3;explanation=`原始関数は${a}x³。${a} × ${b}³ − 0 = ${answer}。`;wrong=[3*a*b*b,a*b*b];break;
 case'vector':prompt=`ベクトルu=(${a}, ${b})、v=(${c}, 1)。内積u·vは？`;answer=a*c+b;explanation=`対応する成分を掛けて足す。${a} × ${c} + ${b} × 1 = ${answer}。`;wrong=[a+b+c+1,a*b*c];break;
 case'limit':prompt=`数列 aₙ = ${a}/n。nを限りなく大きくするときの極限は？`;answer=0;explanation=`分子${a}は一定で分母nが大きくなるので、0に近づく。`;wrong=[a,1,-a];break;
 default:throw new Error(`Unknown template ${id}`);
 }
 answer=Number(answer.toFixed(6));wrong=[...new Set([...wrong,answer+1,answer-1,answer+2].map(n=>Number(n.toFixed(6))))].filter(n=>Number.isFinite(n)&&n!==answer).slice(0,3);
 return {id:`${id}-${seed}`,skill:id,prompt,answer,explanation,wrong,visual,license:'CC BY 4.0 · デモ自作'};
}
