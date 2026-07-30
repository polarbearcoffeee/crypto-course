[CmdletBinding()]
param(
    [string]$OutputPath = "docs/infrastructure/baseline-manifest.json",
    [string]$CurriculumIdentifier = "ta_content/curriculum",
    [string]$SettingsIdentifier = "ta_settings/app",
    [string]$LearnerIdentifier = "ta_students",
    [string]$CurriculumBackupIdentifier = "PENDING_AUTHORIZED_EXPORT",
    [string]$SettingsBackupIdentifier = "PENDING_AUTHORIZED_EXPORT",
    [string]$LearnerBackupIdentifier = "PENDING_AUTHORIZED_EXPORT",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-GitValue {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $value = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }

    return ($value | Out-String).Trim()
}

$repositoryRoot = Invoke-GitValue -Arguments @("rev-parse", "--show-toplevel")
$commit = Invoke-GitValue -Arguments @("rev-parse", "HEAD")
$tree = Invoke-GitValue -Arguments @("rev-parse", "HEAD^{tree}")
$branch = Invoke-GitValue -Arguments @("branch", "--show-current")
$isDirty = [bool](Invoke-GitValue -Arguments @("status", "--porcelain"))

$manifest = [ordered]@{
    schemaVersion = 1
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString("o")
    repository = [ordered]@{
        branch = $branch
        commit = $commit
        tree = $tree
        dirty = $isDirty
    }
    sources = [ordered]@{
        curriculum = [ordered]@{
            identifier = $CurriculumIdentifier
            backupIdentifier = $CurriculumBackupIdentifier
        }
        settings = [ordered]@{
            identifier = $SettingsIdentifier
            backupIdentifier = $SettingsBackupIdentifier
        }
        learners = [ordered]@{
            identifier = $LearnerIdentifier
            backupIdentifier = $LearnerBackupIdentifier
        }
    }
    safeguards = [ordered]@{
        containsCredentials = $false
        containsLearnerRecords = $false
        note = "Metadata identifiers only; backups remain outside Git."
    }
}

$json = $manifest | ConvertTo-Json -Depth 5

if ($DryRun) {
    Write-Output $json
    return
}

$resolvedOutputPath = if ([IO.Path]::IsPathRooted($OutputPath)) {
    [IO.Path]::GetFullPath($OutputPath)
} else {
    [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputPath))
}

$outputDirectory = Split-Path -Parent $resolvedOutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$json | Set-Content -LiteralPath $resolvedOutputPath -Encoding utf8
Write-Output "Baseline manifest written: $resolvedOutputPath"
