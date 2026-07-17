#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
今日の石川ニュース 自動収集スクリプト
GitHub Actions で毎日朝6時(JST)に実行される
"""

import feedparser
import os
import re
import json
from datetime import datetime, timezone, timedelta
from html import unescape, escape

# ── 日時設定（日本時間） ──────────────────────────────────────────
JST = timezone(timedelta(hours=9))
now_jst = datetime.now(JST)
today_str   = now_jst.strftime('%Y年%m月%d日')
today_date  = now_jst.strftime('%Y-%m-%d')
updated_str = now_jst.strftime('%Y年%m月%d日 %H:%M')

# 掲載期間：7日以内（過去）＋ 未来の情報は無制限
DAYS_LIMIT  = 7
cutoff_date = now_jst - timedelta(days=DAYS_LIMIT)

# 「ニュースがなかった日」を記録するファイル（日をまたいでも過去分の
# 「〇月△日のニュースはありません」表示を消さずに残すための永続化）
NO_NEWS_FILE = 'news/no_news_dates.json'

# 管理人投稿フォームの回答スプレッドシート（ウェブに公開したCSV）
# Googleフォーム「石川ニュース投稿（管理人用）」→ シート「フォームの回答 1」
ADMIN_POSTS_CSV_URL = ('https://docs.google.com/spreadsheets/d/e/'
    '2PACX-1vRiRIGgNkKBpeNKMsPOB8UOiwR_9yk7Gix_6LN6F4EG5X6i23K---P4V7JUY6oMuNW0OEQz8gCYM3F4'
    '/pub?gid=1849219516&single=true&output=csv')

# ── 石川関連キーワード ─────────────────────────────────────────────
ISHIKAWA_KEYWORDS = [
    'うるま市石川', '石川市', '石川区', '石川岳', '石川IC',
    '石川インター', '伊波', '嘉手苅', '田場', '東恩納',
    '高江洲', 'うるま市', 'うるま', '石川',
]

# ── RSSソース一覧 ──────────────────────────────────────────────────
def gnews(query):
    """Google News RSS URLを生成"""
    import urllib.parse
    return f'https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=ja&gl=JP&ceid=JP:ja'

RSS_SOURCES = [
    # ── 地域全般 ──
    {
        'name': 'Google ニュース（うるま市 石川）',
        'url': gnews('うるま市 石川 沖縄'),
        'filter': False,
    },
    # ── 施設別 ──
    {
        'name': '石川ドーム・闘牛',
        'url': gnews('石川ドーム 闘牛'),
        'filter': False,
    },
    {
        'name': '石川少年自然の家',
        'url': gnews('石川少年自然の家'),
        'filter': False,
    },
    {
        'name': 'ビオスの丘',
        'url': gnews('ビオスの丘'),
        'filter': False,
    },
    {
        'name': 'ココガーデンリゾート沖縄',
        'url': gnews('ココガーデンリゾート沖縄'),
        'filter': False,
    },
    # ── ニュースサイト ──
    # ※以前設定していた琉球新報RSS(rss/news.xml)は廃止、うるま市公式RSSは404、
    #   NHKのURLは国際ニュースのフィードでいずれも機能していなかった(2026-07確認)。
    #   Googleニュースのサイト内検索RSSに置き換えて再構築。
    # Googleニュースのsite:検索は該当記事が少ないと無関係な記事で埋めて
    # くるため、キーワードフィルタ（うるま・石川関連のみ通す）を併用する
    {
        'name': '沖縄タイムス',
        'url': gnews('site:okinawatimes.co.jp うるま'),
        'filter': True,
    },
    {
        'name': '琉球新報',
        'url': gnews('site:ryukyushimpo.jp うるま'),
        'filter': True,
    },
    {
        'name': 'うるま市公式サイト',
        'url': gnews('site:city.uruma.lg.jp'),
        # 市公式は入札公告など石川地区と無関係な事務情報が多いため、
        # 「石川」を含むものだけに絞る（石川地区の字名は石川○○で始まる）
        'filter_strict': True,
    },
]

# ── ユーティリティ関数 ────────────────────────────────────────────

def strip_html(text):
    """HTMLタグを除去してプレーンテキストを返す"""
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def is_ishikawa_related(title, summary=''):
    """石川関連キーワードが含まれているか判定"""
    text = title + ' ' + summary
    return any(kw in text for kw in ISHIKAWA_KEYWORDS)

def truncate(text, length=130):
    """指定文字数でテキストを切り詰める"""
    if not text:
        return ''
    return text[:length] + '…' if len(text) > length else text

def get_pub_date(entry):
    """RSSエントリから公開日時を取得してdatetimeで返す。取得できない場合はNone"""
    import time
    for field in ('published_parsed', 'updated_parsed', 'created_parsed'):
        t = entry.get(field)
        if t:
            try:
                # time.struct_time → UTC datetime → JST datetime
                dt_utc = datetime(*t[:6], tzinfo=timezone.utc)
                return dt_utc.astimezone(JST)
            except Exception:
                continue
    return None

def is_within_period(pub_date):
    """公開日が掲載対象期間内か判定（7日以内の過去 or 未来）"""
    if pub_date is None:
        return True  # 日付不明の場合は掲載する（除外しすぎを防ぐ）
    return pub_date >= cutoff_date  # cutoff_date以降（7日前〜未来）

def load_no_news_dates(path=NO_NEWS_FILE):
    """過去に「ニュースなし」だった日付（YYYY-MM-DD）の集合を読み込む"""
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_no_news_dates(dates, path=NO_NEWS_FILE):
    """「ニュースなし」だった日付の集合を保存する"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(sorted(dates), f, ensure_ascii=False, indent=2)

