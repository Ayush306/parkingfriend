@echo off
title ParkingFriend - Build APK (cloud)
cd /d "%~dp0"

echo ==================================================
echo    ParkingFriend  -  Build an installable APK
echo    (Expo cloud build - no local Gradle needed)
echo ==================================================
echo.

REM --- Sanity check: eas-cli must be available ---
where eas >nul 2>nul
if errorlevel 1 (
  echo [ERROR] eas-cli not found on PATH.
  echo   Install it once with:  npm install -g eas-cli
  echo.
  pause
  exit /b 1
)

echo [1/3] Checking your Expo login...
eas whoami >nul 2>nul
if errorlevel 1 (
  echo    You are NOT logged in. Opening the login prompt now.
  echo    ^(Create a free account first at https://expo.dev if you don't have one.^)
  echo.
  eas login
  if errorlevel 1 (
    echo.
    echo [ERROR] Login failed.
    echo   If this was a network / timeout error, this office network is
    echo   likely blocking api.expo.dev - try a home network or phone hotspot.
    echo.
    pause
    exit /b 1
  )
) else (
  echo    Logged in as:
  eas whoami
)
echo.

echo [2/3] Starting the cloud build ^(profile: preview  =^>  .apk^)...
echo    - On the FIRST build EAS asks "Generate a new Android Keystore?"
echo      Just press ENTER to let EAS manage it.
echo    - The build runs on Expo's servers and takes ~10-15 minutes.
echo.

call eas build -p android --profile preview
if errorlevel 1 (
  echo.
  echo [ERROR] Build command failed.
  echo   If it was a network error, api.expo.dev is likely blocked on this
  echo   network - retry from a home network or phone hotspot.
  echo.
  pause
  exit /b 1
)

echo.
echo [3/3] Done. When the build finishes, EAS prints a URL.
echo    Open it, tap Download, and you get ParkingFriend.apk
echo    Copy it to your phone (USB / WhatsApp / Drive) and tap to install.
echo    (Allow "Install from unknown sources" if asked.)
echo.
echo Press any key to close.
pause >nul
