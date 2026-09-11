[CmdletBinding()]
param(
    [switch]$Fetch
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & git -c core.excludesFile= @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($exitCode -ne 0) {
        throw ($output -join [Environment]::NewLine)
    }
    return @($output | ForEach-Object { $_.ToString() })
}

$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
Push-Location -LiteralPath $projectRoot
try {
    $inside = (Invoke-Git rev-parse --is-inside-work-tree | Select-Object -First 1).Trim()
    if ($inside -ne 'true') {
        throw 'Not inside a Git working tree.'
    }

    $branch = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()
    if (-not $branch) {
        throw 'Detached HEAD; sync mode cannot be determined automatically.'
    }

    $upstreamLines = Invoke-Git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
    $upstream = ($upstreamLines | Select-Object -First 1).Trim()

    if ($Fetch) {
        $remote = $upstream.Split('/', 2)[0]
        Write-Output "fetch: $remote"
        Invoke-Git fetch $remote | ForEach-Object { Write-Output $_ }
    }

    $statusLines = @(Invoke-Git status --porcelain=v1 --untracked-files=all)
    $tracked = @($statusLines | Where-Object { $_ -notmatch '^\?\?' })
    $untracked = @($statusLines | Where-Object { $_ -match '^\?\?' })

    $counts = ((Invoke-Git rev-list --left-right --count "HEAD...$upstream") | Select-Object -First 1).Trim() -split '\s+'
    if ($counts.Count -ne 2) {
        throw 'Could not determine ahead/behind counts.'
    }
    $ahead = [int]$counts[0]
    $behind = [int]$counts[1]

    Write-Output "branch: $branch"
    Write-Output "upstream: $upstream"
    Write-Output "tracked changes: $($tracked.Count)"
    Write-Output "untracked files: $($untracked.Count)"
    Write-Output "ahead: $ahead"
    Write-Output "behind: $behind"

    if ($statusLines.Count -gt 0) {
        Write-Output 'working tree changes:'
        $statusLines | ForEach-Object { Write-Output "  $_" }
    }

    if ($ahead -eq 0 -and $behind -eq 0) {
        Write-Output 'result: commit history is synchronized with upstream.'
    } elseif ($ahead -eq 0) {
        if ($statusLines.Count -eq 0) {
            Write-Output 'result: fast-forward pull candidate; confirm user intent before pulling.'
        } else {
            Write-Output 'result: upstream is ahead and the working tree is dirty; protect local changes before pulling.'
        }
    } elseif ($behind -eq 0) {
        Write-Output 'result: local commits are ahead; push only after validation and explicit user authorization.'
    } else {
        Write-Output 'result: history has diverged; inspect overlap and obtain integration authorization before pull/push.'
    }
} finally {
    Pop-Location
}
