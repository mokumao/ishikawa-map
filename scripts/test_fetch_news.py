#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
from unittest.mock import patch
from datetime import datetime
import sys
import types

# Pure function tests do not fetch feeds; avoid requiring the Actions-only dependency.
sys.modules.setdefault('feedparser', types.SimpleNamespace(parse=None))
import fetch_news
import region_news_config


MEDIA_SOURCE = {
    'id': 'test-media',
    'name': 'テスト報道',
    'type': 'media',
    'trust': 80,
    'method': 'google-news',
}

BIOS_SOURCE = {
    'id': 'google-news-bios-hill',
    'name': 'ビオスの丘',
    'type': 'discovery',
    'trust': 60,
    'method': 'google-news',
    'facilityId': 'bios-hill',
    'facilityAliases': ['ビオスの丘'],
}

def candidate(title, source, minute=0):
    published = datetime(2026, 9, 1, 9, minute, tzinfo=fetch_news.JST)
    return fetch_news.build_candidate(
        title,
        title,
        f'https://example.test/{minute}/{abs(hash(title))}',
        source,
        published,
    )


class NewsAutomationTests(unittest.TestCase):
    def test_ishikawa_profile_covers_common_discovery_categories(self):
        profile = region_news_config.load_region_profile('ishikawa')
        category_ids = {
            item['id'] for item in profile['discoveryCategories']
        }
        self.assertTrue(
            region_news_config.REQUIRED_DISCOVERY_CATEGORIES <= category_ids
        )
        sources = region_news_config.build_rss_sources(profile)
        source_ids = {item['id'] for item in sources}
        self.assertIn('google-news-ishikawa-dome', source_ids)
        self.assertIn('togyu-okinawa-blog', source_ids)
        self.assertIn('region-discovery-ishikawa-education', source_ids)
        self.assertIn(
            'region-facility-ishikawa-ishikawa-library', source_ids
        )
        self.assertIn('region-theme-ishikawa-bullfighting', source_ids)
        self.assertIn('bullfighting_schedule', profile['officialAdapters'])

    def test_bullfighting_blog_only_accepts_ishikawa_dome_entries(self):
        profile = region_news_config.load_region_profile('ishikawa')
        source = next(
            item for item in region_news_config.build_rss_sources(profile)
            if item['id'] == 'togyu-okinawa-blog'
        )
        self.assertTrue(fetch_news.source_entry_matches(
            source,
            '9月20日 闘牛カーニバル',
            '場所：うるま市石川多目的ドーム',
        ))
        self.assertFalse(fetch_news.source_entry_matches(
            source,
            '8月26日 山城ナイター闘牛大会',
            '場所：うるま市安慶名闘牛場',
        ))

    def test_bullfighting_blog_extracts_future_event_date(self):
        published = datetime(2026, 8, 28, 15, 9, tzinfo=fetch_news.JST)
        event_date = fetch_news.extract_event_date(
            '9月20日（日）闘牛カーニバル',
            '日時：2026年9月20日　場所：石川多目的ドーム',
            published,
        )
        self.assertEqual(event_date.date().isoformat(), '2026-09-20')

    def test_special_adapter_is_controlled_by_region_profile(self):
        profile = dict(fetch_news.REGION)
        profile['officialAdapters'] = []
        with patch.object(fetch_news, 'REGION', profile), patch.object(
            fetch_news, 'RSS_SOURCES', []
        ), patch.object(
            fetch_news, 'fetch_official_bullfighting_candidates'
        ) as bullfighting:
            fetch_news.fetch_articles()
        bullfighting.assert_not_called()

    def test_reviewed_resources_are_connected_to_daily_sources(self):
        profile = region_news_config.load_region_profile('ishikawa')
        sources = region_news_config.build_rss_sources(profile)
        source_ids = {item['id'] for item in sources}
        self.assertIn('region-facility-ishikawa-ishikawa-police-station', source_ids)
        self.assertIn('region-facility-ishikawa-ishikawa-water-treatment-plant', source_ids)
        self.assertIn('region-theme-ishikawa-ishikawa-mihoso-festival', source_ids)
        self.assertIn('region-theme-ishikawa-ishikawa-yam-imo', source_ids)

    def test_ambiguous_facility_requires_ishikawa_context(self):
        profile = region_news_config.load_region_profile('ishikawa')
        source = next(
            item for item in region_news_config.build_rss_sources(profile)
            if item['id'] == 'region-facility-ishikawa-rakujuen'
        )
        outside = candidate('静岡県三島市の楽寿園でイベント開催', source)
        local = candidate('うるま市石川嘉手苅の楽寿園で催しを開催', source, 1)
        self.assertNotEqual(outside['status'], 'published')
        self.assertEqual(local['status'], 'published')

    def test_verified_theme_can_publish_with_required_context(self):
        profile = region_news_config.load_region_profile('ishikawa')
        source = next(
            item for item in region_news_config.build_rss_sources(profile)
            if item['id'] == 'region-theme-ishikawa-yamashiro-tea'
        )
        local = candidate('沖縄・うるま市石川山城で山城茶の催し', source)
        outside = candidate('県外で山城茶を紹介', source, 1)
        self.assertEqual(local['status'], 'published')
        self.assertNotEqual(outside['status'], 'published')

    def test_bullfighting_page_link_and_dates_are_parsed(self):
        city_html = '''
        <p>更新日：2026年5月19日</p>
        <a href="https://www.lequio-tourist.okinawa/travel_03.php">開催日程</a>
        '''
        detail_html = '''
        <h2>観光闘牛 4月〜9月開催分</h2>
        <p>2026年 8月11日 / 9月21日</p>
        <h2>観光闘牛 10月〜3月開催分</h2>
        <p>2026年 10月17日 / 11月14日 / 12月27日</p>
        <p>2027年 1月23日 / 1月24日 / 2月20日 / 3月20日</p>
        <p>2027年 1月23日</p>
        '''
        self.assertEqual(
            fetch_news.extract_bullfighting_detail_url(city_html),
            'https://www.lequio-tourist.okinawa/travel_03.php',
        )
        updated = fetch_news.extract_official_page_updated_at(city_html)
        self.assertEqual(updated.date().isoformat(), '2026-05-19')
        dates = fetch_news.parse_bullfighting_event_dates(detail_html)
        self.assertEqual(
            [item.date().isoformat() for item in dates],
            [
                '2026-08-11', '2026-09-21', '2026-10-17', '2026-11-14',
                '2026-12-27', '2027-01-23', '2027-01-24', '2027-02-20',
                '2027-03-20',
            ],
        )

    def test_bullfighting_schedule_is_one_public_candidate(self):
        city_html = '''
        <p>更新日：2026年5月19日</p>
        <a href="https://www.lequio-tourist.okinawa/travel_03.php">開催日程</a>
        '''
        detail_html = '''
        <p>2026年 8月11日 / 9月21日 / 10月17日 / 11月14日 / 12月27日</p>
        <p>2027年 1月23日 / 1月24日 / 2月20日 / 3月20日</p>
        '''
        with patch.object(fetch_news, 'fetch_page', side_effect=[city_html, detail_html]):
            items, result = fetch_news.fetch_official_bullfighting_candidates({})
        self.assertEqual(result['entryCount'], 9)
        self.assertEqual(result['candidateCount'], 1)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['status'], 'published')
        self.assertEqual(items[0]['category'], 'event')
        self.assertEqual(items[0]['scheduleGroup'], 'tourist-bullfighting-calendar')
        self.assertEqual(items[0]['eventStartsAt'][:10], '2026-09-21')
        self.assertEqual(items[0]['eventEndsAt'][:10], '2027-03-20')
        public = fetch_news.candidate_to_article(items[0])
        self.assertEqual(public['pub_date'][:10], '2026-09-21')

    def test_gallery_numbers_have_same_event_title(self):
        first = '画像7 / 23＞沖縄のホテルを紹介 - ウォーカープラス'
        second = '画像21/23＞沖縄のホテルを紹介 - ウォーカープラス'
        self.assertEqual(
            fetch_news.normalized_event_title(first),
            fetch_news.normalized_event_title(second),
        )

    def test_gallery_is_published_once(self):
        base = ('うるま市石川の催しを紹介。'
                '地域イベントの魅力をレポート'
                ' - ウォーカープラス')
        items = [
            candidate(f'画像{number} / 23＞{base}', MEDIA_SOURCE, number)
            for number in (2, 7, 21)
        ]
        fetch_news.deduplicate_candidates(items)
        published = [item for item in items if item['status'] == 'published']
        duplicates = [item for item in items if item['status'] == 'duplicate']
        self.assertEqual(len(published), 1)
        self.assertEqual(len(duplicates), 2)
        self.assertEqual(published[0]['relatedCount'], 2)
        self.assertFalse(published[0]['displayTitle'].startswith('画像'))

    def test_same_facility_event_from_multiple_media_is_grouped(self):
        titles = [
            '沖縄・ビオスの丘を約1万輪のデンファレが彩る「らんの花祭り 秋」9月12日開幕 - PR TIMES',
            '写真：沖縄・ビオスの丘を約1万輪のデンファレが彩る「らんの花祭り 秋」9月12日開幕 - 沖縄タイムス社',
            'らんの花祭り・秋(沖縄県)の情報 - ウォーカープラス',
        ]
        items = [candidate(title, BIOS_SOURCE, index) for index, title in enumerate(titles)]
        fetch_news.deduplicate_candidates(items)
        self.assertEqual(sum(item['status'] == 'published' for item in items), 1)
        self.assertEqual(sum(item['status'] == 'duplicate' for item in items), 2)

    def test_three_way_classification(self):
        local = candidate('うるま石川山城でエイサーを開催', MEDIA_SOURCE)
        unrelated = candidate('石川県金沢市で企画展を開催', MEDIA_SOURCE, 1)
        ambiguous = candidate('秋の自然体験イベントを開催', BIOS_SOURCE, 2)
        sensitive = candidate('うるま市石川で交通事故', MEDIA_SOURCE, 3)
        self.assertEqual(local['status'], 'published')
        self.assertEqual(unrelated['status'], 'rejected')
        self.assertEqual(ambiguous['status'], 'review')
        self.assertEqual(sensitive['status'], 'review')


if __name__ == '__main__':
    unittest.main()
