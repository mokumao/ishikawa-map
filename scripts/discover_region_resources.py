#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""二つの探索ルートから、公開画面に掲載しない地域資源候補を生成する。"""

import argparse
import calendar
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import feedparser

from region_news_config import build_resource_discovery_sources, load_region_profile


UTC = timezone.utc
MANUAL_STATUSES = {'verified', 'rejected'}


def normalize_text(value):
    value = unescape(re.sub(r'<[^>]+>', ' ', value or ''))
    return re.sub(r'\s+', ' ', value).strip()


def canonical_url(url):
    parts = urlsplit(url or '')
    query = [
        (key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith('utm_')
    ]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path,
                       urlencode(query), ''))


def entry_datetime(entry):
    parsed = entry.get('published_parsed') or entry.get('updated_parsed')
    if not parsed:
        return None
    return datetime.fromtimestamp(calendar.timegm(parsed), tz=UTC)


def matching_resources(text, profile):
    matched = []
    for facility in profile['verifiedFacilities']:
        if any(alias and alias in text for alias in facility.get('aliases', [])):
            matched.append(f'facility:{facility["id"]}')
    for theme in profile['regionalThemes']:
        if any(term and term in text for term in theme.get('terms', [])):
            matched.append(f'theme:{theme["id"]}')
    return list(dict.fromkeys(matched))


def regional_evidence(text, profile):
    evidence = []
    for phrase in profile['exactRegionPhrases']:
        if phrase and phrase in text:
            evidence.append(f'地域表記:{phrase}')
    if profile['municipality'] in text and profile['displayName'] in text:
        evidence.append(f'自治体と地区:{profile["municipality"]}+{profile["displayName"]}')
    district = next((term for term in profile['districtTerms'] if term in text), None)
    context = next((term for term in profile['contextTerms'] if term in text), None)
    if district and context:
        evidence.append(f'地区と文脈:{district}+{context}')
    return list(dict.fromkeys(evidence))


def candidate_id(title, url):
    raw = f'{normalize_text(title).lower()}\n{canonical_url(url)}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]


def build_candidate(entry, source, profile, checked_at=None):
    checked_at = checked_at or datetime.now(UTC)
    title = normalize_text(entry.get('title', ''))
    summary = normalize_text(entry.get('summary', entry.get('description', '')))[:300]
    url = canonical_url(entry.get('link', ''))
    text = f'{title} {summary}'
    false_matches = [
        term for term in profile['falsePositiveRegions'] + profile['falsePositivePeople']
        if term and term in text
    ]
    matched = matching_resources(text, profile)
    evidence = regional_evidence(text, profile)
    facility_match = any(item.startswith('facility:') for item in matched)

    if false_matches:
        status = 'excluded'
        reason = '誤一致語: ' + '、'.join(false_matches)
    elif evidence or facility_match:
        status = 'known' if matched else 'candidate'
        reason = ''
        if facility_match and not evidence:
            evidence.append('確認済み施設の固有名')
    else:
        status = 'excluded'
        reason = '石川地区との地域根拠不足'

    published = entry_datetime(entry)
    return {
        'id': candidate_id(title, url),
        'regionId': profile['id'],
        'title': title,
        'summary': summary,
        'url': url,
        'publishedAt': published.isoformat() if published else None,
        'discoveredAt': checked_at.isoformat(),
        'checkedAt': checked_at.isoformat(),
        'discoveryRoutes': [source['discoveryRoute']],
        'discoveryCategories': [source['discoveryCategory']],
        'sources': [{'id': source['id'], 'name': source['name']}],
        'localEvidence': evidence,
        'matchedResources': matched,
        'status': status,
        'exclusionReason': reason or None,
    }


def candidate_key(candidate):
    if candidate['url']:
        return 'url:' + candidate['url']
    title = re.sub(r'[\W_]+', '', candidate['title'].lower())
    return 'title:' + title


