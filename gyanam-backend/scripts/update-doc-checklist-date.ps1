Param(
  [string]$Path = ".\\docs\\DOC-UPDATE-CHECKLIST.md"
)

$fullPath = Resolve-Path $Path
$content = Get-Content $fullPath -Raw
$today = Get-Date -Format "yyyy-MM-dd"

$pattern = "Last updated: \\d{4}-\\d{2}-\\d{2}"
$replacement = "Last updated: $today"

if ($content -match $pattern) {
  $content = [regex]::Replace($content, $pattern, $replacement)
} else {
  $content = $content.TrimEnd() + "`r`n`r`nLast updated: $today`r`n"
}

Set-Content -Path $fullPath -Value $content -Encoding UTF8
