#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""地域ニュース設定を単独で検査する。"""

import sys

from region_news_config import build_rss_sources, load_region_profile


def main():
    region_id = sys.argv[1] if len(sys.argv) > 1 else None
    profile = load_region_profile(region_id)
    sources = build_rss_sources(profile)
    print(
        f'OK: {profile["displayName"]} / '
        f'探索カテゴリ {len(profile["discoveryCategories"])} / '
        f'RSS取得先 {len(sources)} / '
        f'確認済み施設 {len(profile["verifiedFacilities"])}'
    )


if __name__ == '__main__':
    main()