def merge_candidates(candidates):
    merged = {}
    title_keys = {}
    for candidate in candidates:
        key = candidate_key(candidate)
        title_key = re.sub(r'[\W_]+', '', candidate['title'].lower())
        if title_key and title_key in title_keys:
            key = title_keys[title_key]
        if key not in merged:
            merged[key] = candidate
            if title_key:
                title_keys[title_key] = key
            continue
        current = merged[key]
        for field in ('discoveryRoutes', 'discoveryCategories', 'localEvidence',
                      'matchedResources'):
            current[field] = list(dict.fromkeys(current[field] + candidate[field]))
        source_ids = {item['id'] for item in current['sources']}
        current['sources'].extend(
            item for item in candidate['sources'] if item['id'] not in source_ids
        )
        if current['status'] == 'excluded' and candidate['status'] != 'excluded':
            current['status'] = candidate['status']
            current['exclusionReason'] = candidate['exclusionReason']
    return list(merged.values())


def preserve_manual_decisions(candidates, previous):
    saved = {item.get('id'): item for item in previous.get('candidates', [])}
    for candidate in candidates:
        old = saved.get(candidate['id'], {})
        if old.get('status') in MANUAL_STATUSES:
            candidate['status'] = old['status']
            candidate['reviewNote'] = old.get('reviewNote', '')
            candidate['reviewedAt'] = old.get('reviewedAt')


def registered_resources(profile):
    facilities = [
        {'type': 'facility', 'id': item['id'], 'name': item['name'],
         'aliases': item.get('aliases', [])}
        for item in profile['verifiedFacilities']
    ]
    themes = [
        {'type': 'theme', 'id': item['id'], 'name': item['label'],
         'terms': item.get('terms', [])}
        for item in profile['regionalThemes']
    ]
    return facilities + themes


def collect(profile, checked_at=None):
    checked_at = checked_at or datetime.now(UTC)
    oldest = checked_at - timedelta(days=profile['resourceDiscovery']['lookbackDays'])
    candidates = []
    source_results = []
    for source in build_resource_discovery_sources(profile):
        try:
            feed = feedparser.parse(source['url'])
            entries = list(getattr(feed, 'entries', []))[:source['maxEntries']]
            kept = 0
            for entry in entries:
                published = entry_datetime(entry)
                if published and published < oldest:
                    continue
                candidates.append(build_candidate(entry, source, profile, checked_at))
                kept += 1
            source_results.append({
                'id': source['id'], 'route': source['discoveryRoute'],
                'category': source['discoveryCategory'], 'fetched': len(entries),
                'kept': kept, 'error': None,
            })
        except Exception as exc:
            source_results.append({
                'id': source['id'], 'route': source['discoveryRoute'],
                'category': source['discoveryCategory'], 'fetched': 0,
                'kept': 0, 'error': str(exc),
            })
    return merge_candidates(candidates), source_results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--region', default=None)
    parser.add_argument('--output', default=None)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    profile = load_region_profile(args.region, root)
    output = Path(args.output) if args.output else root / profile['outputDir'] / 'resource-candidates.json'
    previous = {}
    if output.exists():
        with output.open(encoding='utf-8') as stream:
            previous = json.load(stream)
    checked_at = datetime.now(UTC)
    candidates, source_results = collect(profile, checked_at)
    preserve_manual_decisions(candidates, previous)
    candidates.sort(key=lambda item: (item['status'] == 'excluded', item['publishedAt'] or ''), reverse=False)
    counts = {}
    for item in candidates:
        counts[item['status']] = counts.get(item['status'], 0) + 1
    document = {
        'schemaVersion': 1,
        'regionId': profile['id'],
        'regionName': profile['displayName'],
        'updatedAt': checked_at.isoformat(),
        'purpose': '公開画面に掲載しない地域資源発見記録。公開ニュースではありません。',
        'statusCounts': counts,
        'sourceResults': source_results,
        'registeredResources': registered_resources(profile),
        'candidates': candidates,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', encoding='utf-8', newline='\n') as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(f'地域資源候補を保存: {output} / {len(candidates)}件 / {counts}')


if __name__ == '__main__':
    main()
