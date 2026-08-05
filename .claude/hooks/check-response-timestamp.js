// Stop hook: CLAUDE.md「応答フォーマット」ルール（返答末尾に実際のシステム時刻を
// 記載する）を、Claudeの記憶ではなくこのスクリプトが機械的に検証する。
// 末尾の日時が無い/大きくズレている場合は decision:"block" で停止を拒否し、
// 正しい現在時刻を reason に含めて突き返す（Claudeはその値をそのまま書けばよい）。
//
// stdin: Stop hookの入力JSON（session_id, transcript_path, stop_hook_active 等）
// stdout: 何もしない場合は空（continue扱い）。ブロックする場合のみJSONを出力する。

const fs = require('fs');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch (e) {
    return; // 入力が壊れていたら何もしない（fail open）
  }

  // ブロックによる再スタート時は無限ループ防止のため必ず通す
  if (input.stop_hook_active === true || input.stopHookActive === true) return;

  const transcriptPath = input.transcript_path || input.transcriptPath;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  } catch (e) {
    return;
  }

  // 最後の assistant メッセージを後ろから探す
  let lastAssistantText = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch (e) {
      continue;
    }
    if (obj.type !== 'assistant') continue;
    const content = obj.message && obj.message.content;
    if (!Array.isArray(content)) continue;
    const textBlocks = content.filter((c) => c && c.type === 'text' && typeof c.text === 'string');
    if (textBlocks.length === 0) continue; // tool_useのみのメッセージはスキップして続行
    lastAssistantText = textBlocks[textBlocks.length - 1].text;
    break;
  }

  if (lastAssistantText === null) return; // 最終テキストが見つからない場合は判定しない

  const trimmed = lastAssistantText.replace(/\s+$/, '');
  const textLines = trimmed.split('\n');
  const lastLine = (textLines[textLines.length - 1] || '').trim();
  const m = lastLine.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (!m) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `CLAUDE.mdの応答フォーマットルール違反：返答の末尾に「YYYY-MM-DD HH:MM」形式の日時がありません。実際の現在時刻は「${nowStr}」です。この正確な値を返答の末尾に「---」の次の行として追記してください（推測・計算は禁止。必要ならdateコマンドで再確認してよいですが、この値自体は既に実システム時刻から取得済みです）。`,
    }));
    return;
  }

  const [, y, mo, d, h, mi] = m.map(Number);
  const stated = new Date(y, mo - 1, d, h, mi);
  const diffMin = Math.abs(now.getTime() - stated.getTime()) / 60000;

  if (diffMin > 10) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `CLAUDE.mdの応答フォーマットルール違反：返答末尾の日時「${lastLine}」が実際の現在時刻「${nowStr}」と${Math.round(diffMin)}分ずれています（推測・加算で書かれた可能性があります）。末尾の日時を「${nowStr}」に修正してください。`,
    }));
    return;
  }
  // 差が10分以内なら問題なし。何も出力せず終了（stopを許可）。
}

main();
