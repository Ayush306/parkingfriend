@echo off
title Parkmitter - Run on Phone
cd /d "%~dp0"

REM Run ONLINE: Expo SDK 57 signs its manifest, which offline mode cannot do.
REM So the laptop needs working internet -- use a phone HOTSPOT if the office
REM Wi-Fi drops (ECONNRESET). The phone reaches Metro over USB (adb reverse),
REM the internet is only for signing the manifest.
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
echo IMPORTANT ^(this app is now on Expo SDK 57^):
echo   1^) On the phone, update "Expo Go" from the Play Store to the
echo      LATEST version. An older Expo Go ^(e.g. SDK 54^) will say
echo      "requires a newer version of Expo Go" and refuse to load.
echo   2^) Keep this laptop on WORKING internet ^(a phone hotspot is
echo      most reliable^) so the SDK 57 manifest can be signed.
echo.
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
echo    The app is opened over the USB CABLE (localhost tunnel), never
echo    over Wi-Fi — so office/home network problems can't break it.
echo    Press r = reload, Ctrl+C = stop. Shake phone = dev menu.
echo.

REM Opens the app via USB as soon as Metro is ready (runs in background).
start "Open Parkmitter on phone" /min "%~dp0open-on-phone-helper.bat" "%ADB%"

call npx expo start

echo.
echo Server stopped. Press any key to close.
pause >nul
