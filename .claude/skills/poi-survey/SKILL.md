---
name: poi-survey
description: 石川マップの店舗・施設データ（POI）を複数情報源のクロス照合で調査・追加する手順。「POI調査」「コンビニ／ガソリン等のカテゴリ棚卸し」「店舗を調査して追加」などの依頼で使う。カテゴリ名（例：ガソリンスタンド）を指定して実行する。
---

# POI調査スキル（店舗・施設データの収集・検証・追加）

うるま市石川マップに掲載する店舗・施設情報を、**人の目に頼らず・複数情報源のクロス照合**で
できるだけ正確に収集するための標準手順。2026-07-21のコンビニ調査（3店→14店）で確立した。

## 設計思想

1. **単一の情報源を信じない** — 発見も検証も必ず複数ルートで行う
2. **AIの記憶から店舗を列挙しない** — 網羅性がなく、実在しない店舗を生成する危険もある
3. **確信度で扱いを分ける** — 複数ソース一致=掲載 / 1ソースのみ=要検討 / 不一致=保留
4. **出典と確認日を必ず記録** — restaurants-data.js のコメントと sourceUrl に残す
5. **人の目は事後訂正に回す** — 読者・管理人からの間違い報告が最後の安全網

## 禁止事項（重要）

- **Googleマップ／Google Places APIの自動利用は禁止**（規約上、スクレイピング禁止・
  Google以外の地図への表示禁止）。人間が見て気づいたことのヒントとしてのみ扱い、
  必ず他ソースで裏取りする
- **NTTタウンページ（iタウンページ）の自動収集は禁止**（規約）。個別確認のみ可
- NAVITIME・マピオン等も大量スクレイピングはしない。少量の個別照合に留める

## 手順

### Step 0: 準備
- `git pull origin main` を実行
- **クレジット残量に注意**。検証Workflowはエージェントを多数使うため、
  1セッション1カテゴリまでを目安にする（過去に月次上限へ到達した実績あり）

### Step 1: 発見（必ず複線で）

**ルートA: OpenStreetMap（Overpass API）**

下記スクリプトを実行（scratchpadに保存して `python` で実行）。ポイント：
- サーバーは混雑しやすい（特に夜）。複数サーバー×リトライで叩く
- **タグ検索と名前検索の両方**を行う（タグ不備の登録を拾うため）
- `ishikawa-boundary.js` の境界ポリゴンで点内判定し石川地区内に限定

```python
# -*- coding: utf-8 -*-
import json, re, time, urllib.request, urllib.parse

BOUNDARY_JS = r'C:\Users\user\OneDrive\デスクトップ\Claude code関連\ishikawa-boundary.js'
SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]
# ↓カテゴリに応じて書き換える（下の「カテゴリ別クエリ」参照）
QUERY = '''
[out:json][timeout:60];
(
  node["shop"="convenience"](26.39,127.78,26.47,127.89);
  way["shop"="convenience"](26.39,127.78,26.47,127.89);
  node["name"~"セブン|ローソン|ファミリーマート|ファミマ",i](26.39,127.78,26.47,127.89);
  way["name"~"セブン|ローソン|ファミリーマート|ファミマ",i](26.39,127.78,26.47,127.89);
);
out center;
'''

def load_boundary():
    text = open(BOUNDARY_JS, encoding='utf-8').read()
    return [(float(a), float(b)) for a, b in
            re.findall(r'\[\s*(26\.\d+)\s*,\s*(127\.\d+)\s*\]', text)]

def point_in_polygon(lat, lon, poly):
    n, inside, j = len(poly), False, len(poly) - 1
    for i in range(n):
        yi, xi = poly[i]; yj, xj = poly[j]
        if ((xi > lon) != (xj > lon)) and \
           (lat < (yj - yi) * (lon - xi) / (xj - xi + 1e-12) + yi):
            inside = not inside
        j = i
    return inside

def fetch():
    data = urllib.parse.urlencode({'data': QUERY}).encode('utf-8')
    last = None
    for url in SERVERS:
        for _ in range(2):
            try:
                req = urllib.request.Request(url, data=data,
                    headers={'User-Agent': 'ishikawa-map-poi-survey/1.0'})
                with urllib.request.urlopen(req, timeout=90) as r:
                    return json.loads(r.read().decode('utf-8'))
            except Exception as e:
                last = f'{url}: {e}'; print('retry...', last); time.sleep(5)
    raise RuntimeError(last)

poly = load_boundary()
out = []
for e in fetch().get('elements', []):
    t = e.get('tags', {})
    lat = e.get('lat') or e.get('center', {}).get('lat')
    lon = e.get('lon') or e.get('center', {}).get('lon')
    if lat is None: continue
    out.append({'name': t.get('name',''), 'brand': t.get('brand', t.get('operator','')),
                'branch': t.get('branch',''), 'shop': t.get('shop',''),
                'lat': round(lat,6), 'lon': round(lon,6),
                'osm_id': f"{e.get('type')}/{e.get('id')}",
                'inside': point_in_polygon(lat, lon, poly)})
json.dump(out, open(r'C:\Users\user\AppData\Local\Temp\claude\poi_result.json','w',
          encoding='utf-8'), ensure_ascii=False, indent=2)
print('total:', len(out), 'inside:', sum(1 for p in out if p['inside']))
```

