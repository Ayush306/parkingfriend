@echo off
title ParkingFriend - Run on Emulator (virtual phone on this PC)
cd /d "%~dp0"

set "ANDROID_HOME=%~dp0android-sdk"
set "ANDROID_SDK_ROOT=%~dp0android-sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"
set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
set "EMU=%ANDROID_HOME%\emulator\emulator.exe"

echo ==================================================
echo    ParkingFriend  -  virtual phone on this PC
echo ==================================================
echo No cable, no phone needed. Ctrl+C here stops Metro;
echo the emulator window can stay open for next time.
echo.

if not exist "%EMU%" (
  echo [ERROR] Emulator not installed. Tell Claude: "emulator missing".
  pause
  exit /b 1
)

REM --- 1) Boot the virtual phone if it isn't already running ---
"%ADB%" devices | findstr /C:"emulator-" >nul
if errorlevel 1 (
  echo [1/4] Booting the virtual phone ^(first boot takes ~1-2 min^)...
  start "ParkingFriend Emulator" "%EMU%" -avd ParkingFriend -netdelay none -netspeed full
) else (
  echo [1/4] Virtual phone already running.
)

echo [2/4] Waiting for Android to finish booting...
"%ADB%" wait-for-device
:bootwait
for /f "delims=" %%b in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do set BOOTED=%%b
if not "%BOOTED%"=="1" (
  timeout /t 3 /nobreak >nul
  goto bootwait
)
echo        Booted.

REM --- 2) Make sure Expo Go is installed on the virtual phone ---
"%ADB%" shell pm list packages 2>nul | findstr /C:"host.exp.exponent" >nul
if errorlevel 1 (
  echo [3/4] Installing Expo Go into the virtual phone ^(one-time^)...
  "%ADB%" install -r "%ANDROID_HOME%\ExpoGo-57.apk"
) else (
  echo [3/4] Expo Go already installed.
)

REM --- 3) Metro + open the app ---
echo [4/4] Starting Metro + opening ParkingFriend on the virtual phone...
echo        Press r = reload, Ctrl+C = stop.
echo.
call npx expo start --android

echo.
echo Metro stopped. The emulator window can stay open. Press any key to close.
pause >nul
