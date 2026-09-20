# 授業に合う問題を選ぶ実験

ユーザーが先に3候補＋該当なしから選び、その後にJev・Kevの実際の回答と事前の採点理由を確認する説明用Webアプリ。新しい実験は`benchmarks/lesson-fit`。旧検索実験をアーカイブとして同梱する。

- ローカル: `npm run lesson-fit:dev` → http://localhost:4324
- 公開: `npm run lesson-fit:deploy`
- URL: https://jev-education-benchmark-explorer.take-she12.workers.dev
- API呼び出しなし。公開例と保存済み結果のみ。会社のデータやAPIキーなし。
- standalone.htmlはオフラインでも体験・結果・APIログを閲覧できる。旧ページやGitHubへのリンクは別ファイル／ネット接続が必要。

検証: 390px / 1440pxで選択・回答表示・言い換え切替・該当なしケース・表からの移動・オフラインHTML・旧ページをPlaywrightで確認。実験結果はNodeのテストで元ログから再集計して照合。
