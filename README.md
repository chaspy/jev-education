# jev-education

教育向け Jev アプリの公開実験。業務データ・実在する学習者のデータは使いません。

## もどり道 — 学び直しの地図

公開デモ：https://jev-education-learning-path.take-she12.workers.dev

`apps/learning-path/` に配置しています。中1数学の問題と途中式を入力すると、Jev が最初の
誤りの候補を選び、確認問題・復習教材・元の問題への再挑戦へ進みます。

- 学習指導要領LODの8項目（CC BY 4.0）と、独自に編集した10項目の前提関係マップ
- 3種類の方程式と9件の答案サンプル、10件の確認問題、20件の練習問題
- 候補の確率が低いときは保留。確認問題が正解なら復習を強制しません
- マップからの教材選択、先生向け宿題セットのMarkdownダウンロード
- API所要時間・推定コスト・raw request/response・実行JSONダウンロード
- Workers Static Assets + Workers API。永続DBは不要

## ローカル起動

Node.js 22以上を使用します。

```sh
npm ci
# ルートの .env に TYPESAFE_API_KEY=... を設定
npm run dev
```

http://localhost:4322 を開いてください。`npm run dev` はルート `.env` のキーだけを
アプリのローカル `.dev.vars` にコピーします。どちらも Git 管理対象外です。
他アプリも `apps/<名前>/` に追加する想定です。

## 検証

```sh
npm test
npm run build
```

テストではグラフの循環・出典の対応・不確実な判定・数値照合・入力検証・利用制限・
秘密情報を含まないログ・外部APIエラーを確認します。外部APIはモックし、CIでは課金しません。
GitHub ActionsでもテストとWorkersバンドルの作成を実行します。
Sonarはこのリポジトリには設定していません。

手動確認：かけ忘れサンプル → 戻り先を探す → 分配法則の確認問題で誤答 →
復習教材 → 宿題セットを保存 → 元の問題に再挑戦して `x = 3`。
同じ問題の移項サンプルでは、異なる戻り先になることを確認できます。

## Cloudflare公開

```sh
npx wrangler login
npm run deploy
npx wrangler secret put TYPESAFE_API_KEY --config apps/learning-path/wrangler.jsonc
```

キーはWorkers Secretに登録し、設定ファイルに書きません。認証済みのCloudflareアカウントに
新規 Worker `jev-education-learning-path` を作成します。GitHub pushだけでは自動デプロイしません。

APIは25秒でタイムアウト。入力は2000文字、本文は16000バイトまでです。
Rate Limiting bindingで、IPごと毎分10回・全体毎分100回（各Cloudflare拠点）の制限を設けます。
これは全世界での厳密な予算上限ではありません。

## データ・ライセンス・プライバシー

- コード：MIT（`LICENSE`）。教材・データ：`apps/learning-path/data/LICENSE.md` を参照。
- オープンデータ：学習指導要領LOD https://jp-cos.github.io/LowerSecondary/2017/
- 元資料：文部科学省。2026-09-20取得。8項目を抽出・JSON化、本文は無変更。
- 学習項目の細分化、教材との対応、依存関係は独自の編集。公式の依存関係ではありません。
- 問題・解説・誤答例は自作、CC BY 4.0で公開。実際の生徒の答案ではありません。
- `public/about.html` にデータ出典、利用条件、推定の限界と入力の取り扱いを表示します。
- サーバーログは問題ID・判定ラベル・使用量・時間などのメタデータだけ。答案・キーは記録しません。
- 詳細な実行内容が必要な場合、画面からJSONをダウンロードできます。
- 入力はTypeSafeへ送信します。業務データ・個人情報の入力や成績評価には使用しません。

コストは jev-1.13.0 の入力100万tokensあたり $0.042、出力無料として算出（2026-09-20確認）。
https://docs.typesafe.ai/models

候補の確信度0.5未満または最大確率0.65未満なら保留する方針はデモ用で、検証済みの教育基準ではありません。
一問の正誤から理解度や恒常的なつまずきを断定しません。正式導入には教科担当者による教材と
前提関係のレビュー、別の答案セットでの評価、データを扱える推論環境の選定が必要です。