**カテゴリ別クエリ（QUERYの中身を差し替え）**

| カテゴリ | タグ条件 | 名前検索の例 |
|---|---|---|
| コンビニ | `"shop"="convenience"` | セブン\|ローソン\|ファミリーマート\|ファミマ |
| ガソリンスタンド | `"amenity"="fuel"` | ENEOS\|エネオス\|アポロ\|出光\|SS |
| 宿泊 | `"tourism"~"hotel\|guest_house\|hostel\|motel"` | ホテル\|民宿\|リゾート |
| 金融 | `"amenity"~"bank\|post_office"` | 銀行\|郵便局\|JA\|信金 |
| 医療 | `"amenity"~"hospital\|clinic\|dentist\|pharmacy"` | 病院\|医院\|クリニック\|薬局 |
| 教育 | `"amenity"~"school\|kindergarten"` | 小学校\|中学校\|高校\|幼稚園\|こども園 |
| 飲食店 | `"amenity"~"restaurant\|cafe\|fast_food\|bar\|izakaya"` | 食堂\|カフェ\|居酒屋 |
| 美容・理容 | `"shop"~"hairdresser\|beauty"` | 美容室\|理容\|理髪\|床屋\|ヘアー\|HAIR\|hair\|サロン\|salon |

**ルートB: 公式・地図サービスの一覧（ウェブ検索）**

OSMは登録漏れが多い（コンビニ調査では14店中4店が漏れていた）。必ず併用する：
- チェーン・組織の公式店舗検索で「うるま市」の一覧を確認
  （ローソン: e-map.ne.jp/p/lawson、ファミマ: store.family.co.jp、
  セブン: e-map.ne.jp/p/711map、ENEOS等も同様）
- NAVITIMEの市区町村×カテゴリ一覧ページ
  （例: navitime.co.jp/category/0201001006/47213/ = うるま市のコンビニ）
- ルートAとルートBの**件数を突合**し、差があれば埋まるまで調べる

### Step 2: 既存データとの突合

`restaurants-data.js` の該当ジャンルの既存掲載と照合し、新規候補だけを抽出する。
（座標が近くても住所・チェーンが違えば別店舗。電話番号が最も確実な識別子）

### Step 3: 検証（Workflowで並列実行）

各候補に対し「検証員」と「懐疑係」の2段構えで照合する。使用したプロンプト原文：

