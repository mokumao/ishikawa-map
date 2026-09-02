#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""地域ニュース設定の読み込みと、共通探索フィードの組み立て。"""

import json
import os
from pathlib import Path
from urllib.parse import quote


REQUIRED_DISCOVERY_CATEGORIES = {
    'government', 'events-culture', 'public-facilities', 'education',
    'safety', 'health-welfare', 'transport-construction',
    'business-community',
}


def load_region_profile(region_id=None, repository_root=None):
    """NEWS_REGION（既定: ishikawa）に対応する設定を検証して返す。"""
    region_id = region_id or os.environ.get('NEWS_REGION', 'ishikawa')
    root = Path(repository_root or Path(__file__).resolve().parents[1])
    path = root / 'config' / 'news-regions' / f'{region_id}.json'
    if not path.exists():
        raise ValueError(f'地域ニュース設定が見つかりません: {path}')
    with path.open(encoding='utf-8') as stream:
        profile = json.load(stream)
    validate_region_profile(profile)
    profile['_path'] = str(path)
    return profile


def validate_region_profile(profile):
    required = (
        'schemaVersion', 'id', 'displayName', 'municipality', 'prefecture',
        'searchPhrase', 'outputDir', 'exactRegionPhrases', 'districtTerms',
        'contextTerms', 'verifiedFacilities', 'falsePositiveRegions',
        'falsePositivePeople', 'discoveryCategories', 'regionalThemes', 'rssSources',
        'officialAdapters',
    )
    missing = [key for key in required if key not in profile]
    if missing:
        raise ValueError(f'地域ニュース設定の必須項目が不足: {", ".join(missing)}')
    if profile['schemaVersion'] != 1:
        raise ValueError('未対応の地域ニュース設定schemaVersionです')
    if not profile['exactRegionPhrases'] or not profile['districtTerms']:
        raise ValueError('地域名と地区語を1件以上登録してください')
    category_ids = {item.get('id') for item in profile['discoveryCategories']}
    missing_categories = sorted(REQUIRED_DISCOVERY_CATEGORIES - category_ids)
    if missing_categories:
        raise ValueError(
            '共通探索カテゴリが不足: ' + ', '.join(missing_categories)
        )
    facility_ids = [item.get('id') for item in profile['verifiedFacilities']]
    if None in facility_ids or len(facility_ids) != len(set(facility_ids)):
        raise ValueError('確認済み施設のidは必須かつ重複不可です')
    theme_ids = [item.get('id') for item in profile['regionalThemes']]
    if None in theme_ids or len(theme_ids) != len(set(theme_ids)):
        raise ValueError('地域固有テーマのidは必須かつ重複不可です')
    if any(not item.get('terms') for item in profile['regionalThemes']):
        raise ValueError('地域固有テーマには検索語が必要です')


def google_news_url(query):
    return (
        'https://news.google.com/rss/search?q='
        f'{quote(query)}&hl=ja&gl=JP&ceid=JP:ja'
    )


def build_rss_sources(profile):
    """固定取得先と、地域共通の分野別探索先をRSS設定へ変換する。"""
    sources = []
    for item in profile['rssSources']:
        source = dict(item)
        query = source.pop('query', None)
        if query:
            source['url'] = google_news_url(query)
        sources.append(source)

    configured_facility_ids = {
        item.get('facilityId') for item in sources if item.get('facilityId')
    }
    for facility in profile['verifiedFacilities']:
        if facility['id'] in configured_facility_ids:
            continue
        terms = ' OR '.join(facility['aliases'])
        sources.append({
            'id': f'region-facility-{profile["id"]}-{facility["id"]}',
            'name': f'{profile["displayName"]}施設：{facility["name"]}',
            'url': google_news_url(f'({terms}) {profile["prefecture"]}'),
            'type': 'discovery',
            'trust': 60,
            'method': 'google-news',
            'facilityId': facility['id'],
            'facilityAliases': facility['aliases'],
            'maxEntries': 15,
        })

    for theme in profile['regionalThemes']:
        terms = ' OR '.join(theme['terms'])
        sources.append({
            'id': f'region-theme-{profile["id"]}-{theme["id"]}',
            'name': f'{profile["displayName"]}固有テーマ：{theme["label"]}',
            'url': google_news_url(
                f'"{profile["searchPhrase"]}" ({terms})'
            ),
            'type': 'discovery',
            'trust': 60,
            'method': 'google-news',
            'filter_strict': True,
            'maxEntries': theme.get('maxEntries', 20),
            'regionalTheme': theme['id'],
        })

    for category in profile['discoveryCategories']:
        terms = ' OR '.join(category['terms'])
        query = f'"{profile["searchPhrase"]}" ({terms})'
        sources.append({
            'id': f'region-discovery-{profile["id"]}-{category["id"]}',
            'name': f'{profile["displayName"]}：{category["label"]}',
            'url': google_news_url(query),
            'type': 'discovery',
            'trust': 60,
            'method': 'google-news',
            'filter_strict': True,
            'maxEntries': category.get('maxEntries', 15),
            'discoveryCategory': category['id'],
        })
    return sources


def facility_aliases(profile):
    aliases = []
    for facility in profile['verifiedFacilities']:
        aliases.extend(facility.get('aliases', []))
    return list(dict.fromkeys(aliases))
