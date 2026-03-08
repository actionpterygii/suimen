@echo off
setlocal

set "ROOT=%~dp0"
set "DOCS=%ROOT%docs"
set "PORT=%~1"

if "%PORT%"=="" set "PORT=8000"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  python -m http.server %PORT% -d "%DOCS%"
  exit /b %errorlevel%
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  py -m http.server %PORT% -d "%DOCS%"
  exit /b %errorlevel%
)

echo Python was not found. Install Python 3 and retry.
exit /b 1
