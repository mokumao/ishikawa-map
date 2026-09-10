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
- `resourceDiscovery`: 公開画面に掲載しない地域資源発見で使う有効状態、対象期間、地域特性カテゴリ
- `regionalThemes`: 公式根拠を確認した地域固有テーマと深掘り検索語
- `rssSources`: 継続取得する固定情報源
- `officialAdapters`: 地域固有の直接取得処理

`resourceDiscovery.characteristicCategories`は、名物・祭り・歴史・文化・自然・観光・産業・食・スポーツなど地域特性を発見する検索入口を持つ。ここに登録された語は地域資源候補を探すためのもので、地域固有テーマとして確定したことを意味しない。

`scripts/validate_news_region.py <region-id>`で必須項目、共通8分野、地域特性カテゴリ、施設ID重複を検査する。

## 地域資源候補の出力

`scripts/discover_region_resources.py --region <region-id>`は、地域特性ルートと共通分野ルートを検索し、`<outputDir>/resource-candidates.json`へ公開画面に掲載しない調査記録を生成する。

このJSONはローカル専用とし、`.gitignore`でGitの保存対象から外す。GitHub Pagesはリポジトリ内のファイルへ直接アクセスできるため、保護された保存先を用意するまではコミットしない。

- `known`: すでに確認済みの施設・地域固有テーマと一致
- `candidate`: 地域根拠はあるが、恒久設定への登録は未確認
- `excluded`: 誤一致または地域根拠不足
- `verified` / `rejected`: 将来、人が確認した状態。再収集時も維持する
- `duplicate`: 同じ地域資源・出来事の別記事として代表候補へ統合

常設紹介ページは地域資源の発見根拠として保存できるが、公開ニュースではない。開催日、募集、休館、規制、変更など時間とともに変わる情報は、日々のニュース収集が別に扱う。

確認済み施設・テーマには、根拠を追跡できるよう`sourceUrl`と`verifiedAt`を付けられる。同名施設・一般語との誤一致が起き得る項目は`requireRegionContext: true`とし、記事本文に自治体・地区の組み合わせがない限り自動掲載しない。

候補の確定結果は地域設定の`resourceReview.decisionFile`から追跡する。`track`だけを確認済み資源へ結び付け、`duplicate`は代表候補を指定し、`exclude`は恒久取得先へ登録しない。

## 追加時の禁止事項

- 未確認施設を検索結果だけで`verifiedFacilities`へ入れない。
- 他地域の固有施設や固有アダプターをコピーしない。
- 地域ごとに閾値を変える前に、実際の誤判定例を残す。
- 投稿フォームや公開URLが未準備の地域を本番出力先へ向けない。
