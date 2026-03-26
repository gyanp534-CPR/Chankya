Param(
  [string]$RepoRoot = "."
)

$gitDir = Join-Path $RepoRoot ".git"
if (-not (Test-Path $gitDir)) {
  Write-Error "No .git directory found at $gitDir. Run from repo root."
  exit 1
}

$hooksDir = Join-Path $gitDir "hooks"
if (-not (Test-Path $hooksDir)) {
  New-Item -ItemType Directory -Path $hooksDir | Out-Null
}

$hookPath = Join-Path $hooksDir "pre-commit"
$hookContent = @'
#!/bin/sh
powershell -ExecutionPolicy Bypass -File ./scripts/update-doc-dates.ps1
'@

Set-Content -Path $hookPath -Value $hookContent -Encoding UTF8

# Ensure executable flag on Unix environments (no-op on Windows)
try { icacls $hookPath /grant *S-1-1-0:(RX) | Out-Null } catch { }

Write-Host "Installed pre-commit hook: $hookPath"
