# うるま市石川 飲食店マップ — 作業ルール

このファイルは Claude Code / OpenAI Codex など、複数のAIコーディングツールを
併用して作業する際に、共通の前提として必ず読むこと。

## プロジェクト概要

沖縄県うるま市石川エリアの飲食店・施設マップサイト。GitHub Pagesで一般公開中。

- **公開URL:** https://mokumao.github.io/ishikawa-map/
- **GitHubリポジトリ:** https://github.com/mokumao/ishikawa-map（mainブランチのルートから配信）
- **確認用パスワード:** 321（サイト初回アクセス時に入力）

## 主要ファイル

- `index.html` — メインページ（地図・サイドバー・カテゴリパネル等）
- `style.css` — 全体スタイル
- `script.js` — 地図・フィルター・検索・チップバー等の全ロジック
- `restaurants-data.js` — 店舗・施設データ
- `ishikawa-boundary.js` — 石川エリアの行政区域境界線データ
- `detail.html` — 店舗詳細ページ
- `news/index.html` — 「今日の石川ニュース」一覧ページ（**自動生成物、下記参照**）
- `scripts/fetch_news.py` — ニュース自動収集・HTML生成スクリプト
- `leaflet/` — Leaflet 1.9.4 ローカルコピー（CDNがプレビュー環境でブロックされるため）
- `.claude/launch.json` — プレビューサーバー設定
- `.claude/skills/poi-survey/SKILL.md` — **店舗・施設データ（POI）の調査・追加手順書**
- `.claude/skills/area-profile/SKILL.md` — **地区紹介ページ（「○○について」）の調査・作成手順書**

## 店舗・施設データの追加ルール

新しい店舗・施設を `restaurants-data.js` に追加するときは、
**必ず `.claude/skills/poi-survey/SKILL.md` の手順に従うこと。**
AIの記憶から店舗を列挙するのは禁止（網羅性がなく誤りも混入するため）。
OSM抽出＋公式店舗検索等との複数照合を行い、出典URLと調査日を記録する。
Googleマップ・NTTタウンページの自動収集は規約上禁止（人の目視ヒントのみ可）。

## 店舗データの識別

- 店舗の識別には必ず `id` フィールドを使うこと。
  `restaurants[配列インデックス]` による直接アクセスは禁止
  （並び順が変わると別の店舗を指してしまうため）。
- 店舗詳細ページのURLは `detail.html?id=N` 形式（`N`は`id`の値）。
  旧形式の `detail.html#N`（配列インデックスをハッシュで指定）でアクセスされた
  場合は、自動的に `?id=N` へ転送する。
- `id`は地域をまたぐ通し番号（削除されても再利用しない）。`code`の連番部分も
  同じ通し番号を使う。詳細は `.claude/skills/poi-survey/SKILL.md` の
  「id・codeの採番ルール」参照。

## statusによる表示制御

各店舗データは `status` フィールドで表示を制御する：

- `published` — 通常表示
- `hidden` — 非表示（削除依頼等。データ自体は残す）
- `pending` — 内容確認中
- `refused` — 掲載拒否（二度と掲載しない）
- `test` — 動作確認用（プレビュー環境のみ表示）
- `status` 未指定は `published` とみなす

## 店舗紹介文の方針

- AIによる紹介文の自動生成は禁止（事実確認ができないため）。
- 紹介文（`detailText`等）は店舗主本人から提供されたもののみ掲載する。

## 地区紹介文（「○○について」ページ）の方針

上の「店舗紹介文」とは扱いが違うので混同しないこと。

- **店舗紹介文**＝民間の店の宣伝文。裏が取れないのでAIは書かない。
- **地区紹介文**＝公共機関が公表している事実の要約。AIが調べて書いてよいが、
  **必ず `.claude/skills/area-profile/SKILL.md` の手順に従うこと。**
  - AIの記憶からは書かない。公共機関のページを実際に読んでから書く
  - 公式サイトの文章を丸写ししない（著作権）。要約・再構成する
  - 出典URLと最終更新日をページに表示する
  - 定期更新するときも、**本文の自動書き換えはしない**（差分を人が承認してから反映）

## 作業を始める前に必ずやること

1. **`git pull origin main` を実行してから作業を始める。**
   複数のツールを日をまたいで併用しているため、これを忘れると
   相手側の変更を上書きしたりコンフリクトを起こしたりする。
2. ローカルの `.claude/` 配下や `backup_*` フォルダは各ツールの作業用ファイルが
   混在することがある。`git status` で意図しない変更が無いか確認してからコミットする。

## 【重要】キャッシュバスティングのルール

`script.js` / `style.css` / `ishikawa-boundary.js` / `restaurants-data.js` を
編集したら、**`index.html` 内の該当 `<script>` / `<link>` タグの `?v=` を必ず更新すること。**

