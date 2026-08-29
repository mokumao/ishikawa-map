# ニュース候補データ形式

候補保存機能、確認画面、自動掲載処理を実装・変更するときに読む。

## 候補データ

```json
{
  "id": "20260829-source-hash",
  "title": "原典で確認したタイトル",
  "summary": "原典にある事実だけの短い要約",
  "url": "https://example.jp/original",
  "sourceId": "uruma-city",
  "sourceName": "うるま市公式サイト",
  "sourceType": "official",
  "publishedAt": "2026-08-29T09:00:00+09:00",
  "discoveredAt": "2026-08-29T12:00:00+09:00",
  "checkedAt": "2026-08-29T12:05:00+09:00",
  "eventStartsAt": null,
  "eventEndsAt": null,
  "expiresAt": "2026-09-05T23:59:59+09:00",
  "category": "event",
  "localScore": 75,
  "localEvidence": ["うるま市石川", "石川多目的ドーム"],
  "confidence": 90,
  "status": "review",
  "reviewReasons": [],
  "fingerprint": "normalized-event-key",
  "relatedUrls": []
}
```

## 必須項目

- `id`：再収集しても同一候補を識別できる安定ID
- `title`：原典で確認できる表題。管理人投稿では入力タイトル
- `url`：原典URL。管理人投稿など外部URLがない場合だけ空を許容
- `sourceId`、`sourceName`、`sourceType`
- `publishedAt`または、日時不明であることを示す`reviewReasons`
- `discoveredAt`、`checkedAt`
- `localScore`、`localEvidence`
- `confidence`、`status`
- `fingerprint`

## 状態

- `collected`：取得直後で未判定
- `review`：管理人確認待ち
- `approved`：掲載承認済み
- `published`：公開データへ反映済み
- `rejected`：対象外、誤情報、重複など
- `expired`：期限切れ

状態変更時は理由と日時を残せるようにする。`rejected`を単に削除すると同じ候補を毎日再取得するため、IDまたはfingerprintを一定期間保持する。

## カテゴリ初期値

- `news`：一般ニュース
- `event`：催し・募集
- `public`：行政・公共施設
- `traffic`：交通・工事
- `safety`：防災・安全
- `school`：学校・教育
- `community`：自治会・地域活動
- `business`：開店・閉店・移転など
- `submission`：管理人・読者投稿

分類不能なら推測せず`news`または`review`とする。カテゴリ追加は表示側への影響を確認してから行う。

## 公開データへの変換

現在の`news/today.json`形式へ出力するときは、承認済み・自動掲載可能・期限内の候補だけを変換する。

- `title`、`summary`、`link`、`source`、`date_label`、`pub_date`を生成する。
- 未来のイベントは`eventStartsAt`を並び順とラベルに使う。
- 表示用の日付文字列を保存値の代わりにせず、ISO日時から毎回生成する。
- 同じfingerprintの候補は代表1件だけを掲載する。
- `review`、`rejected`、`expired`は公開HTMLへ出さない。

## 候補ファイル案

- `news/candidates.json`：収集・判定済み候補
- `news/review.json`：確認待ちだけを抽出した一覧（必要になった場合）
- `news/today.json`：公開用の生成結果

候補ファイルへ読者投稿の個人情報や非公開列を保存・公開しない。GitHub Pagesに配置されるファイルは誰でも閲覧できる前提で扱う。
