Param(
  [string]$RepoRoot = "."
)

$today = Get-Date -Format "yyyy-MM-dd"
$pattern = "Last updated: \\d{4}-\\d{2}-\\d{2}"

$exclude = @("node_modules", ".venv", ".venv-ocr", "dist")

$files = New-Object System.Collections.Generic.List[string]
$stack = New-Object System.Collections.Generic.Stack[string]
$stack.Push((Resolve-Path $RepoRoot).Path)

while ($stack.Count -gt 0) {
  $current = $stack.Pop()
  $name = Split-Path $current -Leaf
  if ($exclude -contains $name) { continue }

  Get-ChildItem -Path $current -File -Filter *.md -ErrorAction SilentlyContinue |
    ForEach-Object { $files.Add($_.FullName) }

  Get-ChildItem -Path $current -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { $stack.Push($_.FullName) }
}

$files = $files | Sort-Object -Unique

foreach ($file in $files) {
  $content = Get-Content $file -Raw
  if ($content -match $pattern) {
    $content = [regex]::Replace($content, $pattern, "Last updated: $today")
  } else {
    $content = $content.TrimEnd() + "`r`n`r`nLast updated: $today`r`n"
  }
  Set-Content -Path $file -Value $content -Encoding UTF8
}
