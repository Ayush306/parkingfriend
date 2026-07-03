@echo off
title Parkmitter - Run on Phone
cd /d "%~dp0"

set "EXPO_OFFLINE=1"
set "ADB="
set "ANDROID_HOME="

REM --- Find adb, most reliable source first ---
REM 1) Copy bundled inside this project (always visible to your session)
if exist "%~dp0android-sdk\platform-tools\adb.exe" (
  set "ANDROID_HOME=%~dp0android-sdk"
  set "ADB=%~dp0android-sdk\platform-tools\adb.exe"
)
REM 2) Standard SDK location in AppData
if not defined ADB if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
  set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
  set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
)
REM 3) adb already on PATH
if not defined ADB (
  for /f "delims=" %%i in ('where adb 2^>nul') do set "ADB=%%i"
)

if not defined ADB (
  echo [ERROR] Could not find adb. Tell Claude - "adb not found".
  echo   Checked: %~dp0android-sdk\platform-tools\
  echo            %LOCALAPPDATA%\Android\Sdk\platform-tools\
  echo            and PATH.
  echo.
  pause
  exit /b 1
)

if defined ANDROID_HOME set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
if defined ANDROID_HOME set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

echo ==================================================
echo    Parkmitter  -  launching on your phone (USB)
echo ==================================================
echo Using adb: %ADB%
echo.
echo [1/3] Connected phone:
"%ADB%" devices
echo.
echo    If it says "unauthorized", tap ALLOW on the phone, then rerun.
echo.
echo [2/3] Setting up USB tunnel...
"%ADB%" reverse tcp:8081 tcp:8081
echo.
echo [3/3] Starting Metro + opening Parkmitter on your phone...
echo    Press r = reload, Ctrl+C = stop. Shake phone = dev menu.
echo.

call npx expo start --android

echo.
echo Server stopped. Press any key to close.
pause >nul
