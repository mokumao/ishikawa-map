#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""地域ニュース設定を単独で検査する。"""

import sys

from region_news_config import (
    build_resource_discovery_sources,
    build_rss_sources,
    load_region_profile,
    load_resource_review,
)


def main():
    region_id = sys.argv[1] if len(sys.argv) > 1 else None
    profile = load_region_profile(region_id)
    sources = build_rss_sources(profile)
    resource_sources = build_resource_discovery_sources(profile)
    review = load_resource_review(profile)
    print(
        f'OK: {profile["displayName"]} / '
        f'探索カテゴリ {len(profile["discoveryCategories"])} / '
        f'RSS取得先 {len(sources)} / '
        f'地域資源探索先 {len(resource_sources)} / '
        f'確認済み施設 {len(profile["verifiedFacilities"])} / '
        f'資源確認結果 {len(review["decisions"]) if review else 0}'
    )


if __name__ == '__main__':
    main()
