param(
  [int]$Port = 8000,
  [switch]$NoOpen
)

# Resolve docs path relative to this script location.
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$docsDir = Join-Path $projectRoot "docs"

# Fail fast if docs directory does not exist.
if (-not (Test-Path $docsDir)) {
  Write-Error "docs directory not found: $docsDir"
  exit 1
}

# Detect available Python launcher command.
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
  $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $pythonCmd = "py"
}

# Abort when Python is not installed.
if (-not $pythonCmd) {
  Write-Error "Python was not found. Install Python 3 or run another local HTTP server for docs/."
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host "Serving docs at $url"
Write-Host "Press Ctrl+C to stop."

# Open default browser unless NoOpen is specified.
if (-not $NoOpen) {
  Start-Process $url
}

# Start Python HTTP server for docs.
if ($pythonCmd -eq "py") {
  & py -m http.server $Port -d $docsDir
} else {
  & python -m http.server $Port -d $docsDir
}
