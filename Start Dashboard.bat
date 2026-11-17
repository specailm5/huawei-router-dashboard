@echo off
setlocal
title Huawei Router Dashboard
cd /d "%~dp0"

rem Starts the dashboard and opens it in your browser.
rem Keep this window open while you use it; closing it stops the dashboard.

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js is needed and is not installed.
    echo  Opening the download page now.
    echo.
    start "" "https://nodejs.org/en/download"
    echo  Install Node.js, then double-click this file again.
    pause
    exit /b 1
)

echo.
echo  Starting the dashboard. Your browser opens in a moment.
echo.
echo  Keep this window open while you use it.
echo  Close this window to stop the dashboard.
echo.

node server.js

echo.
echo  The dashboard has stopped.
pause
