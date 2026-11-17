@echo off
setlocal
title Huawei Router Dashboard
cd /d "%~dp0"

rem Opens the dashboard in a Chromium browser (Helium, Edge, Chrome, Brave or
rem Vivaldi) with this folder loaded as an extension. A private browser profile
rem is used, so nothing is added to the browser you normally use and there is
rem nothing to install by hand.

set "EXT=%~dp0extension"
set "PROFILE=%LOCALAPPDATA%\HuaweiDashboard\browser-profile"
set "PAGE=chrome-extension://poikgljiaddpghlncnenlhhfocckeibg/index.html"

if not exist "%EXT%\manifest.json" (
    echo  The "extension" folder is missing next to this file.
    echo  Keep this launcher in the project folder and try again.
    pause
    exit /b 1
)

set "BROWSER="
call :find "%LOCALAPPDATA%\imput\Helium\Application\chrome.exe"
call :find "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
call :find "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
call :find "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
call :find "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
call :find "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
call :find "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
call :find "%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe"

if not defined BROWSER (
    echo  A Chromium browser is needed and none was found.
    echo  Install Microsoft Edge, Google Chrome, Brave or Vivaldi, then run this again.
    pause
    exit /b 1
)

echo.
echo  Opening the dashboard...
echo.

rem Start the browser with no window so the extension is registered first, then
rem open the dashboard in the same profile. Opening it immediately races the
rem registration and lands on an error page.
start "" "%BROWSER%" --user-data-dir="%PROFILE%" --load-extension="%EXT%" --no-startup-window --no-first-run --no-default-browser-check
call :wait 5
start "" "%BROWSER%" --user-data-dir="%PROFILE%" "%PAGE%"

call :wait 5
rem A window whose title is the page's own title is the reliable signal that
rem the dashboard opened: the preferences file is written later, and an error
rem page would carry the extension URL as its title instead.
for %%A in ("%BROWSER%") do set "BROWSER_EXE=%%~nxA"
tasklist /v /fi "IMAGENAME eq %BROWSER_EXE%" /fo csv 2>nul | findstr /i /c:"Huawei router" >nul 2>&1
if errorlevel 1 (
    echo  The browser did not load the dashboard automatically.
    echo.
    echo  Install it once by hand, then use the toolbar button:
    echo    1. Open  edge://extensions  or  chrome://extensions
    echo    2. Turn on "Developer mode"
    echo    3. Click "Load unpacked" and select:
    echo         %EXT%
    echo.
    pause
)
exit /b 0

:find
if defined BROWSER exit /b 0
if exist "%~1" set "BROWSER=%~1"
exit /b 0

:wait
rem `timeout` refuses to run when stdin is redirected; pinging is portable.
ping -n %1 127.0.0.1 >nul 2>&1
exit /b 0
