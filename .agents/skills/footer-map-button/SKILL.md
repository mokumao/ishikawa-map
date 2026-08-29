---
name: footer-map-button
description: 石川マップの各ページ左下にある「地図」ボタンと白い下部バーを、index.htmlの基準寸法へ正確に揃える。新規ページへの設置、既存ページの高さ・幅・下余白のずれ確認と修正に使用する。一般的なフッター変更には使用しない。
---

# 下部「地図」ボタン・バーのサイズ統一

各ページ左下の「地図」ボタンと、それを含む白い下部バーを、基準ページと実測で一致させる。目分量や「ほぼ同じ」で済ませない。

## 基準

基準ページは`index.html`の画面下部タブバー（`#bottomTabs`／`.bottom-tabs`／`.bottom-tab-btn`）。他ページをこの基準へ合わせ、基準側を他ページへ合わせない。

モバイル幅375px相当での基準値：

| 要素 | 基準値 |
|---|---|
| バーの高さ | **51px** |
| バーのpadding | `8px 10px`。高さを決める縦`8px`は固定し、横幅はレイアウトに応じて調整可能 |
| バーのborder-top | `1px solid #e0e0e0` |
| バー下の余白 | **18px** |
| 「地図」ボタンの高さ | **34px** |
| 「地図」ボタンの幅 | **`index.html`の地図画面は3ボタン均等**。`about-site.html`は同じ画面幅から算出してメイン画面と一致。その他のページは**113px固定** |
| ボタンのpadding | `2px 4px` |
| ボタンのfont-size | `1.15rem`（約18.4px） |
| ボタンのfont-weight | `700` |
| ボタンのborder | `2px solid #e53935` |
| ボタンのborder-radius | `7px` |

### 高さの決まり方

バー高さ51pxは、`border-top: 1px`、縦padding `8px × 2`、ボタン高さ34pxの合計で決まる（`1 + 16 + 34 = 51px`）。

ボタン高さは`min-height`だけでは保証できない。縦paddingが大きい場合は、`min-height: 34px`があっても実高さが34pxを超える。高さがずれたら、最初にpadding、border、box-sizing、継承値を確認する。

### 幅のルール

- `index.html`の地図画面下部にある「地図・店名・一覧」は3ボタンを均等幅にする。`.bottom-tab-btn { flex: 1; }`を基準とし、`#bottomTabMap`も`flex: 1 1 0`にする。
- `index.html`の「石川マップのご案内」情報パネル下部も、`repeat(3, minmax(0, 1fr))`、左右10px、列間8pxでメイン画面と同じ3列幅にする。
- `about-site.html`では、メイン画面と同じ端末上で同じ幅になるよう、外枠と余白の差を補正した`calc(33.333333% - 3.333333px)`を使う。CSSの除算を含む式は一部のiPhone Safariで無効になるため使用しない。
- 上記以外のページでは、左端の「地図」ボタンを113px固定にする。flexでは`flex: 0 0 113px`、gridでは地図ボタンの列を`113px`固定にする。
- 2026-08-27のユーザー確認により、メイン地図画面の3ボタンの均等さを、他ページとの地図ボタン単体の幅統一より優先する方針へ変更した。

### バー下の余白

バー要素自体の高さだけでなく、`margin-bottom: 18px`を含む視覚的な占有領域を揃える。

メイン画面ではLeaflet attribution用の余白だが、他ページも見た目の下端を揃えるため同じ18pxを持つ。バー高さ51pxが一致していても下余白がなければ、バー全体が低く見える。

## 現在の実装場所

新しい置き場所を正式に追加し、一覧更新も作業範囲に含まれる場合は、この表を更新する。

