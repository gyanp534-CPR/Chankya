param(
  [string]$JsonPath = "..\error-graph.v1.json",
  [string]$EdgesCsvPath = "..\csat.error.edges.v1.csv",
  [string]$NodesCsvPath = "..\csat.error.nodes.v1.csv",
  [double]$Tolerance = 0.0001
)

$base = $PSScriptRoot
if (-not $base) { $base = Get-Location }

function Resolve-RelativePath($path) {
  if ([System.IO.Path]::IsPathRooted($path)) { return $path }
  return (Join-Path -Path $base -ChildPath $path)
}

$fullJsonPath = Resolve-RelativePath $JsonPath
$fullEdgesPath = Resolve-RelativePath $EdgesCsvPath
$fullNodesPath = Resolve-RelativePath $NodesCsvPath

$data = Get-Content $fullJsonPath -Raw | ConvertFrom-Json

# Validation
$nodeSet = @{}
foreach ($p in $data.nodes.PSObject.Properties) { $nodeSet[$p.Name] = $true }

$invalidRefs = @()
$orphanNodes = New-Object System.Collections.Generic.HashSet[string]
foreach ($n in $nodeSet.Keys) { $orphanNodes.Add($n) | Out-Null }

foreach ($from in $data.edges.PSObject.Properties) {
  if (-not $nodeSet.ContainsKey($from.Name)) { $invalidRefs += "Edge source not in nodes: $($from.Name)"; continue }
  $orphanNodes.Remove($from.Name) | Out-Null
  $sum = 0.0
  foreach ($to in $from.Value.PSObject.Properties) {
    if (-not $nodeSet.ContainsKey($to.Name)) { $invalidRefs += "Edge target not in nodes: $($from.Name) -> $($to.Name)" }
    $sum += [double]$to.Value.weight
    $orphanNodes.Remove($to.Name) | Out-Null
  }
  if ([Math]::Abs($sum - 1.0) -gt $Tolerance) {
    $invalidRefs += "Outgoing weights from $($from.Name) sum to $sum (expected 1.0)"
  }
}

if ($invalidRefs.Count -gt 0) {
  Write-Error ("Validation failed:" + [Environment]::NewLine + ($invalidRefs -join [Environment]::NewLine))
  exit 1
}

# Nodes CSV
$nodeRows = @()
foreach ($p in $data.nodes.PSObject.Properties) {
  $nodeRows += [pscustomobject]@{
    error    = $p.Name
    weight   = [double]$p.Value.weight
    cluster  = $p.Value.cluster
    severity = $p.Value.severity
  }
}
$nodeRows | Sort-Object error | Export-Csv -Path $fullNodesPath -NoTypeInformation

# Edges CSV
$edgeRows = @()
foreach ($from in $data.edges.PSObject.Properties) {
  foreach ($to in $from.Value.PSObject.Properties) {
    $edgeRows += [pscustomobject]@{
      from_error = $from.Name
      to_error   = $to.Name
      weight     = [double]$to.Value.weight
      type       = $to.Value.type
    }
  }
}
$edgeRows | Sort-Object from_error, to_error | Export-Csv -Path $fullEdgesPath -NoTypeInformation
