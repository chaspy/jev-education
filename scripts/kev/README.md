# Kev-0.5B ローカル実行

2026-09-20、このMac（M1 Max / 32GB）にインストールし、MPS推論と公式TypeSafe SDK経由の3種類の質問を確認した。

## いま使う

サーバーは `http://127.0.0.1:8009`。APIの試用画面は `http://127.0.0.1:8009/docs`。
停止後の再起動は、リポジトリのルートで:

```sh
npm run kev:start
```

`/v1/systemone`へ既存の`state/questions`形式でPOSTできる。TypeSafeの本物のキーは不要。Python SDKがキーを要求するのでダミーの`local`を指定する。

```python
from typesafe_sdk import TypeSafeClient, Noul

with TypeSafeClient(
    api_key="local",
    base_url="http://127.0.0.1:8009",
    model="kev-0.5b",
) as client:
    result = client.system_one(
        state="The customer requests a refund.",
        questions={"refund": Noul(instructions="Is a refund requested?")},
    )
    print(result.answers)
```

起動済みサーバーの確認:

```sh
.local/kev-venv/bin/python scripts/kev/smoke.py
```

インストール場所は `.local/kev`、環境は `.local/kev-venv`。両方gitignore済み。モデルはHugging Faceのキャッシュ。重みやAPIキーをgitへ入れない。
新しい環境では `bash scripts/kev/install.sh`（uv、Python 3.12を用意）。このスクリプトは既存インストールを上書きしない。

## 確認内容

- [コード](https://github.com/jaredpalmer/kev): `20fa6268c8ceb226530be2fb5266ab2c36b37724`
- [重み](https://huggingface.co/jaredpalmer/kev-0.5b): `edf1dc6d7f8d983c0adfd251e80a686e5539fc61`
- ベース: Qwen/Qwen2.5-0.5B。metaのbase_revisionを使って読み込む。
- ローカル変更: setuptoolsが`runs/evals/playground`等もパッケージに含めようとして失敗したため、パッケージ検出を`kev*`に限定。推論・重み・学習処理は変更していない。
- `Choice/Noul/Score`の混合リクエストを公式SDKで送信し、応答の読み取りに成功。
- 必要な重みを取得した後、HF_HUB_OFFLINE=1 / TRANSFORMERS_OFFLINE=1 / HF_HUB_DISABLE_TELEMETRY=1で再起動し、SDK試験も成功。OSレベルの送信遮断・全通信監査までは行っていない。
- さらに日本語の教材選択12場面×4条件=48回を実行。31/48回が採点表と一致、全4条件で正しかったのは6/12場面。詳しくは`benchmarks/lesson-fit/`。
- APIサーバーの`model`はリクエスト値を返すだけ。別名を指定しても、読み込まれた0.5Bが別モデルに切り替わるわけではない。検証した互換性は推論エンドポイント。モデル一覧APIなど全SDK機能の完全互換を保証しない。

ログ: `research/jev-clones/kev-sdk-smoke.json` / `kev-offline-smoke.json`。教育実験と英語スモークは入力長が違うので時間を混ぜない。

## 社内セルフホストは可能か

**可能。重みを社内のマシンへ配置して、社内APIとして動かせる構成。公式Jevをセルフホストするのではなく、別モデルKevを動かす。**

ライセンスはコード・アダプター・ベースQwen2.5-0.5BともApache-2.0。ライセンス表示・変更表示・適用されるNOTICE等を守れば商用利用の候補になる。データや社内サービスの導入ルールは別。前回の調査レポートの「実推論未確認」はこの検証で更新した。

現在のサーバーは127.0.0.1にのみ公開。**本番社内サービスとして整備済みではない。** 複数人で使う場合は、社内ネットワーク制限と認証・TLSを持つリバースプロキシの後ろに配置する。上流サーバー自身には認証がなくCORSも広いので、そのまま外向きにbindしない。推論はロックで直列化されるため、同時利用人数に応じた待ち時間・上限・タイムアウトを測る。

必要なものはPython 3.12環境、PyTorchが使えるCPU/GPU、モデルとアダプター、HTTPサーバー。今回はApple Siliconの32GB環境で動いた。最小メモリやLinux/CUDAでの運用は今回実測していない。

外部推論API料金は0。ただし機器・電力・監視・更新費はかかる。社内データで使う前に、重み取得後の送信制限とログ管理を設定し、実際の業務データに対する精度と確率の校正を検証する。今回の日本語教材実験ではJevと同等の精度にはならなかった。