def format_date_label(pub_date):
    """表示用の日付ラベルを返す"""
    if pub_date is None:
        return ''
    delta = (pub_date.date() - now_jst.date()).days
    if delta > 0:
        return f'予定 {pub_date.strftime("%m/%d")}'
    elif delta == 0:
        return f'本日 {pub_date.strftime("%H:%M")}'
    elif delta == -1:
        return f'昨日 {pub_date.strftime("%m/%d")}'
    else:
        return pub_date.strftime('%m/%d')

# ── 管理人投稿の取得 ──────────────────────────────────────────────

def parse_admin_timestamp(ts):
    """Googleフォームのタイムスタンプ（例: 2026/07/16 0:12:34）をJSTのdatetimeに変換"""
    for fmt in ('%Y/%m/%d %H:%M:%S', '%Y/%m/%d %H:%M'):
        try:
            return datetime.strptime(ts, fmt).replace(tzinfo=JST)
        except ValueError:
            continue
    return None

def fetch_admin_posts():
    """管理人投稿フォームの回答（公開CSV）を取得して記事リスト形式で返す。
    取得に失敗してもニュース生成全体は止めない（空リストを返す）"""
    import csv
    import io
    import urllib.request
    posts = []
    try:
        print("取得中: 管理人投稿（Googleフォーム） ...")
        req = urllib.request.Request(ADMIN_POSTS_CSV_URL,
                                     headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            ts       = (row.get('タイムスタンプ') or '').strip()
            title    = (row.get('タイトル') or '').strip()
            body     = (row.get('詳しい内容') or '').strip()
            category = (row.get('カテゴリ') or '').strip()
            if not title:
                continue
            pub_date = parse_admin_timestamp(ts)
            if not is_within_period(pub_date):
                continue  # 掲載期間(7日)を過ぎた投稿は表示しない
            # フォームは自由入力なのでHTMLとして解釈されないようエスケープする
            source = '石川マップ管理人'
            if category:
                source += f'（{escape(category)}）'
            posts.append({
                'title':      escape(title),
                'summary':    truncate(escape(body)),
                'link':       '',   # 管理人投稿は外部リンクなし
                'source':     source,
                'date_label': format_date_label(pub_date),
                'pub_date':   pub_date.isoformat() if pub_date else '',
                'admin':      True,
            })
        print(f"  → {len(posts)}件")
    except Exception as e:
        print(f"  ⚠️ 管理人投稿の取得エラー: {e}")
    return posts

# ── メイン処理 ────────────────────────────────────────────────────

def fetch_articles():
    """全ソースからニュースを収集・フィルタ・重複除去して返す"""
    articles = []
    seen = set()

    for source in RSS_SOURCES:
        try:
            print(f"取得中: {source['name']} ...")
            feed = feedparser.parse(source['url'])

            if not feed.entries:
                print(f"  → 0件（フィードが空またはアクセス不可）")
                continue

            count = 0
            for entry in feed.entries[:30]:
                title   = strip_html(entry.get('title', ''))
                summary = strip_html(entry.get('summary', entry.get('description', '')))
                link    = entry.get('link', '')

                if not title or not link:
                    continue

                # キーワードフィルタ（必要なソースのみ）
                if source.get('filter') and not is_ishikawa_related(title, summary):
                    continue
                # 石川地区限定フィルタ（市公式など広域情報が多いソース用）
                if source.get('filter_strict') and '石川' not in (title + summary):
                    continue

                # 日付フィルタ：7日以内の過去 or 未来のみ掲載
                pub_date = get_pub_date(entry)
                if not is_within_period(pub_date):
                    continue

                # 重複除去（タイトル冒頭20文字で判定）
                # 全角/半角の違い（例: ２０日 と 20日）で同一記事が二重掲載
                # されないよう、NFKC正規化してから比較する
                import unicodedata
                key = unicodedata.normalize('NFKC', title)[:20]
                if key in seen:
                    continue
                seen.add(key)

                articles.append({
                    'title':      title,
                    'summary':    truncate(summary),
                    'link':       link,
                    'source':     source['name'],
                    'date_label': format_date_label(pub_date),
                    'pub_date':   pub_date.isoformat() if pub_date else '',
                })
                count += 1

            print(f"  → {count}件")

        except Exception as e:
            print(f"  ⚠️ エラー: {e}")

    return articles


def generate_html(articles, no_news_dates=None):
    """ニュース一覧 HTML を生成して news/index.html に保存"""
    no_news_dates = no_news_dates or set()

    # 記事と「〇月△日のニュースはありません」カードを、日付順のひとつの
    # 流れ（新しいものが上）に混ぜて表示する。
    # ソートキーはISO日時文字列。「ニュースはありません」カードには T99 を
    # 付けて、同じ日の記事よりも上（その日の先頭）に来るようにする
    items = []
    for a in articles:
        items.append((a['pub_date'] or '0000', 'article', a))
    for d in no_news_dates:
        items.append((d + 'T99', 'no_news', d))
    items.sort(key=lambda t: t[0], reverse=True)

    cards = ''
    for _key, kind, data in items:
        if kind == 'no_news':
            dt = datetime.strptime(data, '%Y-%m-%d')
            cards += f'''
    <article class="ni no-news">
      <span class="nt no-news-text">{dt.month}月{dt.day}日のニュースはありません</span>
    </article>'''
            continue
        a = data
        summary_html   = f'<p class="ns">{a["summary"]}</p>' if a['summary'] else ''
        date_html      = f'<span class="date-label">{a["date_label"]}</span>' if a['date_label'] else ''
        is_future      = a['pub_date'] and a['pub_date'] > now_jst.isoformat()
        future_class   = ' future' if is_future else ''
        admin_class    = ' admin' if a.get('admin') else ''
        # 管理人投稿は外部リンクが無いため、タイトルをリンクではなくテキストで表示
        if a['link']:
            title_html = f'<a class="nt" href="{a["link"]}" target="_blank" rel="noopener noreferrer">{a["title"]}</a>'
        else:
            title_html = f'<span class="nt nt-noline">{a["title"]}</span>'
        cards += f'''
    <article class="ni{future_class}{admin_class}">
      <div class="ni-header">
        {title_html}
        {date_html}
      </div>
      {summary_html}
      <span class="src">出典：{a['source']}</span>
    </article>'''

    if cards:
        body_html = f'<div class="nl">{cards}\n  </div>'
        count_label = f'{len(articles)}件'
    else:
        body_html = '''
  <div class="empty">
    <div class="empty-icon">📭</div>
    <p>本日は石川に関するニュースが<br>見つかりませんでした。</p>
    <p class="empty-sub">明日また自動更新されます。</p>
  </div>'''
        count_label = 'なし'

    # ── HTML テンプレート ──
    html = f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#e53935">
  <title>今日の石川ニュース {today_str}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    /* html/body自体はスクロールさせず、中身(.scroll-area)だけをスクロールさせる構造。
       position:fixed/stickyはWebView環境で描画タイミングの不具合が起きることがあるため、
       そもそも「動かす必要がない」レイアウト（外枠固定・中身スクロール）に変更した。 */
    html, body {{
      height: 100%;
      overflow: hidden;
    }}
    body {{
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN',
                   'Noto Sans JP', 'Meiryo', sans-serif;
      background: #f5f5f5;
      color: #333;
    }}
    .page-wrap {{
      display: flex;
      flex-direction: column;
      height: 100%;
    }}
    /* ── ヘッダー ── */
    header {{
      background: #e53935;
      color: #fff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      position: relative;
      z-index: 10;
    }}
    .hd-text h1 {{ font-size: 1rem; font-weight: bold; }}
    .hd-text small {{ display: block; font-size: 0.72rem; opacity: 0.85; margin-top: 1px; }}
    .badge {{
      margin-left: auto;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 0.75rem;
      white-space: nowrap;
    }}
    /* 記事一覧とフッターだけをスクロールさせる領域 */
    .scroll-area {{
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
    }}
    /* ── 記事リスト ── */
    main {{ max-width: 700px; margin: 0 auto; padding: 14px 12px; }}
    .nl {{ display: flex; flex-direction: column; gap: 10px; }}
    .ni {{
      background: #fff;
      border-radius: 10px;
      padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      border-left: 4px solid #e53935;
    }}
    .nt {{
      display: block;
      font-size: 0.93rem;
      font-weight: bold;
      color: #1565c0;
      text-decoration: none;
      line-height: 1.5;
      margin-bottom: 5px;
    }}
    .nt:hover {{ text-decoration: underline; }}
    /* 本日分のニュースが無いときのメッセージ（リンクではないので色を落とす） */
    .no-news-text {{ color: #888; cursor: default; }}
    .ns {{
      font-size: 0.8rem;
      color: #555;
      line-height: 1.6;
      margin-bottom: 6px;
    }}
    .src {{ font-size: 0.72rem; color: #aaa; }}
    .ni-header {{ display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; }}
    .ni-header .nt {{ margin-bottom: 0; flex: 1; }}
    .date-label {{
      flex-shrink: 0;
      font-size: 0.68rem;
      font-weight: bold;
      background: #f5f5f5;
      color: #888;
      border-radius: 4px;
      padding: 2px 6px;
      margin-top: 3px;
      white-space: nowrap;
    }}
    .ni.future {{ border-left-color: #1565c0; }}
    .ni.future .date-label {{ background: #e3f2fd; color: #1565c0; }}
    /* 管理人投稿：緑の縁取りで区別。タイトルはリンクではないので黒系 */
    .ni.admin {{ border-left-color: #2e7d32; }}
    .nt-noline {{ color: #263238; cursor: default; }}
    /* ── 記事なし ── */
    .empty {{
      background: #fff;
      border-radius: 12px;
      padding: 48px 20px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }}
    .empty-icon {{ font-size: 48px; margin-bottom: 16px; }}
    .empty p {{ font-size: 0.92rem; line-height: 1.9; color: #666; }}
    .empty-sub {{ font-size: 0.78rem; color: #aaa; margin-top: 8px; }}
    /* ── フッター ── */
    footer {{
      text-align: center;
      padding: 28px 16px 32px;
      color: #bbb;
      font-size: 0.72rem;
      line-height: 1.8;
    }}
    /* ── 下部バー：地図へ戻る（メイン画面の下部バーと同じ位置・見た目） ── */
    /* .page-wrap の flex 末尾に置くだけで、外枠自体が固定なので常に画面下部に留まる */
    .bottom-bar {{
      flex-shrink: 0;
      background: #fff;
      border-top: 1px solid #e0e0e0;
      box-shadow: 0 -2px 8px rgba(0,0,0,.08);
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
      display: flex;
    }}
    /* メイン地図画面の下部タブ（未選択状態）と同じ配色に合わせる */
    .bottom-map-btn {{
      display: flex; align-items: center; justify-content: center;
      width: 32%;
      padding: 9px 4px;
      font-size: 0.82rem;
      font-weight: 700;
      background: #fff;
      color: #546e7a;
      border: 2px solid #e53935;
      border-radius: 7px;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }}
  </style>
</head>
<body>
  <div class="page-wrap">
  <header>
    <div class="hd-text">
      <h1>今日の石川ニュース</h1>
      <small>{today_str} 更新</small>
    </div>
    <span class="badge">{count_label}</span>
  </header>

  <div class="scroll-area">
  <main>
    {body_html}
  </main>

  <footer>
    <p>情報は各ニュースソースから自動収集しています。</p>
    <p>内容の正確性は各出典元をご確認ください。</p>
    <p>自動更新：毎日朝6時（JST） / 最終更新 {updated_str}</p>
  </footer>
  </div>

  <!-- 下部バー：地図へ戻る -->
  <div class="bottom-bar">
    <a href="../index.html" class="bottom-map-btn">地図</a>
  </div>
  </div>
</body>
</html>'''

    os.makedirs('news', exist_ok=True)
    with open('news/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"\n[OK] news/index.html を生成しました（{len(articles)}件）")

    # JSON も保存（将来の活用のため）
    data = {
        'date':     today_date,
        'updated':  now_jst.isoformat(),
        'count':    len(articles),
        'articles': articles,
    }
    with open('news/today.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("[OK] news/today.json を生成しました")


# ── エントリーポイント ─────────────────────────────────────────────
if __name__ == '__main__':
    print(f"=== Ishikawa News Fetch Start: {today_date} ===\n")
    articles = fetch_articles()
    # 管理人投稿もニュース記事として合流させる
    # （本日の投稿があれば「ニュースはありません」の対象からも外れる）
    articles += fetch_admin_posts()
    print(f"\nTotal: {len(articles)} articles\n")

    # 本日分の記事が1件も無ければ「ニュースなしの日」として記録に追加。
    # 掲載期間(DAYS_LIMIT日)より古い記録は削除して肥大化を防ぐ。
    has_today = any(a['date_label'].startswith('本日') for a in articles)
    no_news_dates = load_no_news_dates()
    if not has_today:
        no_news_dates.add(today_date)
    else:
        # 朝の時点で「ニュースなし」と記録された後、同じ日に管理人投稿などで
        # 記事が増えた場合は「〇月△日のニュースはありません」を取り下げる
        no_news_dates.discard(today_date)
    cutoff_date_str = cutoff_date.strftime('%Y-%m-%d')
    no_news_dates = {d for d in no_news_dates if d >= cutoff_date_str}
    save_no_news_dates(no_news_dates)
    print(f"[OK] no_news_dates.json を更新しました（{len(no_news_dates)}件）")

    generate_html(articles, no_news_dates)
    print("\n=== Done ===")
