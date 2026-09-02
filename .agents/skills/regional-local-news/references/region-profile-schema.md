# 地域ニュース設定形式

設定は`config/news-regions/<region-id>.json`へ置く。プログラムは環境変数`NEWS_REGION`で対象を選び、未指定時は`ishikawa`を使う。

## 必須項目

- `schemaVersion`: 現在は`1`
- `id`: 英小文字等による地域識別子
- `displayName`, `municipality`, `prefecture`: 表示・判定用の名称
- `searchPhrase`: 共通分野検索に使う、自治体名を含む曖昧でない語句
- `outputDir`: 生成先
- `exactRegionPhrases`: 強い地域根拠になる表記
- `districtTerms`, `contextTerms`: 地区語と、それを沖縄・自治体内と確定する補助語
- `verifiedFacilities`: 公式根拠を確認した施設ID、正式名、別表記
- `falsePositiveRegions`, `falsePositivePeople`: 実際に発生した誤一致
- `discoveryCategories`: 共通8分野の検索語
- `regionalThemes`: 公式根拠を確認した地域固有テーマと深掘り検索語
- `rssSources`: 継続取得する固定情報源
- `officialAdapters`: 地域固有の直接取得処理

`scripts/validate_news_region.py <region-id>`で必須項目、共通8分野、施設ID重複を検査する。

## 追加時の禁止事項

- 未確認施設を検索結果だけで`verifiedFacilities`へ入れない。
- 他地域の固有施設や固有アダプターをコピーしない。
- 地域ごとに閾値を変える前に、実際の誤判定例を残す。
- 投稿フォームや公開URLが未準備の地域を本番出力先へ向けない。
