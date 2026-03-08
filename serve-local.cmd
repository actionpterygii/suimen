@echo off
setlocal

rem Resolve docs path relative to this batch file.
set "ROOT=%~dp0"
set "DOCS=%ROOT%docs"
set "PORT=%~1"

rem Use port 8000 when no port argument is provided.
if "%PORT%"=="" set "PORT=8000"

rem Check whether python command exists (stdout/stderr suppressed).
where python >nul 2>nul
if %errorlevel%==0 (
  rem Open browser and serve docs over HTTP.
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  python -m http.server %PORT% -d "%DOCS%"
  rem Return the http.server process exit code.
  exit /b %errorlevel%
)

rem Fallback to py launcher if python is unavailable.
where py >nul 2>nul
if %errorlevel%==0 (
  rem Open browser and serve docs over HTTP.
  start "" "http://localhost:%PORT%/"
  echo Serving docs at http://localhost:%PORT%/
  echo Press Ctrl+C to stop.
  py -m http.server %PORT% -d "%DOCS%"
  rem Return the http.server process exit code.
  exit /b %errorlevel%
)

echo Python was not found. Install Python 3 and retry.
rem Return non-zero code for missing Python.
exit /b 1