**検証員プロンプト**
```
あなたは沖縄県うるま市石川地区の地図サイトのデータ検証員です。
次の（カテゴリ）候補が実在するかをウェブ検索で検証してください。

候補: （店舗名）／ブランド／座標／OSM登録ID／住所・電話の手がかり

調査方法:
- WebSearch/WebFetchツールを使う
- 公式の店舗検索や「(名称) うるま市石川」の検索で正式名・住所を特定
- 緯度経度は下の「座標の取得方法」に従う（Googleマップのデータは使わない）
- 住所が石川地区（うるま市石川○○・伊波・嘉手苅・山城・東恩納・
  赤崎・白浜・曙・東山）であることを確認する

判定基準:
- confirmed: 公式または複数の信頼できる情報源で現在の存在を確認
- likely: 1つの信頼できる情報源で確認
- uncertain: 情報が少なく確信が持てない
- not_found: 検索しても存在の痕跡がない
```

**懐疑係プロンプト**
```
あなたは懐疑的な検証員です。次の店舗情報に「掲載すべきでない理由」が
ないか、ウェブ検索で反証を探してください。

確認する反証:
1. 閉店・閉店予定の情報はないか（「(店名) 閉店」等で検索）
2. 住所・座標が石川地区外（恩納村・金武町・具志川など）ではないか
3. 既存掲載店との重複ではないか（住所・電話番号の違いで判断）

反証が見つからなければ refuted=false。
```

**採用基準**: confirmed かつ refuted=false → 掲載。
likely → 内容次第で掲載（noteは控えめに）。uncertain/not_found → 保留。
座標は複数ソースが30m以内で一致することを確認する。

**座標の取得方法（この順で試す）**

1. **国土地理院の住所検索API（第一候補）** — 国の公的機関のサービスで、
   規約上の懸念がなく、curlで即座に使える。住所さえ分かれば座標が得られる

   ```bash
   curl -s "https://msearch.gsi.go.jp/address-search/AddressSearch?q=$(python3 -c "import urllib.parse;print(urllib.parse.quote('沖縄県うるま市石川曙2-1-55'))")"
   ```

   返り値の `coordinates` は **[経度, 緯度] の順**（lng, lat）なので入れ替えに注意。
   レスポンスの `title` は文字化けして見えることがあるが、座標は正しいので気にしない。

2. **OpenStreetMap（Step 1のOverpass抽出結果）** — 施設そのものの位置に
   置かれていることが多く、ピンの見た目としては最も正確

3. マピオン・ポストマップ・ホームメイト等のスポットページ
   （NAVITIMEは403で拒否されることがある。大量取得はしない）

**1と2が30m以内で一致すれば採用してよい。** 採用するのは原則OSM側の座標
（国土地理院は街区の代表点を返すため、建物から数十m離れることがある）。
どちらか一方しか得られない場合は、その旨をデータのコメントに残す。

### Step 3.5: 営業時間・定休日の調査

実在確認（Step3）とは別に、営業時間・定休日は次の優先順位で調べる。

**優先順位**
1. 店舗公式サイト・公式SNS（最新の投稿を優先。更新日を確認する）
2. 食べログ・エキテン・NAVITIME等の第三者サイト
3. 現地の看板・掲示（自分の目で確認した場合）

**記録のルール**
- どの情報源で調べたかをsourceUrlに記録する
  （現地確認の場合は、noteまたは専用フィールドに「現地確認」と記す）
- 調べた日付をlastCheckedに記録する
- どこにも情報が見つからない場合、hours / closedは空文字にせず
  「要確認」と入れる（未調査であることを示すため）

**表示上の扱い**
- sourceUrlが第三者サイトの場合、画面にも出典を明記する
  （例：「情報源：食べログ」）
- 「要確認」のまま掲載する場合、画面にも「要確認」と正直に表示し、
  空欄や埋めた体裁にしない

**採用基準**
- 公式サイト・現地確認 → そのまま掲載してよい
- 第三者サイト1件のみ → 掲載してよいが、出典を明記する
- 情報源なし → 「要確認」のまま掲載し、隠さない

