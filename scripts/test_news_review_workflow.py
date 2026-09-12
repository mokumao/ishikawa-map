# -*- coding: utf-8 -*-

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parent


class NewsReviewWorkflowTests(unittest.TestCase):
    def test_notification_contains_only_new_review_candidates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_path = root / 'old.json'
            new_path = root / 'new.json'
            output_path = root / 'notification.md'
            old_path.write_text(json.dumps({'candidates': [
                {'id': 'old', 'title': '既存', 'status': 'review'}
            ]}), encoding='utf-8')
            new_path.write_text(json.dumps({'candidates': [
                {'id': 'old', 'title': '既存', 'status': 'review'},
                {'id': 'new', 'title': '新規候補', 'status': 'review', 'reviewReasons': ['日時確認']},
            ]}), encoding='utf-8')
            subprocess.run([
                sys.executable,
                str(SCRIPTS_DIR / 'prepare_news_review_notification.py'),
                str(old_path), str(new_path), str(output_path),
            ], check=True)
            text = output_path.read_text(encoding='utf-8')
            self.assertIn('新しい判断保留が1件', text)
            self.assertIn('新規候補', text)
            self.assertNotIn('既存', text)

    def test_owner_issue_decision_is_saved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            body_path = root / 'body.txt'
            candidates_path = root / 'candidates.json'
            decisions_path = root / 'decisions.json'
            body_path.write_text('候補ID: candidate-1\n判断: 掲載\n', encoding='utf-8')
            candidates_path.write_text(json.dumps({'candidates': [
                {'id': 'candidate-1', 'status': 'review'}
            ]}), encoding='utf-8')
            decisions_path.write_text(json.dumps({
                'regionId': 'ishikawa', 'decisions': []
            }), encoding='utf-8')
            subprocess.run([
                sys.executable,
                str(SCRIPTS_DIR / 'apply_news_decision.py'),
                str(body_path), str(candidates_path), str(decisions_path),
            ], check=True)
            saved = json.loads(decisions_path.read_text(encoding='utf-8'))
            self.assertEqual(saved['decisions'][0]['candidateId'], 'candidate-1')
            self.assertEqual(saved['decisions'][0]['decision'], 'publish')


if __name__ == '__main__':
    unittest.main()
