@echo off
setlocal

rem このバッチの場所を基準に docs のパスを作る。
set "ROOT=%~dp0"
set "DOCS=%ROOT%docs"
set "PORT=%~1"

rem ポート未指定時は 8000 を使う。
if "%PORT%"=="" set "PORT=8000"

rem python コマンドの存在を確認する（出力は捨てる）。
where python >nul 2>nul
if %errorlevel%==0 (
  rem ブラウザを開いて docs をHTTP配信する。
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  python -m http.server %PORT% -d "%DOCS%"
  rem http.server の終了コードを返す。
  exit /b %errorlevel%
)

rem python が無ければ py ランチャーを確認する。
where py >nul 2>nul
if %errorlevel%==0 (
  rem ブラウザを開いて docs をHTTP配信する。
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  py -m http.server %PORT% -d "%DOCS%"
  rem http.server の終了コードを返す。
  exit /b %errorlevel%
)

echo Python was not found. Install Python 3 and retry.
rem Python 未導入なので非0で終了する。
exit /b 1