| ページ | 定義場所 | セレクタ | 固定方法・注意点 |
|---|---|---|---|
| `index.html`の地図画面下部タブ | `style.css` | `.bottom-tabs`／`#bottomTabMap`／`.bottom-tab-btn` | 3ボタン均等。`#bottomTabMap { flex: 1 1 0; }` |
| `index.html`の情報パネル下部 | `style.css` | `.info-panel-footer`／`.info-map-btn` | 3列均等、左右10px、列間8pxでメイン画面と一致。ボタンは1列目に配置 |
| `about-site.html` | `style.css` | `.about-guide-page .about-site-footer`／`.about-site-map-btn` | Safari互換の`calc(33.333333% - 3.333333px)`でメイン画面の均等幅と一致。高さ34px、バー51px、`margin-bottom: 18px`は基準を維持 |
| `about-ishikawa.html`、`about-recruit.html`、`about-management.html`、`about-purpose.html`、`about-accuracy.html` | `style.css` | `.about-site-footer`／`.about-site-map-btn`／`.about-site-info-btn` | `grid-template-columns: 113px 1fr 1fr`と`margin-bottom: 18px`。共通クラスなので変更影響は全対象ページへ及ぶ |
| `news/index.html` | `news/index.html`内のCSSと`scripts/fetch_news.py` | `.bottom-bar`／`.bottom-map-btn`／`.bottom-submit-btn` | `flex: 0 0 113px`と`margin-bottom: 18px`。生成物と生成元を一致させる |
| `updates/index.html` | `updates/index.html`内のCSS | `.updates-footer`／`.updates-map-btn` | 地図ボタン113px固定、バー51px、`margin-bottom: 18px` |
| `detail.html` | `detail.html`内のCSS | `.view-toggle-bar`／`.view-toggle-btn`／`#mapToggleBtn` | `#mapToggleBtn { flex: 0 0 113px; }`と`margin-bottom: 18px` |

## 既存ページを確認する

### 1. 作業範囲と実装を確認する

- `AGENTS.md`とGit状態を読み、既存の未コミット変更を保護する。
- 対象ページのHTMLとCSSを確認し、共通セレクタが他ページにも影響するか調べる。
- `news/index.html`は自動生成物なので、直接変更だけで終わらせない。`scripts/fetch_news.py`の対応テンプレートを正とし、必要な場合は生成物と生成元を同時に修正する。

### 2. ブラウザで実測する

ローカル表示をモバイル幅375pxで開き、利用可能なブラウザ評価機能または開発者機能で実測する。目視だけで判断しない。

実測前に、確認対象を必ず揃える。

- ローカルサーバーはルートの`start-local-preview.ps1`で起動し、現在の正式な作業フォルダー直下を配信する。過去の`.codex-push-worktree-*`を配信しない。
- 対象HTMLが参照している`style.css?v=`と、配信中CSSの対象ルールが現在の作業内容と一致することを確認する。再読み込みした事実だけで最新版と判断しない。
- 比較するページは別タブで開かず、同じタブのまま順番に移動して測る。別タブではビューポート設定が引き継がれないことがある。
- 各ページで`window.innerWidth`を記録し、同じ値であることを確認する。画像の切り抜き幅や写真アプリ上の表示幅はCSSの画面幅として扱わない。

```js
var bar = document.querySelector('対象ページのバーのセレクタ');
var btn = document.querySelector('対象ページの地図ボタンのセレクタ');
var barRect = bar.getBoundingClientRect();
var btnRect = btn.getBoundingClientRect();
JSON.stringify({
  viewportWidth: window.innerWidth,
  barHeight: barRect.height,
  btnHeight: btnRect.height,
  btnWidth: btnRect.width,
  marginBottom: getComputedStyle(bar).marginBottom,
  bottomGap: window.innerHeight - barRect.bottom
});
```

少なくとも次を確認する。

- バー高さ：51px
- ボタン高さ：34px
- ボタン幅：`index.html`の地図画面は3ボタンが同幅。`about-site.html`は同じ画面幅でメイン画面の地図ボタンと一致。その他のページの「地図」は113px
- バー下margin：18px
- ボタンがバー左端にある
- 比較した全ページの`window.innerWidth`が同じ

### 3. 原因を特定して修正する

- 高さのずれ：padding、border、box-sizing、継承値を確認する。
- 幅のずれ：`index.html`の地図画面と情報パネルでは3列が同幅か確認する。`about-site.html`は`calc(33.333333% - 3.333333px)`、その他のページでは`flex: 0 0 113px`またはgrid列113px固定を確認する。
- 見た目の下端のずれ：バー単体のheightだけでなく、marginと周辺要素を確認する。
- 共通CSSを変更する場合は、影響する全ページを確認する。
- ユーザーが依頼していない周辺レイアウト改善を混ぜない。

### 4. 複数幅で再計測する

修正後に同じコードで再計測する。375pxに加え、330pxまたは320px、必要に応じて390pxでも確認する。`index.html`の地図画面と`about-site.html`の地図ボタンが各幅で一致するか、その他のページでは113pxから変化しないかを確かめる。

### 5. スマホ写真と同じ条件の確認画像を作る

ユーザーから実機写真が提供されている場合は、数値測定だけで完了にしない。