例：
```html
<link rel="stylesheet" href="style.css?v=20260708g">
<script src="ishikawa-boundary.js?v=20260709b"></script>
<script src="script.js?v=20260709b"></script>
```

命名は `YYYYMMDD` + 英字1文字（同日に複数回更新したら a→b→c…と進める）。
**これを忘れると、コードを直しても公開サイトに反映されない**（ブラウザが古いファイルを
キャッシュし続ける）という問題が過去に何度も起きている。修正のたびに必ずセットで更新する。

## 【重要】`news/index.html` は自動生成物

`news/index.html` は GitHub Actions が毎日朝6時(JST)に `scripts/fetch_news.py` を実行して
**上書き生成**している。そのため：

- `news/index.html` を直接編集しても、**翌朝の自動更新で変更が消える。**
- レイアウト・デザイン・共通UI（下部の「地図」ボタンなど）を変更する場合は、
  **`news/index.html` と `scripts/fetch_news.py` の両方に同じ変更を入れること。**
  （`fetch_news.py` 側の f-string テンプレート内、CSSとHTML構造が対応する箇所を探す）

## 動作確認のルール

- **コード修正後は必ずローカルプレビューで動作確認してからプッシュする。**
  プレビュー確認なしのプッシュは禁止（ユーザーの強い要望）。
- プレビューサーバー起動: `.claude/launch.json` の `ishikawa-map` 設定を使う
  （`npx serve -l 3456 .` を `cmd /c` 経由で実行）。
- Claude Code では `Claude_Preview` MCPツール（preview_start等）を使う。

## GitHub Pagesのデプロイについて

- **配信方式（2026-08-06変更）：** 以前は「ブランチから直接デプロイ（legacy／Jekyllベース）」
  方式だったが、このサイト固有のデプロイキューがGitHub側で詰まり続ける不具合が発生
  （buildは毎回成功するが、deployが"deployment_queued"のままタイムアウト。複数回の
  リトライ・Pages設定リセットでも解消せず）。
  `.github/workflows/deploy-pages.yml`（`actions/upload-pages-artifact` +
  `actions/deploy-pages` を使用）を新設し、GitHub側の設定（Settings → Pages → Source）
  も「GitHub Actions」に変更して解決した。以後はこのワークフロー経由でデプロイされる
  （配信内容・URLは従来と同じ。サイト訪問者への影響はない）。
- **デプロイが原因不明で失敗することがある**（ビルドは成功、デプロイのみ失敗）。
  その場合は空コミットで再トリガーする：
  ```bash
  git commit --allow-empty -m "chore: re-trigger pages deployment"
  git push origin main
  ```
  それでも解決しない場合は、GitHub Pages API（`gh api repos/mokumao/ishikawa-map/pages`）で
  `status`が`errored`になっていないか確認する。`.github/workflows/`配下のワークフロー
  ファイルをpushするには、通常のgit認証（PAT）に`workflow`スコープが必要な点に注意
  （無い場合は`gh auth token`を使って一時的にpushする）。
- 反映確認は以下で行う（該当ファイルの `?v=` が新しい値になっているか確認）：
  ```bash
  curl -s "https://mokumao.github.io/ishikawa-map/index.html" | grep -o 'script.js?v=[0-9a-z]*'
  ```
- プッシュ直後は反映まで数分かかることがある。焦って何度もプッシュし直さず、
  まずデプロイ状況を確認する：
  ```bash
  curl -s "https://api.github.com/repos/mokumao/ishikawa-map/actions/runs?per_page=3"
  ```

## コミットメッセージ

日本語で、変更内容を簡潔に要約する（例: `fix: 現在地ボタン押下時にポップアップを閉じる`）。
`Co-Authored-By:` フッターは使用ツールに応じて適切なものを付与する。

## 応答フォーマット

チャットでの返答の最後に、以下の形式で現在の日時を記載すること。

---
YYYY-MM-DD HH:MM

日時は正確なシステム時刻を使用すること（概算ではなく実際の時刻）。
前回の返答からの推測・加算は禁止。毎回、日時確認コマンド（例：`date`）を
実際に実行し、その結果をそのまま記載すること。

**Claude Codeでは、このルールを`.claude/settings.json`のStopフック
（`.claude/hooks/check-response-timestamp.js`）が機械的にチェックしている。**
返答末尾の日時が無い、または実際の現在時刻と10分以上ズレている場合は
停止がブロックされ、正しい時刻が指示として返される（2026-08-05、推測で
日時を書いてしまう事故が2度起きたため導入）。このフックはClaude Code専用
（他ツールでは本ルールをテキストとして守ること）。
