# 店舗主削除依頼の自動連携

`owner-request-handler.gs`は、既存のGoogleフォームへ届いた店舗主の削除依頼を受け、
個人情報をGitHubへ渡さずに店舗番号だけを自動非表示処理へ送る橋渡しです。

## 一度だけ必要な設定

1. GitHubで、このリポジトリだけを対象にしたFine-grained personal access tokenを作る。
   - Repository access：`mokumao/ishikawa-map`のみ
   - Repository permissions：`Contents: Read and write`
   - 有効期限は必要最小限にし、期限前に更新する
2. 「石川マップ ご意見・ご要望」Googleフォームの編集画面からApps Scriptを開く。
3. `owner-request-handler.gs`の内容を貼り付ける。
4. Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に次を保存する。
   - `GITHUB_TOKEN`：1で作ったトークン
   - `ADMIN_EMAIL`：削除依頼の通知先メールアドレス
5. `setupOwnerRequestAutomation()`を一度だけ実行し、Googleフォーム・外部通信・メール送信を許可する。
6. Apps Scriptの「トリガー」に`ownerRequestOnFormSubmit`／フォーム送信時が1件だけ表示されることを確認する。

トークンやメールアドレスは`.gs`ファイルやGitHubへ書かないでください。

## 自動処理される内容

1. 削除理由・メールアドレスを含む回答全文はGoogleフォームに保存する。
2. Apps Scriptは管理者へ回答全文をメール通知する。
3. GitHubへ送るのは店舗番号、削除種別、理由記入の有無、匿名化した受付番号だけ（理由本文とメールアドレスは送らない）。
4. `.github/workflows/process-owner-request.yml`が対象店舗を`hidden`へ変更する。
5. `statusHistory`には一般的な処理理由と匿名受付番号だけを記録する。
6. サイトマップとキャッシュ番号を更新し、GitHub Pagesを再公開する。

「今後掲載しない」の依頼でも、最初は復元可能な`hidden`にします。`refused`への変更は管理者確認後に行います。

## 再掲載

管理者が依頼内容を確認後、GitHub Actionsの「店舗主依頼 自動処理」を手動実行します。

- `store_id`：再掲載する店舗番号
- `action`：`restore`
- `request_ref`：個人情報を含まない12〜64桁の16進数

通常店舗は`published`、店舗番号0の公開テスト店舗は`test`へ戻ります。
