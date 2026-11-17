@echo off
setlocal
title Huawei Router Dashboard
cd /d "%~dp0"

rem Starts the dashboard and opens it in your browser.
rem Keep this window open while you use it; closing it stops the dashboard.
rem Node.js is required; if it is missing this finds and installs it first.

set "NODE_EXE="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-node.ps1"`) do (
    if not defined NODE_EXE set "NODE_EXE=%%P"
)

if not defined NODE_EXE (
    echo.
    echo  Node.js could not be set up, so the dashboard cannot start.
    echo  Check that this computer is online, then double-click this file again.
    pause
    exit /b 1
)

echo.
echo  Starting the dashboard. Your browser opens in a moment.
echo.
echo  Keep this window open while you use it.
echo  Close this window to stop the dashboard.
echo.

"%NODE_EXE%" server.js

echo.
echo  The dashboard has stopped.
pause
