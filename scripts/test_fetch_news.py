#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
from datetime import datetime
import sys
import types

# Pure function tests do not fetch feeds; avoid requiring the Actions-only dependency.
sys.modules.setdefault('feedparser', types.SimpleNamespace(parse=None))
import fetch_news


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

COCO_SOURCE = {
    'id': 'google-news-coco-garden',
    'name': 'ココガーデンリゾート沖縄',
    'type': 'discovery',
    'trust': 60,
    'method': 'google-news',
    'facilityId': 'coco-garden',
    'facilityAliases': ['ココ ガーデンリゾート オキナワ'],
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
    def test_gallery_numbers_have_same_event_title(self):
        first = '画像7 / 23＞沖縄のホテルを紹介 - ウォーカープラス'
        second = '画像21/23＞沖縄のホテルを紹介 - ウォーカープラス'
        self.assertEqual(
            fetch_news.normalized_event_title(first),
            fetch_news.normalized_event_title(second),
        )

    def test_gallery_is_published_once(self):
        base = ('沖縄のリゾートホテルで暮らすように泊まる。'
                '「ココ ガーデンリゾート オキナワ」の魅力をレポート'
                ' - ウォーカープラス')
        items = [
            candidate(f'画像{number} / 23＞{base}', COCO_SOURCE, number)
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
