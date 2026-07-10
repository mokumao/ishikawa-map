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

- **デプロイが原因不明で失敗することがある**（ビルドは成功、デプロイのみ失敗）。
  その場合は空コミットで再トリガーする：
  ```bash
  git commit --allow-empty -m "chore: re-trigger pages deployment"
  git push origin main
  ```
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
