# LunaによるJev互換Choiceの比較

`gpt-5.6-luna` / reasoning=medium / Responses API / strict JSON Schema。
環境変数 `OPENAI_API_KEY` を使用する。キーはモデル入力・ログに保存しない。

[モデルと価格](https://developers.openai.com/api/docs/models/gpt-5.6-luna)・
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)を2026-09-20に確認。

Jevに渡したstate・質問文・criteria・候補順をそのまま使用し、型と出力方法の説明だけを
共通developerメッセージとして追加する。出力の `answers.<ID>` は
`type`, `choice`, `probabilities`, `confidence` の同じ形。
Jevの内部プロンプト・学習・確率推定方法を再現したわけではない。
Lunaの確率とconfidenceは文章生成による自己申告値で、Jevと同じ校正を仮定しない。
同じ保留閾値での成績は互換動作の参考値として扱う。
スキーマでは保証できない確率の合計・choiceと最大確率の整合性はコードで検証し、修復はしない。
拒否・未完了・APIエラー時はログを保存して停止。代替モデル・再試行なし。

## 評価条件

- MaE: 元と同じtest 151件。dev 30件も分割を変更せず、調整には使わない。
- 模擬生徒: 元と同じ90シナリオ、全追加回答を事前固定。
- 固定証拠比較: Jevが実際に受け取った43種類のリクエストをLunaに渡す。
- 自律選択比較: Lunaが選んだ確認問題の固定済み答案を追加。同じ問題バンク・判定基準を使う。
- 正解ラベル・未選択問題の答案・Jevの判定はLunaの入力に含めない。
- 5設定＋証拠不足のTop-1と、証拠不足を除いた設定順位の両方を報告。
- 同一リクエストは実行内で1回だけ測定。各段階の独立なリクエストを最大4並列で実行。
- 過去のJev測定結果との比較。Jevは直列実行だったため同時実行数・日時・ネットワーク条件は一致しない。

## 時間とコスト

各HTTPリクエスト開始からJSON受信までを実測。API利用量から料金を推定し、raw結果に保存する。
Lunaは入力$0.20/M、キャッシュ済み入力$0.02/M、出力（推論tokenを含む）$1.20/M。
APIがキャッシュ書き込みを別掲しない場合、その追加料金は加算しない推定値。
モデル識別子はAPIの返却値も記録する。日付付きsnapshotではないので永続的な同一性は保証しない。

実API呼び出し数・合計料金・平均料金・時間の中央値/p95を比較する。
模擬実験では2段階のAPI時間と費用を合算した「1シナリオあたり」も併記。
これは同一リクエストの測定値を各シナリオに当てはめた値で、キャッシュヒットを0msとして扱わない。
追加問題を人が解く時間は含まない。結果共有分を実際に再課金した合計とは区別する。

```sh
npm test
# OPENAI_API_KEY がシェル環境またはルート.envに必要。実API課金あり。
npm run benchmark:luna:simulation
npm run benchmark:luna:mae
```

モデル用リクエスト全候補とソースのハッシュを実行前に記録。
`calls.jsonl`にはJev形式の元入力、OpenAIへの実リクエスト、APIレスポンスを保存。
`predictions.jsonl`と`summary.json`でケース別・全体を比較できる。

## 初回測定結果

[精度・confidence・応答時間・コストの比較](RESULTS.md)。
模擬実験は完了。MaEは確率合計の不整合により途中停止し、生の応答と停止理由を保存しました。
