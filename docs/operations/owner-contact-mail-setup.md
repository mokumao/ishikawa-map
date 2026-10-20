# 店舗主の「その他」受付：通知設定と切替手順

## 現状と切替条件

受付・通知キュー・再送対応・画面分岐は実装済み。本番の受付先はまだGoogleフォーム。
通知用のGoogleプロジェクトとコードは作成・保存済み。通知先・送信権限・ウェブアプリのデプロイ・Cloudflareの秘密設定が未完了のため、本番切替を行わない。
新規通知のスクリプトは既存の削除依頼処理とは別のプロジェクトに置く。

## Google側：管理者本人による初回設定

1. Apps Scriptで新しい独立プロジェクトを作成する（既存の削除依頼スクリプトに上書きしない）。
2. `integrations/google-apps-script/contact-notification.gs` を貼り付ける。
3. プロジェクトの設定 → スクリプトプロパティに `ADMIN_EMAIL`（通知先）を登録する。
4. エディタから `setupContactNotifications` を実行し、本人のGoogleアカウントでメール送信を許可する。
5. 自動生成された `CONTACT_MAIL_TOKEN` をスクリプトプロパティで確認する。秘密値はチャットやGitHubへ貼らない。
6. 新しいデプロイ → ウェブアプリ。実行するユーザーは「自分」、アクセスは「全員」（匿名のWorkerが呼び出すため）。本文に含む秘密トークンが一致する呼出しだけが処理され、送信先は固定の `ADMIN_EMAIL` に限られる。
7. 発行された `/exec` URLを控える。組織の設定で匿名アクセスが許可されない場合は切替を進めない。

参考：[Google公式のウェブアプリ手順](https://developers.google.com/apps-script/guides/web)、[MailApp](https://developers.google.com/apps-script/reference/mail/mail-app)。

## Cloudflare側：秘密設定とテスト接続

公開Worker `ishikawa-map-public-notices` のSecretsへ次を設定する。

- `CONTACT_MAIL_URL`：Google側の `/exec` URL
- `CONTACT_MAIL_TOKEN`：Google側と一致する32文字以上の秘密値
- `CONTACTS_LIVE`：最初は `test`

CLIの場合はWranglerの `secret put` を使い、対話入力する。値をコマンド引数や追跡ファイルに書かない。
既存構成では `.codex-admin-notice-system-20260914/admin-notice-api/wrangler.public.jsonc` を使う。
通知再試行のCronは `*/10 * * * *`（UTC）を設定する。

DBには `0005_contact_intake.sql` を2026-10-21に適用済み。`ALTER TABLE`を含むため同じファイルを二度適用しない。

## 本番接続の前の確認

1. `GET /api/v1/contact-config` が `enabled: true, testOnly: true` を返すことを確認する。
2. 店舗番号0の「その他」から「受付テスト」と明記した連絡を1件送信する。実在する店舗の依頼として送らない。
3. 管理者画面で受信し、対応状況とメモを保存できることを確認する。
4. 新着メールが管理者の受信箱へ届くことを確認する。本文・メールアドレスが通知に載らないことを確認する。
5. 更新API・一覧APIが未認証では取得できないことを確認する。
6. 通知不能時の再試行・送信失敗時の入力保持・同一IDの重複排除はローカルテストでも確認する。
7. 実在店舗の「その他」は、テストモード中はGoogleフォームへ送る。修正・削除依頼は両モードともGoogleフォームへ送る。

確認後に `CONTACTS_LIVE=true` にする。運用資料に本番受付開始日と半年後の保存期間見直し日を記録する。
Googleフォームは残す。停止時は `CONTACTS_LIVE=false` に戻すと、新しく開いたページは現行フォームへ戻る。
既に開いているページには再読み込みが必要。新API送信中の失敗時には自動でフォームへ二重送信しない。

## 未確認事項

- Googleへのコード保存は完了。送信元アカウント・通知先の確認、権限付与・URL発行は未実施。
- 実メール受信と本番DBへのテスト受付は未確認。
- 本番切替と受付運用開始日は未実施・未確定。
