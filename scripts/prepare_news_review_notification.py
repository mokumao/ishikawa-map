#!/usr/bin/env python3
"""前回から新たに判断保留になった候補をGitHub Issue用Markdownへまとめる。"""

import json
import sys
from pathlib import Path


def load_reviews(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return {
        item['id']: item
        for item in data.get('candidates', [])
        if item.get('id') and item.get('status') == 'review'
    }


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: prepare_news_review_notification.py OLD NEW OUTPUT')
    old = load_reviews(sys.argv[1])
    current = load_reviews(sys.argv[2])
    new_items = [item for candidate_id, item in current.items() if candidate_id not in old]
    output = Path(sys.argv[3])
    if not new_items:
        output.write_text('', encoding='utf-8')
        return
    lines = [
        f'新しい判断保留が{len(new_items)}件あります。',
        '',
        '管理者ページで原典を確認し、「掲載する」または「除外する」を選択してください。',
        'https://mokumao.github.io/ishikawa-map/admin/#newsReview',
        '',
    ]
    for item in new_items:
        lines.extend([
            f'- {item.get("displayTitle") or item.get("title") or "名称不明"}',
            f'  - 候補ID: `{item["id"]}`',
            f'  - 理由: {"、".join(item.get("reviewReasons") or ["記録なし"])}',
        ])
    output.write_text('\n'.join(lines) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
