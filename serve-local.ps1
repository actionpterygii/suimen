param(
  [int]$Port = 8000,
  [switch]$NoOpen
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$docsDir = Join-Path $projectRoot "docs"

if (-not (Test-Path $docsDir)) {
  Write-Error "docs directory not found: $docsDir"
  exit 1
}

$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
  $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $pythonCmd = "py"
}

if (-not $pythonCmd) {
  Write-Error "Python was not found. Install Python 3 or run another local HTTP server for docs/."
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host "Serving docs at $url"
Write-Host "Press Ctrl+C to stop."

if (-not $NoOpen) {
  Start-Process $url
}

if ($pythonCmd -eq "py") {
  & py -m http.server $Port -d $docsDir
} else {
  & python -m http.server $Port -d $docsDir
}
