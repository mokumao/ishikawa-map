$ErrorActionPreference = "Stop"

$indexFile = Join-Path $PSScriptRoot "index.html"

if (-not (Test-Path -LiteralPath $indexFile -PathType Leaf)) {
    throw "石川マップのindex.htmlが見つかりません: $indexFile"
}

$nodeExecutable = $null
$profileCandidates = @([Environment]::GetFolderPath("UserProfile"))
$projectProfileMatch = [regex]::Match($PSScriptRoot, "^[A-Za-z]:\\Users\\[^\\]+")
if ($projectProfileMatch.Success) {
    $profileCandidates += $projectProfileMatch.Value
}

foreach ($profileCandidate in ($profileCandidates | Select-Object -Unique)) {
    $codexNode = Join-Path $profileCandidate ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (Test-Path -LiteralPath $codexNode -PathType Leaf) {
        $nodeExecutable = $codexNode
        break
    }
}

if (-not $nodeExecutable) {
    $nodeExecutable = (Get-Command node -ErrorAction Stop).Source
}

Write-Host "正式なプロジェクトからローカルプレビューを起動します。"
Write-Host "プロジェクト: $PSScriptRoot"

Push-Location -LiteralPath $PSScriptRoot
try {
    & $nodeExecutable ".\scripts\serve-local.mjs" 3456
}
finally {
    Pop-Location
}
