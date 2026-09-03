#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
地域ニュース 自動収集スクリプト
GitHub Actions で毎日朝6時(JST)に実行される
"""

import feedparser
import os
import re
import json
import hashlib
import unicodedata
from datetime import datetime, timezone, timedelta
from html import unescape, escape
from urllib.parse import urljoin, urlsplit, urlunsplit

from region_news_config import build_rss_sources, facility_aliases, load_region_profile

# ── 日時設定（日本時間） ──────────────────────────────────────────
JST = timezone(timedelta(hours=9))
now_jst = datetime.now(JST)
today_str   = now_jst.strftime('%Y年%m月%d日')
today_date  = now_jst.strftime('%Y-%m-%d')
updated_str = now_jst.strftime('%Y年%m月%d日 %H:%M')

# 掲載期間：7日以内（過去）＋ 未来の情報は無制限
DAYS_LIMIT  = 7
cutoff_date = now_jst - timedelta(days=DAYS_LIMIT)
AUDIT_RETENTION_DAYS = 30

# 「ニュースがなかった日」を記録するファイル（日をまたいでも過去分の
# 「〇月△日のニュースはありません」表示を消さずに残すための永続化）
REGION = load_region_profile()
REGION_NAME = REGION['displayName']
MUNICIPALITY_NAME = REGION['municipality']
PREFECTURE_NAME = REGION['prefecture']
NEWS_OUTPUT_DIR = REGION['outputDir']
NO_NEWS_FILE = f'{NEWS_OUTPUT_DIR}/no_news_dates.json'
CANDIDATES_FILE = f'{NEWS_OUTPUT_DIR}/candidates.json'
REVIEW_FILE = f'{NEWS_OUTPUT_DIR}/review.json'

# うるま市公式ページを入口に、公式に案内された開催情報だけを取得する。
URUMA_BULLFIGHTING_PAGE_URL = (
    'https://www.city.uruma.lg.jp/1007003000/contents/1408.html'
)
BULLFIGHTING_SOURCE = {
    'id': 'uruma-official-bullfighting',
    'name': 'うるま市公式案内・観光闘牛',
    'type': 'official',
    'trust': 100,
    'method': 'official-page',
    'facilityId': 'ishikawa-dome',
    'facilityAliases': ['石川多目的ドーム'],
}

# 管理人投稿フォームの回答スプレッドシート（ウェブに公開したCSV）
# Googleフォーム「石川ニュース投稿（管理人用）」→ シート「フォームの回答 1」
ADMIN_POSTS_CSV_URL = ('https://docs.google.com/spreadsheets/d/e/'
    '2PACX-1vRiRIGgNkKBpeNKMsPOB8UOiwR_9yk7Gix_6LN6F4EG5X6i23K---P4V7JUY6oMuNW0OEQz8gCYM3F4'
    '/pub?gid=1849219516&single=true&output=csv')

# 読者投稿フォームの回答スプレッドシート（ウェブに公開したCSV）
# Googleフォーム「石川マップ情報提供」→ シート「フォームの回答 1」
# 管理人が「承認」列に○を入れた行だけ掲載する（承認制）
READER_POSTS_CSV_URL = ('https://docs.google.com/spreadsheets/d/e/'
    '2PACX-1vS9yLstpHSeOF_l2mlwQ8kOvY898Wo7VsVf9sHNmPEcZzGOJoAqAWa1em4jCkAUsXU61lAjW0PLOy0m'
    '/pub?gid=1599536540&single=true&output=csv')

# 「承認」列でこのいずれかが入力されていたら掲載する
READER_APPROVED_MARKS = {'○', '〇', '◯', 'OK', 'ok', 'Ok', '済', '掲載'}

# ── 地域別設定 ────────────────────────────────────────────────────
REGION_KEYWORDS = REGION.get('regionKeywords', REGION['exactRegionPhrases'])
EXACT_REGION_PHRASES = REGION['exactRegionPhrases']
DISTRICT_TERMS = REGION['districtTerms']
CONTEXT_TERMS = REGION['contextTerms']
FACILITY_TERMS = facility_aliases(REGION)
OTHER_REGION_TERMS = REGION['falsePositiveRegions']
OTHER_PERSON_TERMS = REGION['falsePositivePeople']

# 誤掲載時の影響が大きいため、地域関連度が高くても自動掲載しない話題。
HIGH_IMPACT_TERMS = [
    '死亡', '死去', '訃報', '逮捕', '容疑', '犯罪', '事故', '火災', 'けが',
    '負傷', '行方不明', '閉店', '廃業', '営業終了', '食中毒',
]

# 写真ギャラリーや転載記事で、媒体名だけが違うタイトルを出来事単位にそろえる。
MEDIA_SUFFIXES = [
    '沖縄タイムス社', '沖縄タイムス', '琉球新報デジタル', '琉球新報',
    'PR TIMES', 'ウォーカープラス', 'walkerplus.com',
]

EVENT_TERMS = [
    '祭り', 'まつり', 'フェスティバル', 'フェス', '大会', '講座',
    '展示会', '企画展', '公演', 'イベント',
]

# 固定取得先に加え、行政、催し、施設、学校、防災、福祉、交通、商業を
# 地域設定から漏れなく探索する。新地域ではJSONを追加し、ここは変更しない。
RSS_SOURCES = build_rss_sources(REGION)

# ── ユーティリティ関数 ────────────────────────────────────────────

def strip_html(text):
    """HTMLタグを除去してプレーンテキストを返す"""
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', ' ', text)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def is_region_related(title, summary=''):
    """対象地域の関連キーワードが含まれているか判定"""
    text = title + ' ' + summary
    return any(kw in text for kw in REGION_KEYWORDS)

def is_region_district_related(title, summary='', require_context=True):
    """対象地区と自治体・都道府県の根拠を組み合わせて判定する。"""
    text = title + ' ' + summary
    if not any(term in text for term in DISTRICT_TERMS):
        return False
    if require_context and not any(term in text for term in CONTEXT_TERMS):
        return False
    return True

def truncate(text, length=130):
    """指定文字数でテキストを切り詰める"""
    if not text:
        return ''
    return text[:length] + '…' if len(text) > length else text

def normalize_text(text):
    """重複判定用に表記揺れ・空白・記号をそろえる。"""
    value = unicodedata.normalize('NFKC', text or '').lower()
    return re.sub(r'[\s\W_]+', '', value, flags=re.UNICODE)

def strip_gallery_prefix(title):
    """画像番号や「写真：」を除き、公開表示・重複判定用の表題を返す。"""
    value = unicodedata.normalize('NFKC', title or '').strip()
    value = re.sub(
        r'^(?:画像|写真)\s*\d+\s*/\s*\d+\s*[>＞]\s*',
        '', value, flags=re.IGNORECASE,
    )
    value = re.sub(r'^(?:画像|写真)\s*[:：]\s*', '', value, flags=re.IGNORECASE)
    return value.strip()

def strip_media_suffix(title):
    """タイトル末尾の媒体名を、重複比較のときだけ取り除く。"""
    value = title or ''
    for media in MEDIA_SUFFIXES:
        value = re.sub(
            rf'(?:\s*[-‐‑–—]\s*|\s+){re.escape(media)}\s*$', '', value,
            flags=re.IGNORECASE,
        )
    return value.strip()

def normalized_event_title(title):
    """画像番号・媒体名・表記揺れを除いた出来事単位のタイトル。"""
    return normalize_text(strip_media_suffix(strip_gallery_prefix(title)))

def extract_event_markers(title):
    """同じ施設の催しを媒体違いでまとめるため、明示された催し名を抽出する。"""
    clean = strip_media_suffix(strip_gallery_prefix(title))
    segments = re.findall(r'[「『]([^」』]{3,60})[」』]', clean)
    before_parenthesis = re.split(r'[（(]', clean, maxsplit=1)[0].strip()
    if before_parenthesis:
        segments.append(before_parenthesis)
    markers = []
    for segment in segments:
        if any(term in segment for term in EVENT_TERMS):
            marker = normalize_text(segment)
            if 4 <= len(marker) <= 60:
                markers.append(marker)
    return list(dict.fromkeys(markers))

def canonical_url(url):
    """候補識別用にURLのフラグメントを除去する。"""
    try:
        parts = urlsplit(url or '')
        return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path, parts.query, ''))
    except Exception:
        return url or ''

def assess_candidate(title, summary, source, pub_date, link):
    """Skillの初期基準に沿って地域関連度と信頼度を機械判定する。"""
    text = f'{title} {summary}'
    score = 0
    evidence = []
    reasons = []

    region_context = (
        any(term in text for term in EXACT_REGION_PHRASES)
        or (MUNICIPALITY_NAME in text and REGION_NAME in text)
        or (
            any(term in text for term in DISTRICT_TERMS)
            and any(term in text for term in CONTEXT_TERMS)
        )
    )

    exact_phrases = [term for term in EXACT_REGION_PHRASES if term in text]
    if exact_phrases:
        score += 60
        evidence.extend(exact_phrases)
    if MUNICIPALITY_NAME in text and REGION_NAME in text:
        score += 40
        evidence.append(f'{MUNICIPALITY_NAME}と{REGION_NAME}')

    facilities = []
    context_required_facilities = []
    for facility in REGION['verifiedFacilities']:
        matches = [term for term in facility.get('aliases', []) if term in text]
        if not matches:
            continue
        if facility.get('requireRegionContext') and not region_context:
            context_required_facilities.extend(matches)
        else:
            facilities.extend(matches)
    if facilities:
        score += 60
        evidence.extend(facilities)
    if context_required_facilities:
        reasons.append('同名施設の誤一致を防ぐため地域文脈の確認が必要')

    source_facilities = [
        term for term in source.get('facilityAliases', []) if term in text
    ]
    if source_facilities and (
        not source.get('facilityRequireContext') or region_context
    ):
        score += 60
        evidence.extend(source_facilities)
    elif source.get('facilityId'):
        # 専用検索から見つかっただけでは公開せず、原典で施設名を確認するまで保留する。
        score += 35
        evidence.append(f'取得元候補：{source["name"]}')
        reasons.append('施設専用検索で発見したが、記事内の施設名確認が必要')

    source_theme_terms = [
        term for term in source.get('regionalThemeTerms', []) if term in text
    ]
    if source_theme_terms and (
        not source.get('regionalThemeRequireContext') or region_context
    ):
        score += 60
        evidence.extend(source_theme_terms)
    elif source.get('regionalTheme'):
        score += 35
        evidence.append(f'取得元候補：{source["name"]}')
        reasons.append('地域固有テーマ専用検索で発見したが、記事内の地域文脈確認が必要')

    districts = [term for term in DISTRICT_TERMS if term in text]
    if districts and any(term in text for term in CONTEXT_TERMS):
        score += 25
        evidence.extend(districts[:3])

    if source.get('type') == 'official':
        score += 15
        evidence.append(f'{MUNICIPALITY_NAME}等の公式発信')

    other_regions = [term for term in OTHER_REGION_TERMS if term in text]
    if other_regions:
        score -= 100
        reasons.append('対象外地域との一致を検出')

    other_people = [term for term in OTHER_PERSON_TERMS if term in text]
    if other_people:
        score -= 100
        reasons.append(f'人名の「{REGION_NAME}」との一致を検出')

    if MUNICIPALITY_NAME in text and not districts and REGION_NAME not in text:
        score -= 25
        reasons.append(f'{MUNICIPALITY_NAME}内だが{REGION_NAME}地区の根拠が不足')

    score = max(0, min(100, score))
    confidence = int(source.get('trust', 50))
    if source.get('method') == 'google-news':
        confidence -= 15
        reasons.append('Googleニュース経由のため配信元記事を確認できるリンクを使用')
    if pub_date is None:
        confidence -= 20
        reasons.append('公開日時を確認できない')
    if not link:
        confidence -= 30
        reasons.append('原典URLを確認できない')
    confidence = max(0, min(100, confidence))

    if 35 <= score < 60:
        reasons.append(f'{REGION_NAME}地区との関係を確認できないため記録')
    elif score < 35:
        reasons.append(f'{REGION_NAME}地区との関連根拠が不足')

    return score, list(dict.fromkeys(evidence)), confidence, list(dict.fromkeys(reasons))

def classify_candidate(score, confidence, text, pub_date, link):
    """候補を自動掲載・判断保留・自動除外の3経路へ分ける。"""
    if score < 35:
        return 'rejected', f'{REGION_NAME}地区との関連根拠が基準未満のため自動除外'
    if any(term in text for term in HIGH_IMPACT_TERMS):
        return 'review', '慎重な確認が必要な内容のため判断保留'
    if score < 60:
        return 'review', f'{REGION_NAME}地区との関係を確定できないため判断保留'
    if pub_date is None:
        return 'review', '公開日時を確認できないため判断保留'
    if not link:
        return 'review', '配信元へ移動できるURLがないため判断保留'
    if confidence < 45:
        return 'review', '情報源の信頼度が自動掲載基準未満のため判断保留'
    return 'published', f'{REGION_NAME}地区・日時・情報源の自動掲載条件を満たした'

def build_candidate(title, summary, link, source, pub_date, previous=None,
                    event_starts_at=None, event_ends_at=None, category='news'):
    """公開記事とは分離した、自動判定・監査用の候補データを作る。"""
    previous = previous or {}
    normalized_title = normalize_text(title)
    normalized_url = canonical_url(link)
    article_fingerprint = hashlib.sha256(
        f'{normalized_title}|{normalized_url}'.encode('utf-8')
    ).hexdigest()[:20]
    event_title = normalized_event_title(title) or normalized_title
    fingerprint = hashlib.sha256(event_title.encode('utf-8')).hexdigest()[:20]
    effective_date = event_starts_at or pub_date
    date_prefix = effective_date.strftime('%Y%m%d') if effective_date else now_jst.strftime('%Y%m%d')
    candidate_id = f'{date_prefix}-{source["id"]}-{article_fingerprint[:10]}'
    score, evidence, confidence, reasons = assess_candidate(
        title, summary, source, pub_date, link
    )
    status, decision_reason = classify_candidate(
        score, confidence, f'{title} {summary}', effective_date, link
    )
    reasons.append(decision_reason)

    expires_at = None
    if event_ends_at:
        expires_at = event_ends_at.replace(hour=23, minute=59, second=59).isoformat()
    elif event_starts_at:
        expires_at = event_starts_at.replace(hour=23, minute=59, second=59).isoformat()
    elif pub_date:
        expires_at = (pub_date + timedelta(days=DAYS_LIMIT)).replace(
            hour=23, minute=59, second=59
        ).isoformat()

    return {
        'id': candidate_id,
        'title': title,
        'displayTitle': strip_media_suffix(strip_gallery_prefix(title)),
        'summary': truncate(summary),
        'url': link,
        'sourceId': source['id'],
        'sourceName': source['name'],
        'sourceType': source.get('type', 'discovery'),
        'publishedAt': pub_date.isoformat() if pub_date else None,
        'discoveredAt': previous.get('discoveredAt') or now_jst.isoformat(),
        'checkedAt': now_jst.isoformat(),
        'eventStartsAt': event_starts_at.isoformat() if event_starts_at else None,
        'eventEndsAt': event_ends_at.isoformat() if event_ends_at else None,
        'expiresAt': expires_at,
        'category': category,
        'localScore': score,
        'localEvidence': evidence,
        'confidence': confidence,
        'status': status,
        'requiresReview': status == 'review',
        'reviewReasons': reasons,
        'fingerprint': fingerprint,
        'articleFingerprint': article_fingerprint,
        'facilityId': source.get('facilityId'),
        'eventMarkers': extract_event_markers(title),
        'relatedUrls': [],
        'duplicateOf': None,
    }

def load_previous_candidates(path=CANDIDATES_FILE):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        items = []
        for item in data.get('candidates', []):
            if not item.get('id'):
                continue
            if (
                item.get('sourceId') == BULLFIGHTING_SOURCE['id']
                and item.get('scheduleGroup') != 'tourist-bullfighting-calendar'
            ):
                # 開催日ごとに候補を作った旧試作形式は、監査記録へ引き継がない。
                continue
            items.append(item)
        return {item['id']: item for item in items}
    except Exception:
        return {}

def save_candidate_data(candidates, source_results):
    """個人情報を含まないRSS候補と自動判定結果を監査用JSONへ保存する。"""
    os.makedirs(NEWS_OUTPUT_DIR, exist_ok=True)
    candidates.sort(
        key=lambda item: item.get('eventStartsAt') or item.get('publishedAt') or '',
        reverse=True,
    )
    review_candidates = [item for item in candidates if item.get('requiresReview')]
    status_counts = {
        status: sum(1 for item in candidates if item.get('status') == status)
        for status in ('published', 'review', 'rejected', 'duplicate', 'expired')
    }
    data = {
        'regionId': REGION['id'],
        'regionName': REGION_NAME,
        'updated': now_jst.isoformat(),
        'count': len(candidates),
        'reviewCount': len(review_candidates),
        'statusCounts': status_counts,
        'sourceResults': source_results,
        'candidates': candidates,
    }
    with open(CANDIDATES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(REVIEW_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            'updated': now_jst.isoformat(),
            'count': len(review_candidates),
            'candidates': review_candidates,
        }, f, ensure_ascii=False, indent=2)
    print(
        '[OK] ニュース自動判定を保存しました'
        f'（掲載{status_counts["published"]}／保留{status_counts["review"]}'
        f'／除外{status_counts["rejected"]}／重複{status_counts["duplicate"]}'
        f'／期限切れ{status_counts["expired"]}）'
    )

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
    month_day = f'{pub_date.month}/{pub_date.day}'
    delta = (pub_date.date() - now_jst.date()).days
    if delta > 0:
        return f'予定 {month_day}'
    elif delta == 0:
        return f'本日 {pub_date.strftime("%H:%M")}'
    elif delta == -1:
        return f'昨日 {month_day}'
    else:
        return month_day

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

# ── 読者投稿（承認済みのみ）の取得 ────────────────────────────────

def fetch_reader_posts():
    """読者投稿フォームの回答（公開CSV）のうち、管理人が「承認」列に
    ○等を入れた行だけを記事リスト形式で返す。承認が無い行は掲載しない。
    取得に失敗してもニュース生成全体は止めない（空リストを返す）"""
    import csv
    import io
    import urllib.request
    posts = []
    try:
        print("取得中: 読者投稿（承認済みのみ） ...")
        req = urllib.request.Request(READER_POSTS_CSV_URL,
                                     headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            ts       = (row.get('タイムスタンプ') or '').strip()
            body     = (row.get('お寄せいただく石川の情報') or '').strip()
            name     = (row.get('お名前（ニックネーム可・任意）') or '').strip()
            approved = (row.get('承認') or '').strip()
            title    = (row.get('掲載タイトル') or '').strip()
            if approved not in READER_APPROVED_MARKS:
                continue  # 承認されていない投稿は掲載しない
            if not body:
                continue
            pub_date = parse_admin_timestamp(ts)
            if not is_within_period(pub_date):
                continue  # 掲載期間(7日)を過ぎた投稿は表示しない
            # 掲載タイトルが未入力の場合は本文の先頭から自動生成
            if not title:
                title = body[:25] + ('…' if len(body) > 25 else '')
            # フォームは自由入力なのでHTMLとして解釈されないようエスケープする
            summary = truncate(escape(body))
            if name:
                summary += f'（情報提供：{escape(name)}さん）'
            posts.append({
                'title':      escape(title),
                'summary':    summary,
                'link':       '',   # 読者投稿は外部リンクなし
                'source':     '読者提供',
                'date_label': format_date_label(pub_date),
                'pub_date':   pub_date.isoformat() if pub_date else '',
                'admin':      True,   # 管理人投稿と同じ緑縁取りカードで表示
            })
        print(f"  → {len(posts)}件")
    except Exception as e:
        print(f"  ⚠️ 読者投稿の取得エラー: {e}")
    return posts

# ── メイン処理 ────────────────────────────────────────────────────

def same_event(candidate_a, candidate_b):
    """タイトル正規化、または同じ施設の明示的な催し名で同一内容か判定する。"""
    if candidate_a.get('fingerprint') == candidate_b.get('fingerprint'):
        return True
    facility_a = candidate_a.get('facilityId')
    facility_b = candidate_b.get('facilityId')
    if not facility_a or facility_a != facility_b:
        return False
    event_date_a = (candidate_a.get('eventStartsAt') or '')[:10]
    event_date_b = (candidate_b.get('eventStartsAt') or '')[:10]
    if event_date_a and event_date_b and event_date_a != event_date_b:
        return False
    markers_a = set(candidate_a.get('eventMarkers') or [])
    markers_b = set(candidate_b.get('eventMarkers') or [])
    return bool(markers_a & markers_b)

def representative_rank(candidate):
    """同一内容から、公開リンクとして最も分かりやすい代表記事を選ぶ。"""
    status_rank = {'published': 3, 'review': 2, 'rejected': 1}.get(
        candidate.get('status'), 0
    )
    clean_title = candidate.get('displayTitle') or candidate.get('title') or ''
    is_clean_title = int(clean_title == (candidate.get('title') or ''))
    source_rank = {'official': 3, 'media': 2, 'discovery': 1}.get(
        candidate.get('sourceType'), 0
    )
    return (
        status_rank,
        is_clean_title,
        source_rank,
        int(candidate.get('confidence') or 0),
        int(candidate.get('localScore') or 0),
        candidate.get('eventStartsAt') or candidate.get('publishedAt') or '',
    )

def deduplicate_candidates(candidates):
    """同じ出来事をまとめ、代表1件だけを公開対象として残す。"""
    count = len(candidates)
    parents = list(range(count))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left, right):
        root_left = find(left)
        root_right = find(right)
        if root_left != root_right:
            parents[root_right] = root_left

    for left in range(count):
        for right in range(left + 1, count):
            if same_event(candidates[left], candidates[right]):
                union(left, right)

    groups = {}
    for index, candidate in enumerate(candidates):
        groups.setdefault(find(index), []).append(candidate)

    for group in groups.values():
        if len(group) == 1:
            group[0]['relatedCount'] = 0
            continue
        representative = max(group, key=representative_rank)
        group_fingerprint = representative['fingerprint']
        related_urls = []
        for candidate in group:
            candidate['fingerprint'] = group_fingerprint
            if candidate is representative:
                continue
            if candidate.get('url') and candidate['url'] != representative.get('url'):
                related_urls.append(candidate['url'])
            candidate['status'] = 'duplicate'
            candidate['requiresReview'] = False
            candidate['duplicateOf'] = representative['id']
            candidate['reviewReasons'] = [
                f'同じ内容として代表記事「{representative["displayTitle"]}」へ統合'
            ]
        representative['relatedUrls'] = list(dict.fromkeys(related_urls))
        representative['relatedCount'] = len(group) - 1
        representative['reviewReasons'] = list(dict.fromkeys(
            (representative.get('reviewReasons') or []) +
            [f'同じ内容の記事{len(group) - 1}件を代表記事へ統合']
        ))

    return candidates

def candidate_to_article(candidate):
    """自動掲載候補を公開ニュースの既存形式へ変換する。"""
    published_at = candidate.get('eventStartsAt') or candidate.get('publishedAt')
    pub_date = None
    if published_at:
        try:
            pub_date = datetime.fromisoformat(published_at)
        except ValueError:
            pub_date = None
    display_title = strip_media_suffix(
        candidate.get('displayTitle') or candidate['title']
    )
    summary = strip_media_suffix(strip_gallery_prefix(candidate.get('summary') or ''))
    if normalize_text(summary) == normalize_text(display_title):
        summary = ''
    return {
        'title': display_title,
        'summary': summary,
        'link': candidate.get('url') or '',
        'source': candidate.get('sourceName') or '',
        'date_label': format_date_label(pub_date),
        'pub_date': published_at or '',
    }

def parse_candidate_date(candidate):
    """監査記録の保存期限判定に使える日時を返す。"""
    for field in ('eventStartsAt', 'publishedAt', 'discoveredAt', 'checkedAt'):
        value = candidate.get(field)
        if not value:
            continue
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=JST)
            return parsed.astimezone(JST)
        except (TypeError, ValueError):
            continue
    return None

def merge_audit_history(candidates, previous_candidates):
    """今回のフィードから消えた候補を30日間、期限切れの監査記録として残す。"""
    current_ids = {candidate['id'] for candidate in candidates}
    audit_cutoff = now_jst - timedelta(days=AUDIT_RETENTION_DAYS)
    for candidate_id, previous in previous_candidates.items():
        if candidate_id in current_ids:
            continue
        record_date = parse_candidate_date(previous)
        if record_date and record_date < audit_cutoff:
            continue
        archived = dict(previous)
        if archived.get('status') != 'expired':
            archived['previousStatus'] = archived.get('status')
            archived['status'] = 'expired'
            archived['requiresReview'] = False
            archived['reviewReasons'] = list(dict.fromkeys(
                (archived.get('reviewReasons') or []) +
                ['掲載・判断期間を過ぎたため監査記録へ移動']
            ))
        candidates.append(archived)
    return candidates

def fetch_page(url):
    """公開ページを1回だけ取得する。呼び出し側で失敗を監査記録へ残す。"""
    import urllib.request
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': (
                'IshikawaMapNewsBot/1.0 '
                '(https://github.com/mokumao/ishikawa-map)'
            )
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode('utf-8', errors='replace')

def extract_bullfighting_detail_url(city_html):
    """うるま市公式ページが案内している観光闘牛ページを返す。"""
    for href in re.findall(r'href=["\']([^"\']+)["\']', city_html or '', re.IGNORECASE):
        absolute = urljoin(URUMA_BULLFIGHTING_PAGE_URL, unescape(href))
        parsed = urlsplit(absolute)
        if parsed.hostname == 'www.lequio-tourist.okinawa' and parsed.path.endswith('/travel_03.php'):
            return absolute
    return None

def extract_official_page_updated_at(city_html):
    """うるま市公式ページに表示された更新日をJSTで返す。"""
    text = strip_html(city_html)
    match = re.search(r'更新日\s*[：:]\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日', text)
    if not match:
        return None
    try:
        return datetime(
            int(match.group(1)), int(match.group(2)), int(match.group(3)),
            12, 0, tzinfo=JST,
        )
    except ValueError:
        return None

def parse_bullfighting_event_dates(detail_html):
    """観光闘牛ページから、年をまたぐ開催日を重複なく抽出する。"""
    text = strip_html(detail_html)
    dates = []
    current_year = None
    pattern = re.compile(
        r'(?:(20\d{2})年\s*)?(\d{1,2})月\s*(\d{1,2})日'
    )
    for match in pattern.finditer(text):
        if match.group(1):
            current_year = int(match.group(1))
        if current_year is None:
            continue
        try:
            event_date = datetime(
                current_year, int(match.group(2)), int(match.group(3)),
                0, 0, tzinfo=JST,
            )
        except ValueError:
            continue
        if event_date not in dates:
            dates.append(event_date)
    return sorted(dates)

def fetch_official_bullfighting_candidates(previous_candidates):
    """うるま市公式の案内を入口に、石川多目的ドームの開催日を候補化する。"""
    result = {
        'id': BULLFIGHTING_SOURCE['id'],
        'name': BULLFIGHTING_SOURCE['name'],
        'status': 'success',
        'entryCount': 0,
        'candidateCount': 0,
        'publishedCount': 0,
        'error': None,
    }
    candidates = []
    try:
        print(f"取得中: {BULLFIGHTING_SOURCE['name']} ...")
        city_html = fetch_page(URUMA_BULLFIGHTING_PAGE_URL)
        detail_url = extract_bullfighting_detail_url(city_html)
        if not detail_url:
            raise ValueError('うるま市公式ページから観光闘牛の案内先を確認できません')
        page_updated_at = extract_official_page_updated_at(city_html)
        detail_html = fetch_page(detail_url)
        event_dates = parse_bullfighting_event_dates(detail_html)
        result['entryCount'] = len(event_dates)
        active_dates = [
            date for date in event_dates if date.date() >= now_jst.date()
        ]
        if active_dates:
            next_date = active_dates[0]
            last_date = active_dates[-1]
            title = (
                '石川多目的ドーム 観光闘牛の開催日程'
                f'（次回{next_date.year}年{next_date.month}月{next_date.day}日）'
            )
            schedule = '、'.join(
                f'{date.year}年{date.month}月{date.day}日' for date in active_dates
            )
            summary = f'開催予定：{schedule}'
            candidate = build_candidate(
                title,
                summary,
                detail_url,
                BULLFIGHTING_SOURCE,
                page_updated_at,
                event_starts_at=next_date,
                event_ends_at=last_date,
                category='event',
            )
            previous = previous_candidates.get(candidate['id'])
            if previous:
                candidate['discoveredAt'] = previous.get('discoveredAt') or candidate['discoveredAt']
            candidate['reviewReasons'] = list(dict.fromkeys(
                candidate['reviewReasons'] +
                ['うるま市公式ページから案内された開催日程を確認']
            ))
            candidate['scheduleGroup'] = 'tourist-bullfighting-calendar'
            candidates.append(candidate)
            result['candidateCount'] = 1
        if not event_dates:
            result['status'] = 'empty'
        elif not active_dates:
            result['status'] = 'empty'
        print(
            f"  → 有効な開催日{len(active_dates)}件を"
            f"{result['candidateCount']}件の候補に集約"
        )
    except Exception as error:
        print(f"  ⚠️ 取得エラー: {error}")
        result['status'] = 'error'
        result['error'] = str(error)[:200]
    return candidates, result

def fetch_articles():
    """候補を収集し、自動掲載・判断保留・自動除外・重複へ分類する。"""
    candidates = []
    source_results = []
    previous_candidates = load_previous_candidates()

    if 'bullfighting_schedule' in REGION['officialAdapters']:
        official_candidates, official_result = fetch_official_bullfighting_candidates(
            previous_candidates
        )
        candidates.extend(official_candidates)
        source_results.append(official_result)

    for source in RSS_SOURCES:
        source_result = {
            'id': source['id'],
            'name': source['name'],
            'status': 'success',
            'entryCount': 0,
            'candidateCount': 0,
            'publishedCount': 0,
            'error': None,
        }
        try:
            print(f"取得中: {source['name']} ...")
            feed = feedparser.parse(source['url'])
            source_result['entryCount'] = len(feed.entries)

            if not feed.entries:
                if getattr(feed, 'bozo', False):
                    print("  ⚠️ 取得エラー（記事を取得できませんでした）")
                    source_result['status'] = 'error'
                    source_result['error'] = str(getattr(feed, 'bozo_exception', '取得失敗'))[:200]
                else:
                    print("  → 0件（フィードに記事なし）")
                    source_result['status'] = 'empty'
                source_results.append(source_result)
                continue

            for entry in feed.entries[:source.get('maxEntries', 30)]:
                title   = strip_html(entry.get('title', ''))
                summary = strip_html(entry.get('summary', entry.get('description', '')))
                link    = entry.get('link', '')

                if not title or not link:
                    continue

                # 候補も公開記事と同じ期間を対象にする。
                pub_date = get_pub_date(entry)
                if not is_within_period(pub_date):
                    continue

                candidate = build_candidate(title, summary, link, source, pub_date)
                previous = previous_candidates.get(candidate['id'])
                if previous:
                    candidate['discoveredAt'] = previous.get('discoveredAt') or candidate['discoveredAt']
                candidates.append(candidate)
                source_result['candidateCount'] += 1
            print(f"  → 候補{source_result['candidateCount']}件")

        except Exception as e:
            print(f"  ⚠️ エラー: {e}")
            source_result['status'] = 'error'
            source_result['error'] = str(e)[:200]
        source_results.append(source_result)

    deduplicate_candidates(candidates)
    merge_audit_history(candidates, previous_candidates)
    articles = [
        candidate_to_article(candidate)
        for candidate in candidates
        if candidate.get('status') == 'published'
    ]
    source_by_id = {result['id']: result for result in source_results}
    for candidate in candidates:
        if candidate.get('status') != 'published':
            continue
        result = source_by_id.get(candidate.get('sourceId'))
        if result:
            result['publishedCount'] += 1
    return articles, candidates, source_results


def generate_html(articles, no_news_dates=None):
    """ニュース一覧HTMLを地域設定の出力先へ保存する。"""
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
        summary_html   = f'\n      <p class="ns">{a["summary"]}</p>' if a['summary'] else ''
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
      </div>{summary_html}
      <span class="src">出典：{a['source']}</span>
    </article>'''

    if cards:
        body_html = f'<div class="nl">{cards}\n  </div>'
        count_label = f'{len(articles)}件'
    else:
        body_html = f'''
  <div class="empty">
    <div class="empty-icon">📭</div>
    <p>本日は{escape(REGION_NAME)}に関するニュースが<br>見つかりませんでした。</p>
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
  <title>今日の{escape(REGION_NAME)}ニュース {today_str}</title>
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
      /* メイン地図画面の下部バー（.bottom-tabs）が持つattribution分の
         余白と、下部の見た目の高さを揃える（2026-08-13） */
      margin-bottom: 18px;
    }}
    /* メイン地図画面の下部タブ（未選択状態）と同じ配色に合わせる */
    .bottom-map-btn {{
      display: flex; align-items: center; justify-content: center;
      /* 隣のボタン数に関わらず常に113px固定（.claude/skills/footer-map-button/SKILL.md参照） */
      flex: 0 0 113px;
      padding: 2px 4px;
      font-size: 1.15rem;
      font-weight: 700;
      background: #fff;
      color: #222;
      border: 2px solid #e53935;
      border-radius: 7px;
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;
    }}
    /* 読者からの情報提供フォームへの入口（承認制：投稿は管理人確認後に掲載） */
    .bottom-submit-btn {{
      display: flex; align-items: center; justify-content: center;
      flex: 1;
      margin-left: 8px;
      padding: 2px 4px;
      font-size: 0.78rem;
      font-weight: 700;
      background: #fff;
      color: #546e7a;
      border: 2px solid #e53935;
      border-radius: 7px;
      text-decoration: none;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }}
  </style>
</head>
<body>
  <div class="page-wrap">
  <header>
    <div class="hd-text">
      <h1>今日の{escape(REGION_NAME)}ニュース</h1>
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

  <!-- 下部バー：地図へ戻る＋読者の情報提供フォームへの入口 -->
  <div class="bottom-bar">
    <a href="../index.html" class="bottom-map-btn">地図</a>
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfVfV2ZNg6X9ub5qMNSvmFoCJBHf4rbYV1AOuMOBG6pNAvrcA/viewform" class="bottom-submit-btn">{escape(REGION_NAME)}の情報をお寄せください</a>
  </div>
  </div>
</body>
</html>'''

    os.makedirs(NEWS_OUTPUT_DIR, exist_ok=True)
    index_path = os.path.join(NEWS_OUTPUT_DIR, 'index.html')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"\n[OK] {index_path} を生成しました（{len(articles)}件）")

    # JSON も保存（将来の活用のため）
    data = {
        'regionId': REGION['id'],
        'regionName': REGION_NAME,
        'date':     today_date,
        'updated':  now_jst.isoformat(),
        'count':    len(articles),
        'articles': articles,
    }
    today_path = os.path.join(NEWS_OUTPUT_DIR, 'today.json')
    with open(today_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] {today_path} を生成しました")


# ── エントリーポイント ─────────────────────────────────────────────
if __name__ == '__main__':
    print(f"=== {REGION_NAME} News Fetch Start: {today_date} ===\n")
    articles, candidates, source_results = fetch_articles()
    save_candidate_data(candidates, source_results)
    # 管理人投稿・承認済み読者投稿もニュース記事として合流させる
    # （本日の投稿があれば「ニュースはありません」の対象からも外れる）
    articles += fetch_admin_posts()
    articles += fetch_reader_posts()
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
