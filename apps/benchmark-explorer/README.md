# 教材検索の実験を追う

授業文脈付き教材検索ベンチマークの、保存ログを再生する説明用Webアプリ。
元アプリとは別ディレクトリ・別Cloudflare Worker。推論API・認証キー・DBは不要。

- 代表的な改善・検索漏れ・該当なし・ラベル問題・API不要の例をワンクリックで選択。
- 全34ケースを選べる。教師の実際の入力と、検索→条件処理→Jev→閾値の各段階を表示。
- 教材本文・模範解答・条件違反・採点用ラベル・元のAPI request/responseを確認。
- 閾値スライダーで保存済みのNoul値を再集計。実験の0.65と変更後を明示。新しい推論や課金は発生しない。
- 全指標の母数、元データの限界、仮ラベルの粗さ、時間と費用を説明。
- `standalone.html`はCSS・JavaScript・データ内蔵。保存後、オフラインでも開ける。

```sh
npm run explorer:dev      # http://localhost:4323
npm run explorer:build    # 固定した実験ログからdata.jsとstandalone.htmlを再生成
npm run explorer:deploy   # Cloudflareへ公開
```

データは `2026-09-20T05-59-46.615Z-material-search` の実行記録から生成。
ページで表示するタグ・採点用ラベルは説明のために追加した情報であり、当時のJev入力とは区別する。
コードはMIT。教材・授業ケースはCC BY 4.0。指導要領本文は学習指導要領LOD／元資料文部科学省、CC BY 4.0。

公開URL：https://jev-education-benchmark-explorer.take-she12.workers.dev
