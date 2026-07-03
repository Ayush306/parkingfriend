@echo off
title Parkmitter - Web
cd /d "%~dp0"

set "EXPO_OFFLINE=1"
set "EXPO_NO_TELEMETRY=1"

echo ==================================================
echo    Parkmitter  -  running in your browser (web)
echo ==================================================
echo.
echo Your browser will open http://localhost:8081 automatically.
echo (If it doesn't, open that address yourself.)
echo Press Ctrl+C here to stop.
echo.

call npx expo start --offline --web

echo.
echo Server stopped. Press any key to close.
pause >nul
