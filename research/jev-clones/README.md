# Jevクローン6件の調査・ローカル検証

調査日: 2026-09-20。対象は[Latent Spaceの記事](https://www.latent.space/p/ainews-here-are-6-clones-of-jev-in)で挙げられた6件。記事以後も実装が更新されているため、今回読んだコードとモデルのリビジョンをJSONに保存した。

**仕事のデータを外部のJev APIへ送らずに判定する選択肢はある。ただし6件とも同一API・同一性能という意味のクローンではない。**

## 比較

「業務利用」は公開されているライセンス上の利用可否。自社の導入承認や教材・個人情報の利用権、教育用途の精度を保証するものではない。

| 対象 | ローカル実行 | コード・モデルのライセンス | 業務利用の判断 | Jevのスキーマとの関係 | 今回の確認範囲 |
|---|---|---|---|---|---|
| Laya | CPU / CUDA / Apple MPS。日本語には多言語版を選択 | コードと公開重みApache-2.0。英語版のModernBERTもApache、多言語版のmmBERTはMIT | 表示・再配布条件を守れば商用利用可能 | Python関数でstateとquestionsを受け、Choice/Noul/Scoreを返す。HTTPサーバーを標準添付する形ではない。追加フィールドとconfidenceの定義に違い | **多言語版をM1 Maxで実推論、通信接続禁止中も成功** |
| DiffusionGemmaJev | vLLMの変更版＋ローカル互換サーバー。著者はDGX Sparkで検証 | vLLMコードApache-2.0、GoogleモデルもApache-2.0。記事のNVIDIA量子化版カードにはGemma利用規約への併記あり | Google版はApache条件下で候補。NVIDIA版の条件併記は導入時に確認が必要 | `/v1/systemone`、3種類対応。ただし最大26択、confidenceなどは独自 | PRコードと入力検証関数を実行。**GPU推論未実施、PRは未マージ** |
| Bespoke Nimble 9B | Mac MLX / Linux CUDA。ベース9B＋LoRAが必要 | HFモデル・ベースはApache-2.0。**GitHubコードはLICENSEも明示的な使用許諾も確認できず** | モデルとGitHubコードを一括して「商用OK」と扱わない。コードの許諾確認が残る | `context/schema`、`enum/boolean`。最大26択。Scoreは数値enumに変換。入力・出力アダプターが必要 | 入力検証関数を実行。重みを使った推論は未実施 |
| SemIf / OpenJev | 公開4B/35Bのローカル推論コードあり。Webデモもローカル実行を掲げるが別方式 | OpenJevのHFリポジトリはMIT表示、Qwen3.5ベースはApache-2.0。Webサイト全体の許諾は別途未確認 | 公開モデルは商用利用の候補。使うモデル・コード単位で確認する | 公開NLIモデルは `(premise, hypothesis)` → contradiction/entailment/neutral。Jevの3種類とは別。再ランキング用関数あり | モデルカード・推論コードを確認。重みを使った推論は未実施 |
| Jevlike | 小型PyTorchモデルをCPUで学習・推論可能 | コードMIT。任意の外部encoderを追加する場合はその条件も必要 | MITの範囲は商用利用可能 | `context/options` → 選択肢ごとの確率。JevのHTTP APIや3種類の質問スキーマはない | **CPUで合成データ32例・30ステップの学習／推論成功**。汎用言語モデルとしての検証ではない |
| Kev-0.5B | Apple MPS / CUDA / CPU向け。0.5Bの公開アダプター＋Qwen2.5が必要 | コード・アダプター・Qwen2.5-0.5BはApache-2.0 | ライセンス上は商用利用候補。モデルカードは研究プロトタイプ・英語モデルと明示 | `/v1/systemone`で3種類対応、最大255択。公式SDK対応を掲げる。Score confidenceは近似式 | スキーマ検証成功。**ローカルインストールがパッケージ設定エラーで停止、実推論未確認** |

一次情報: [Laya](https://github.com/NandhaKishorM/laya)、[DiffusionGemma PR](https://github.com/vllm-project/vllm/pull/57250)、[Nimble](https://github.com/bespokelabsai/nimble)、[Nimbleモデル](https://huggingface.co/bespokelabs/Bespoke-Nimble-9B)、[OpenJevモデル](https://huggingface.co/AlexWortega/openjev)、[SemIfサイト](https://openjev.com/)、[Jevlike](https://github.com/vinnylarouge/jevlike)、[Kevモデル](https://huggingface.co/jaredpalmer/kev-0.5b)。

## このMacで実際に試したこと

環境: Apple M1 Max、32 GiBメモリ、macOS arm64、Python 3.12.0。Python環境と第三者コードは `/tmp/jev-clones-review/`、重みはHugging Faceキャッシュ。仕事のデータやJev APIキーは使用していない。外部推論APIの課金は発生しない。モデルのダウンロードは外部通信を使う。

### Laya: 日本語の教材判断を3種類まとめて実行

入力は「分母をなくす操作を練習したい」「x/2 + 3 = 7 の両辺に2を掛けると？」。

- Choice「教科は？」→ 数学、確率0.9999。
- Noul「目的の操作を直接練習させるか？」→ 0.3097。
- Score「式変形の段階数」→ 0〜2の範囲で1.3935。
- 初回推論2,507ms。その後3回は67.3 / 32.7 / 32.8ms、中央値32.8ms。
- モデル読み込みはダウンロード込み27.4秒。実行デバイスはMPS。
- 読み込み後の推論中はPythonの`socket.connect`を禁止して成功。OS全体のネットワーク遮断試験ではない。
- 実際の応答は、インストールした公式TypeSafe SDKの応答モデルでも検証を通った。ただしHTTPの接続先差し替え試験ではない。

**動くことと、教育用途で正しく判断できることは別。** この1件では教科を分類できたが、目的に合う教材のNoul値は低かった。3回の小さな速度測定を、以前のJev APIの異なる入力・ネットワーク込みの測定と直結して「何倍速い」とはしない。

生ログ: [laya-smoke.json](laya-smoke.json)。

### Jevlike: 小型モデルの機構を確認

合成したバッジ選択32例を30ステップ学習。学習した同じバッチのlossは1.4902→0.0165、確率の和は1。この試験は学習と推論が動くことを確認するもの。未知の日本語教材を理解する汎用モデルが手に入ったという意味ではない。

生ログ: [jevlike-smoke.json](jevlike-smoke.json)。最初のログ保存でdataclassのJSON変換に失敗したため、保存処理を修正して再実行した。

### Kev: セットアップで判明した問題

確認commit `20fa6268c8ceb226530be2fb5266ab2c36b37724` を `uv pip install '/tmp/jev-clones-review/kev[serve]'` でインストールすると、setuptoolsが `kev`, `runs`, `evals`, `playground`, `experiments` を複数パッケージとして検出して失敗した。

モデルやMPSの失敗ではない。公開コードのパッケージ設定で止まった。READMEの`uv sync`手順自体を実行した結果とは区別する。一時コピーの設定修正についてユーザーに確認中で、未承認の修正や迂回実行は行っていない。入力モデルの検証は当該ファイルを独立に読み込み、推論と切り離して確認した。

## 「同じスキーマ」のどこが違うか

比較元: [TypeSafe HTTP API](https://docs.typesafe.ai/api)、[confidence仕様](https://docs.typesafe.ai/confidence)。

Jevの入力は`model/state/questions`、質問は`type/instructions/criteria`。出力は`answers`内の`noul`、`choice`、`score`等。

[実行結果](schema-checks.json)では、3種類を含む同じ入力をKevとDiffusionGemmaの入力検証関数が受理した。Nimbleはそのままでは拒否し、`instructions→description`、`choice→enum`、`noul→boolean`等に変換すると受理した。

以前の55誤概念のChoiceを作ると、Kevは入力検証を通り、DiffusionGemmaとNimbleは26択の上限で拒否した。これは実際の判定精度ではなく、入力できるかの確認。

さらにconfidenceの意味が異なる。Choiceで確率が `[0.8, 0.1, 0.1]` の場合、公式Jevの式では0.70、Layaのentropy式では約0.42、DiffusionGemmaの最大確率方式では0.80になる。KevのChoice式は公式に沿うが、Score式はコード内で近似と明記される。**今までのしきい値を、そのまま別モデルへ持ち込まない。**

Layaの多言語版は標準設定で1024 tokens、質問側の予算256。文脈は切り詰められる。Nimbleのリファレンスは2048 tokens超を拒否。長い授業文脈や大量の選択肢について、形式だけでなく実際に全文を読めるかも確認する必要がある。

OpenJevで候補ごとの「含意確率」を得ても、それは候補間で和が1になるJev Choice分布と同じではない。Noulへの単純置換もneutralの扱いを定義する必要がある。

## ライセンスと仕事で使う条件

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)と[MIT](https://github.com/vinnylarouge/jevlike/blob/main/LICENSE)は商用利用を許す。再配布時のライセンス・著作権表示、Apacheの変更表示や適用されるNOTICE等を守る。会社のソースを公開することが一律に必要なライセンスではない。

コード、追加学習重み、ベースモデルを分けて確認した。Laya多言語版のmmBERTはMIT、Kev-0.5BのQwen2.5-0.5BはApache-2.0。別サイズ・別ベースへ変更したら再確認する。学習データを再配布・再学習する際の条件も重みの条件とは別。

NimbleはGitHubツリー・README・ライセンスAPIを確認し、コードの使用許諾を特定できなかった。HF側にApache表示があってもGitHubコード全体へ自動適用はできない。[GitHub公式の説明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)でも、ライセンスなしを自由利用とは扱わない。

[Google DiffusionGemma](https://huggingface.co/google/diffusiongemma-26B-A4B-it)はApache-2.0。一方、記事の起動例が使う[NVIDIA量子化版](https://huggingface.co/nvidia/diffusiongemma-26B-A4B-it-NVFP4)にはApacheとGemma利用規約・禁止用途ポリシーが併記されている。旧Gemmaの制約を全モデルへ決めつけることも、カード内の併記を無視することもしない。

ローカル構成なら入力をTypeSafeへ送る必要はない。ただし、公開デモのページへ社内データを貼ることと、社内管理下で固定したコード・重みを実行することは運用条件が違う。今回の検証は公開例だけを使用した。

## 今回の教育アプリで選ぶなら

- **既存APIの差し替え検証はKevが第一候補**。入力形式と55択の上限が合う。ただしセットアップ修正の確認が残り、0.5Bは英語中心の研究モデル。日本語の精度はまだ確認していない。
- **このMacで動いた候補はLaya多言語版**。小さなPythonラッパーで組み込める。日本語教材の正解付き評価を先に行い、短い入力でも適合判断が安定するか確認する。
- Nimbleはコード許諾の確認後。SemIf/OpenJevは再ランキング用に別の評価設計が必要。DiffusionGemmaはGPUサーバー環境と未マージPRの保守が必要。Jevlikeは今回、独自学習の教材として扱う。

今回わかったのは「自社管理環境で動かせる選択肢と移行上の違い」。Jevの教育ベンチマークを上回るモデルが見つかった、という結果ではない。

## 記録と再現

- [source-revisions.json](source-revisions.json): Git commit、PRの状態。
- [model-revisions.json](model-revisions.json): モデルのrevision・公開ライセンス表示。
- [smoke-local.py](smoke-local.py): Laya実推論／Jevlike学習のスモークテスト。
- [check-schema.py](check-schema.py): 入力検証関数だけを実行する試験。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): Jevlikeスモークテスト由来部分のMIT表示。

```sh
# 上記revisionの第三者コードを /tmp/jev-clones-review に用意した環境で実行
/tmp/jev-clones-review/venv/bin/python research/jev-clones/smoke-local.py laya --output research/jev-clones/laya-smoke.json
/tmp/jev-clones-review/venv/bin/python research/jev-clones/smoke-local.py jevlike --output research/jev-clones/jevlike-smoke.json
/tmp/jev-clones-review/venv/bin/python research/jev-clones/check-schema.py /tmp/jev-clones-review research/jev-clones/schema-checks.json
```

初回測定はその時点のmainを取得した。再現スクリプトは、その実体と同じ記録済みrevisionを`snapshot_download`して読み込むよう固定した。
