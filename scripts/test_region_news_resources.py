#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import types
import unittest

sys.modules.setdefault('feedparser', types.SimpleNamespace(parse=None))

import discover_region_resources as resources
import region_news_config


class RegionResourceDiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = region_news_config.load_region_profile('ishikawa')

    def source(self, route='characteristic', category='identity'):
        return {
            'id': f'test-{route}-{category}', 'name': 'テスト探索',
            'discoveryRoute': route, 'discoveryCategory': category,
        }

    def entry(self, title, link='https://example.test/item'):
        return {'title': title, 'summary': title, 'link': link}

    def test_sources_contain_both_equal_routes(self):
        sources = region_news_config.build_resource_discovery_sources(self.profile)
        routes = {item['discoveryRoute'] for item in sources}
        self.assertEqual(routes, {'characteristic', 'common'})
        self.assertEqual(
            len(sources),
            len(self.profile['resourceDiscovery']['characteristicCategories'])
            + len(self.profile['discoveryCategories']),
        )

    def test_verified_facility_and_theme_are_known(self):
        item = resources.build_candidate(
            self.entry('うるま市石川の石川多目的ドームで闘牛大会'),
            self.source(), self.profile,
        )
        self.assertEqual(item['status'], 'known')
        self.assertIn('facility:ishikawa-dome', item['matchedResources'])
        self.assertIn('theme:bullfighting', item['matchedResources'])

    def test_unregistered_local_resource_is_candidate(self):
        item = resources.build_candidate(
            self.entry('うるま市石川で新しい地域文化展を開催'),
            self.source(), self.profile,
        )
        self.assertEqual(item['status'], 'candidate')

    def test_false_positive_is_excluded(self):
        item = resources.build_candidate(
            self.entry('石川県金沢市の有名な祭りを紹介'),
            self.source(), self.profile,
        )
        self.assertEqual(item['status'], 'excluded')
        self.assertIn('石川県', item['exclusionReason'])

    def test_same_item_from_both_routes_is_merged(self):
        entry = self.entry('うるま市石川の文化祭を紹介')
        first = resources.build_candidate(entry, self.source(), self.profile)
        second = resources.build_candidate(
            entry, self.source('common', 'events-culture'), self.profile,
        )
        merged = resources.merge_candidates([first, second])
        self.assertEqual(len(merged), 1)
        self.assertEqual(set(merged[0]['discoveryRoutes']), {'characteristic', 'common'})

    def test_manual_decision_is_preserved(self):
        item = resources.build_candidate(
            self.entry('うるま市石川の地域資源'), self.source(), self.profile,
        )
        previous = {'candidates': [{
            'id': item['id'], 'status': 'verified', 'reviewNote': '公式確認済み',
            'reviewedAt': '2026-09-03T00:00:00+00:00',
        }]}
        resources.preserve_manual_decisions([item], previous)
        self.assertEqual(item['status'], 'verified')
        self.assertEqual(item['reviewNote'], '公式確認済み')


if __name__ == '__main__':
    unittest.main()
