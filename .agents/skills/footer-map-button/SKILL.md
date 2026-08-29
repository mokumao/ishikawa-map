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
| 「地図」ボタンの幅 | **`index.html`の地図画面は3ボタン均等**。`about-site.html`は写真比較による指定で**100px固定**。その他のページは**113px固定** |
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
- `about-site.html`では、写真比較によるユーザー指定を優先して左端の「地図」ボタンを100px固定にする。
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
| `index.html`の情報パネル下部 | `style.css` | `.info-panel-footer`／`.info-map-btn` | `.info-map-btn { flex: 0 0 113px; }` |
| `about-site.html` | `style.css` | `.about-guide-page .about-site-footer`／`.about-site-map-btn` | 写真比較によるユーザー指定で地図ボタン100px。高さ34px、バー51px、`margin-bottom: 18px`は基準を維持 |
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

```js
var bar = document.querySelector('対象ページのバーのセレクタ');
var btn = document.querySelector('対象ページの地図ボタンのセレクタ');
var barRect = bar.getBoundingClientRect();
var btnRect = btn.getBoundingClientRect();
JSON.stringify({
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
- ボタン幅：`index.html`の地図画面は3ボタンが同幅。`about-site.html`は100px。その他のページの「地図」は113px
- バー下margin：18px
- ボタンがバー左端にある

### 3. 原因を特定して修正する

- 高さのずれ：padding、border、box-sizing、継承値を確認する。
- 幅のずれ：`index.html`の地図画面では3ボタンが同幅か確認する。`about-site.html`はgrid列100px固定、その他のページでは`flex: 0 0 113px`またはgrid列113px固定を確認する。
- 見た目の下端のずれ：バー単体のheightだけでなく、marginと周辺要素を確認する。
- 共通CSSを変更する場合は、影響する全ページを確認する。
- ユーザーが依頼していない周辺レイアウト改善を混ぜない。

### 4. 複数幅で再計測する

修正後に同じコードで再計測する。375pxに加え、330pxまたは320px、必要に応じて390pxでも確認する。`index.html`の地図画面では3ボタンが各幅で均等か、`about-site.html`は100px、その他のページでは地図ボタンが113pxから変化しないかを確かめる。

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
- 最新方針は、メイン地図画面は3ボタン均等、`about-site.html`は100px固定、その他のページは113px固定。過去の「全ページ113px固定」を再適用しない。
- バー高さ51pxが一致していても、下margin 18pxがないページは視覚的に低く見えた。要素単体ではなく周辺余白を含めて比較する。
- 一部ページだけの例外は、別の画面幅や別ページで新しい不一致を生む。例外を提案する場合は、全ページ・複数幅への影響を先に説明する。

## 完了条件

- 基準ページを変更せず、対象ページを基準へ合わせた。
- バー高さ51px、ボタン高さ34px、下余白18pxを実測した。
- 375pxと狭幅で、メイン地図画面は3ボタンが均等幅、`about-site.html`は100px固定、その他のページは地図ボタンが113px固定である。
- 共通CSSの全利用ページを確認した。
- `news/index.html`を扱った場合は生成元と生成物が一致している。
- 元から存在する未コミット変更や対象外ファイルを変更していない。
- コミット、プッシュ、公開はユーザーの許可範囲内である。
