# 管理者投稿システム

## 目的

Googleフォームを経由せず、管理者ページから地域別のお知らせを投稿・編集・非公開化し、
公開サイトへ即時反映する。最初は`ishikawa`だけを有効にするが、データとAPIは複数地域を扱える。

## 構成

- 管理画面: 管理APIと同じCloudflare Workerから配信し、全体をCloudflare Accessで保護する
- 管理API: Cloudflare Accessで保護したCloudflare Worker
- 保存先: Cloudflare D1
- 公開API: 別の読み取り専用Cloudflare Worker。`GET /api/v1/notices?region=ishikawa`だけを提供する
- 管理API: Cloudflare Accessが渡す認証済み利用者情報と許可メールアドレスを確認する
- 公開サイト: GitHub Pagesのまま維持し、公開APIだけを参照する

## 状態

- `draft`: 下書き。公開しない。
- `published`: 掲載期間内だけ公開する。
- `hidden`: 非公開。データと履歴は残す。

削除操作は物理削除ではなく`hidden`への変更として扱う。

## 展開順序

1. D1を作成し、マイグレーションを適用する。
2. 管理WorkerのAccess設定、許可管理者、CORS許可元を設定する。
3. APIをローカルとプレビュー環境で検証する。
4. 管理画面をAPIへ接続し、スマートフォンで投稿・編集・非公開を確認する。
5. 公開画面を公開APIへ切り替える。
6. 既存の1件が移行済みであることを確認する。
7. Googleフォームの取得処理と投稿リンクを削除する。

管理Workerと公開Workerは同じD1を参照する。公開Workerには更新用経路を実装せず、
管理Worker全体はCloudflare Accessで保護する。これにより一般閲覧と管理操作の権限を分離する。

公開画面を切り替える前に手順1〜4を完了し、投稿手段が失われる時間を作らない。