- 写真から確認対象の画面幅を特定または推定し、同じ`window.innerWidth`で対象ページを描画する。
- ビューポート設定はタブ作成後に適用し、同じタブを再読み込みしてから`window.innerWidth`を再確認する。新しいタブへ設定が自動的に引き継がれると仮定しない。
- 通常表示のスクリーンショットを保存して目視し、レイアウトが崩れていないこと、ボタンが期待した見た目になっていることを確認する。
- ユーザーへの完了報告には確認画像を添付する。「ローカル再現画像で確認済み」「公開サイトで確認済み」「ユーザー実機で確認済み」を区別し、実機未確認の段階で実機でも直ったと断定しない。
- 画像生成が崩れた場合は、その画像を証拠に使わず、ビューポート・タブ・再読み込み条件を修正して撮り直す。

## 新しいページへ設置する

1. ゼロから独自実装せず、目的に近い一致済みページのHTMLとCSS構造を基にする。
2. 基準表の数値を使い、独自のpaddingや可変幅を思いつきで追加しない。
3. 375pxと狭幅で実測し、51px、34px、113px、18pxを確認する。
4. 共通CSSを再利用するときは、既存ページへの回帰がないか確認する。
5. 「現在の実装場所」表の更新が必要なら、Skill自体の変更も依頼範囲に含まれるか確認する。

## 生成ページの注意

`news/index.html`を直接編集しても、GitHub Actionsによる再生成で変更が消える。

- `scripts/fetch_news.py`内のf-stringテンプレートを修正する。
- 必要に応じて生成処理を実行し、生成後の`news/index.html`にも同じ値が入ることを確認する。
- 生成物だけ、または生成元だけが変わった状態で完了しない。
- 実行・反映方法は`AGENTS.md`の生成ファイル規則に従う。

## 実装後の確認

- 意図した対象だけを変更したか、差分を確認する。
- HTML、CSS、生成テンプレートの構文を確認する。
- 375pxと狭幅で実測値を再確認する。
- 地図ボタン以外の隣接ボタンが、狭幅でも操作可能か確認する。
- リンク、ボタン、スクロール、下部バー周辺の操作を確認する。
- CSSを変更した場合は、`AGENTS.md`のキャッシュバスティング規則に従う。
- コミット、プッシュ、公開は、ユーザーが明示的に許可した場合だけ行う。

## 判断の経緯と教訓

- 高さの不一致は、`min-height`ではなくページごとに異なる縦paddingが原因だった。基準の`2px 4px`へ統一して解消した。
- 当初、地図ボタン幅は列数や画面幅に依存していたが、「隣接ボタン数にかかわらず左下で同じ縦横サイズにする」という要望により113px固定となった。
- 2026-08-13には「全ページ113px統一」を選択していたが、2026-08-27の再確認でこの方針を更新した。
- 最新方針は、メイン地図画面と情報パネルは3列均等、`about-site.html`は同じ画面幅から算出して一致、その他のページは113px固定。過去の「全ページ113px固定」を再適用しない。
- バー高さ51pxが一致していても、下margin 18pxがないページは視覚的に低く見えた。要素単体ではなく周辺余白を含めて比較する。
- 一部ページだけの例外は、別の画面幅や別ページで新しい不一致を生む。例外を提案する場合は、全ページ・複数幅への影響を先に説明する。
- 2026-08-30の調査では、別タブの一方が375px、もう一方が1280pxで描画され、同じ幅の画像に縮小表示されたため、CSS上は一致しているボタンが異なる大きさに見えた。サイズ比較は必ず同じタブ・同じ`window.innerWidth`で行う。
- プッシュ後に`127.0.0.1:3456`を再読み込みしても、GitHub Pagesの更新確認にはならない。公開反映は公開URLで確認し、ローカル版を使う場合は配信元フォルダーとCSSバージョンを先に検証する。

## 完了条件

- 基準ページを変更せず、対象ページを基準へ合わせた。
- バー高さ51px、ボタン高さ34px、下余白18pxを実測した。
- 375pxと狭幅で、メイン地図画面・情報パネル・`about-site.html`の地図ボタンが一致し、その他のページは113px固定である。
- 比較したページの`window.innerWidth`と配信中の`style.css?v=`が一致している。
- 実機写真がある場合は、同じ画面幅の確認画像を目視し、完了報告に添付した。
- 共通CSSの全利用ページを確認した。
- `news/index.html`を扱った場合は生成元と生成物が一致している。
- 元から存在する未コミット変更や対象外ファイルを変更していない。
- コミット、プッシュ、公開はユーザーの許可範囲内である。
