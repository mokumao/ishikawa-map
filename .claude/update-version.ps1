# script.js / style.css / restaurants-data.js が編集されたとき
# index.html の ?v= を現在の日時に自動更新するスクリプト

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $json.tool_input.file_path

if ($file -match '(script\.js|style\.css|restaurants-data\.js)$') {
    $v    = [datetime]::Now.ToString('yyyyMMddHHmm')
    $idx  = 'C:\Users\user\OneDrive\デスクトップ\Claude code関連\index.html'
    $text = [IO.File]::ReadAllText($idx, [Text.Encoding]::UTF8)

    # ?v=数字 をすべて新しいバージョンに置換
    $text = [regex]::Replace(
        $text,
        '(script\.js|style\.css|restaurants-data\.js)\?v=\d+',
        { param($m) $m.Groups[1].Value + '?v=' + $v }
    )

    [IO.File]::WriteAllText($idx, $text, [Text.Encoding]::UTF8)
}
