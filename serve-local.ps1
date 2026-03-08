param(
  [int]$Port = 8000,
  [switch]$NoOpen
)

# このスクリプトの場所を基準に docs の絶対パスを作る。
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$docsDir = Join-Path $projectRoot "docs"

# docs が無ければ異常終了する。
if (-not (Test-Path $docsDir)) {
  Write-Error "docs directory not found: $docsDir"
  exit 1
}

# 利用可能な Python 実行コマンド（python / py）を判定する。
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
  $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $pythonCmd = "py"
}

# Python が見つからなければ異常終了する。
if (-not $pythonCmd) {
  Write-Error "Python was not found. Install Python 3 or run another local HTTP server for docs/."
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host "Serving docs at $url"
Write-Host "Press Ctrl+C to stop."

# -NoOpen が無ければ既定ブラウザを開く。
if (-not $NoOpen) {
  Start-Process $url
}

# docs をローカルHTTP配信する。
if ($pythonCmd -eq "py") {
  & py -m http.server $Port -d $docsDir
} else {
  & python -m http.server $Port -d $docsDir
}