### Step 4: データ登録

`restaurants-data.js` に既存と同じ形式で追加。**必ずコメントに調査日と手法を記録**：

**id・codeの採番ルール（重要・2026-07-30改定）**
- `id`：既存データ全体の**最大id + 1**を使う。地域をまたいで通し番号1本（地区ごとに0から振り直さない）。
  一度振った`id`は、その店が掲載終了（`status: hidden`等）になっても**絶対に再利用しない**（欠番のまま）。
- `code`：`都道府県市区町村コード-地区略称-連番`（例:`47213-IS-0056`）。**連番部分は`id`と同じ全体通し番号を使う**
  （`id + 1`を4桁ゼロ埋め）。地区ごとに`0001`から数え直さない
  （旧ルールは地区内連番だったが、複数地区展開時に`id`との対応が崩れるため統一した）。
  地区略称は石川=`IS`。他地区を追加する際は新しい略称を決めてこの表に追記する。
- `status`：通常は`"published"`
- `tel` / `lastChecked`：わかる範囲で記入。不明・未調査なら空文字のまま

**画面に表示する「店舗番号」について**
利用者・店舗側からの問い合わせ用に、`detail.html`の店舗詳細ページには`id`から自動生成した番号
（`No.000007`のような形式、`id + 1`を6桁ゼロ埋め）を表示している。この番号は地名・行政コードを
含まないため、地域が増えても値が変わらない。`restaurants-data.js`側にフィールドとしては持たせず、
表示時に`detail.html`内で計算している（`code`とは別物）。新規追加時に`code`さえ正しく振れば、
表示用番号は自動的に正しくなる。

```javascript
// ※以下N件は YYYY-MM-DD にOSM抽出＋公式店舗検索等とのウェブ二重照合で追加
{
  id:          0,   // （既存データ全体の最大id + 1）
  code:        "47213-IS-0000", // （id + 1を4桁ゼロ埋め）
  status:      "published",
  tel:         "",
  lastChecked: "",
  name:      "（正式店舗名）",
  genre:     "（既存ジャンル名に合わせる）",
  address:   "沖縄県うるま市石川…",
  hours:     "…",
  closed:    "…",
  note:      "（検証で確認できた事実のみ。未確認情報は書かない）",
  note_en:   "…",
  sourceUrl: "（公式店舗ページ等、最も信頼できる出典URL）",
  warn:      false,
  lat:       0.000000,
  lng:       0.000000,
  twitter: "", instagram: "", youtube: "", website: "…", detailText: "", photos: []
},
```

### Step 5: 反映（CLAUDE.mdのルール遵守）

1. `index.html` **と** `detail.html` の `restaurants-data.js?v=` を更新
2. **`node scripts/generate_sitemap.js` で sitemap.xml を再生成する**
   （公開ページが1つ増えるため。忘れると新店舗が検索に載らない）
3. ローカルプレビューで確認：ジャンル別件数・地図上のピン数・ポップアップ表示・
   `detail.html?id=N` の店舗詳細ページと店舗番号
4. コミット（日本語・調査手法を明記）→ push
5. デプロイ反映をMonitorで確認（`curl` で `?v=` の新値を待つ）

### Step 6: 記録

メモ（project_ishikawa_map.md）に追加店舗・件数・気づいた問題を記録する。

### Step 7: 新カテゴリの場合はスキル自体を更新する（要ユーザー確認）

今回調査したカテゴリが、Step 1の「カテゴリ別クエリ」表に**まだ載っていない新規カテゴリ**
だった場合は、次回以降の調査で使い回せるよう、このSKILL.mdを更新しておく。

1. 追記候補をまとめる
   - 「カテゴリ別クエリ」表に追加する行（カテゴリ名・タグ条件・名前検索の例）
   - 調査中に見つかった、このカテゴリ特有の注意点・落とし穴（表記ゆれ、
     使えた／使えなかった情報源、誤りがちな点など）→「過去の教訓」に追記する候補
