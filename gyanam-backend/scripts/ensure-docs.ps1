Param(
  [string]$DocsPath = ".\\docs"
)

$required = @(
  @{ Path = ".\\docs\\API-REFERENCE.md"; Title = "API Reference"; Body = "This document will describe the public and internal API surface of the backend." },
  @{ Path = ".\\docs\\SECURITY.md"; Title = "Security"; Body = "This document will describe authentication, authorization, secrets handling, and data access controls." },
  @{ Path = ".\\docs\\OBSERVABILITY.md"; Title = "Observability"; Body = "This document will describe logging, tracing, metrics, and alerting." },
  @{ Path = ".\\docs\\DEPLOYMENT.md"; Title = "Deployment"; Body = "This document will describe deployment, environments, and required runtime configuration." },
  @{ Path = ".\\docs\\TESTING-GUIDE.md"; Title = "Testing Guide"; Body = "This document will describe test strategy, coverage, and how to run tests." },
  @{ Path = ".\\docs\\DATA-QUALITY.md"; Title = "Data Quality"; Body = "This document will describe validation, review states, and quality gates for PYQ data." },
  @{ Path = ".\\docs\\PROJECT-BRIEF.md"; Title = "Project Brief"; Body = "Short project brief and current status." },
  @{ Path = ".\\docs\\RELEASE-NOTES.md"; Title = "Release Notes"; Body = "Rolling release notes for the platform." }
)

foreach ($doc in $required) {
  if (-not (Test-Path $doc.Path)) {
    $content = @"
# $($doc.Title)

$($doc.Body)

## Status
- Placeholder created automatically.
"@
    Set-Content -Path $doc.Path -Value $content -Encoding UTF8
  }
}

# Update doc dates across all docs
powershell -ExecutionPolicy Bypass -File .\\scripts\\update-doc-dates.ps1
