# script.js / style.css / restaurants-data.js が編集されたとき
# index.html の ?v= を現在の日時に自動更新するスクリプト

$json = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $json.tool_input.file_path

function Test-PathInsideProject {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ProjectRoot
    )

    $fullPath = [IO.Path]::GetFullPath($Path)
    $fullRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $rootPrefix = $fullRoot + [IO.Path]::DirectorySeparatorChar

    return $fullPath.Equals($fullRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
}

$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$editedPath = if ([IO.Path]::IsPathRooted($file)) {
    [IO.Path]::GetFullPath($file)
} else {
    [IO.Path]::GetFullPath((Join-Path $projectRoot $file))
}

$editedFileName = [IO.Path]::GetFileName($editedPath)
$versionedFiles = @('script.js', 'style.css', 'restaurants-data.js')

if ((Test-PathInsideProject -Path $editedPath -ProjectRoot $projectRoot) -and
    $editedFileName -in $versionedFiles) {
    $v   = [datetime]::Now.ToString('yyyyMMddHHmm')
    $idx = [IO.Path]::GetFullPath((Join-Path $projectRoot 'index.html'))

    if (-not (Test-PathInsideProject -Path $idx -ProjectRoot $projectRoot)) {
        throw "更新対象がプロジェクト外です: $idx"
    }
    if (-not [IO.File]::Exists($idx)) {
        throw "更新対象のindex.htmlが見つかりません: $idx"
    }

    $idxItem = Get-Item -LiteralPath $idx -Force
    if (($idxItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "更新対象のindex.htmlがリンクです。安全のため更新を中止します: $idx"
    }

    $text = [IO.File]::ReadAllText($idx, [Text.Encoding]::UTF8)

    # ?v=数字 をすべて新しいバージョンに置換
    $text = [regex]::Replace(
        $text,
        '(script\.js|style\.css|restaurants-data\.js)\?v=\d+',
        { param($m) $m.Groups[1].Value + '?v=' + $v }
    )

    [IO.File]::WriteAllText($idx, $text, [Text.Encoding]::UTF8)
}