2. **保存前に必ずユーザーに提示して確認を取る**
   - 追記candidate（表の行案・教訓案）を会話上に示し、「この内容でSKILL.mdに追記してよいか」を聞く
   - このファイルは今後の全カテゴリ調査の手順を左右するため、確認なしに書き換えない
3. 確認が取れたら、SKILL.mdの該当箇所（表・過去の教訓）を更新する

## 過去の教訓

- **座標の裏取りは国土地理院の住所検索APIが最も確実**
  （2026-08-02: 石川歴史民俗資料館の追加時、NAVITIMEは403で拒否されたが、
  国土地理院APIは即座に応答。OSMノードと31m以内で一致し裏取りできた。
  以後これを第一候補にする。詳細はStep 3の「座標の取得方法」参照）
- **公共施設は `area-profile` スキルの調査中に見つかることがある**
  （2026-08-02: 「石川について」ページ作成のため市公式を読んでいて
  石川歴史民俗資料館を発見。ユーザーの指摘がきっかけだった）
  → 地区紹介の調査で施設が出てきたら、地図への掲載候補としてメモしておく
- **店舗を1件追加したら `sitemap.xml` の再生成を忘れない**
  （`node scripts/generate_sitemap.js`。公開ページが増えるのでSEOに影響する）
- OSMだけに頼ると漏れる（2026-07: コンビニ14店中4店がOSM未登録だった）
- 地図サイト同士でも誤りがある（セブン白浜1丁目店の電話をファミマの番号と
  取り違えて掲載しているサイトがあった）→ 複数照合が必須
- 全角/半角・地番/住居表示の表記ゆれに注意
- Overpassサーバーは夜間混雑しやすい → リトライ・ミラー・時間を置く
- 正体不明のOSM登録「セブン」建物（26.433,127.8336）が未解決（要調査）
- OSMに同名チェーンの座標違い登録が複数あっても、即「重複」と決めつけない
  （2026-07-24: 美容・理容調査で「IWSAKI」「IWASAKI」という綴り違い・
  座標違いの2登録があったが、公式店舗一覧で確認したところ実際に
  マックスバリュ石川店・サンエー赤崎店の別々の実店舗だった）
- Workflowツールはユーザーの明示的なオプトイン（「ワークフローを使って」等の
  発言）がないと使用できない。その場合はAgentツールを複数バッチ
  （店舗を5〜6件ずつに分けて並列起動）で代用できる
  （2026-07-24: 美容・理容18候補を3バッチに分けて並行検証した）
- **OSM未登録・ウェブポータル未掲載の小規模店は、この手順だけでは発見できない**
  （2026-07-24: ユーザーがGoogleマップの現地写真で「セントジェームス石川店」
  〈旧店名ヘアープロジェクトサヴァ〉を発見。OSM抽出でも、WebSearchの
  「地区名＋業種＋一覧」検索でも見つからず、念のため理容ポータルの
  一覧ページ（23件）を直接WebFetchで全件確認してもヒットしなかった。
  つまり許可されている情報源のどれにも十分に載っていない店だった）
  → **こういう店は自動調査では原理的に拾いきれない。ユーザーからの
  「Googleマップで見かけた」という指摘は貴重な発見ルートとして常に歓迎し、
  住所・電話番号など裏取り可能な部分は複数ソースで確認した上で掲載する**
  （店名が最近変更された等、裏取りしきれない情報が残る場合はwarn:trueで
  「要確認」としつつ、存在自体は確認できた範囲で掲載してよい）
- チェーン店の店名は移転・改称でウェブ掲載が追いつかないことがある
  （上記セントジェームスの例。看板の店名とポータルサイトの店名が
  食い違う場合、看板側＝現地の実態を優先しつつnoteに旧店名を残す）
