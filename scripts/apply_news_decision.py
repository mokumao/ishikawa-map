#!/usr/bin/env python3
"""所有者が作成したGitHub Issueからニュース候補の判断を保存する。"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
ID_PATTERN = re.compile(r'^候補ID:\s*([A-Za-z0-9._-]+)\s*$', re.MULTILINE)
DECISION_PATTERN = re.compile(r'^判断:\s*(掲載|除外)\s*$', re.MULTILINE)


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: apply_news_decision.py ISSUE_BODY CANDIDATES DECISIONS')
    body_path, candidates_path, decisions_path = map(Path, sys.argv[1:])
    body = body_path.read_text(encoding='utf-8')
    id_match = ID_PATTERN.search(body)
    decision_match = DECISION_PATTERN.search(body)
    if not id_match or not decision_match:
        raise SystemExit('候補IDまたは判断（掲載・除外）を確認できません')
    candidate_id = id_match.group(1)
    candidates = json.loads(candidates_path.read_text(encoding='utf-8'))
    candidate = next(
        (item for item in candidates.get('candidates', []) if item.get('id') == candidate_id),
        None,
    )
    if candidate is None:
        raise SystemExit('指定された候補IDは現在の監査記録にありません')
    if candidate.get('status') != 'review':
        raise SystemExit('指定された候補は現在、判断保留ではありません')
    data = json.loads(decisions_path.read_text(encoding='utf-8'))
    decisions = [item for item in data.get('decisions', []) if item.get('candidateId') != candidate_id]
    decisions.append({
        'candidateId': candidate_id,
        'decision': 'publish' if decision_match.group(1) == '掲載' else 'reject',
        'decidedAt': datetime.now(JST).isoformat(timespec='seconds'),
        'source': 'github-owner-confirmation',
    })
    data['decisions'] = decisions
    decisions_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
