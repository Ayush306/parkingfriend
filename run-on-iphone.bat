@echo off
title ParkingFriend - Run on iPhone (Expo Go)
cd /d "%~dp0"

echo ==================================================
echo    ParkingFriend  -  run on your iPhone (Expo Go)
echo ==================================================
echo.
echo BEFORE YOU START:
echo   1) On the iPhone, install "Expo Go" from the App Store (free).
echo      (The app is now on SDK 57, so the current Expo Go works.)
echo   2) BEST connection: turn on a PHONE HOTSPOT and join BOTH
echo      this laptop and the iPhone to it. Office Wi-Fi usually
echo      blocks phone^<->laptop traffic, so a hotspot is most reliable.
echo.
echo HOW TO OPEN THE APP:
echo   - A QR code appears below once Metro starts.
echo   - Open the iPhone CAMERA app, point it at the QR code.
echo   - Tap the "Open in Expo Go" banner. The app loads.
echo.
echo   Press r = reload in the app,  Ctrl+C = stop the server.
echo.

if /I "%~1"=="tunnel" (
  echo [mode] TUNNEL - routes over the internet via ngrok.
  echo         Use this if the LAN QR will not connect. Needs internet
  echo         to reach Expo/ngrok; may be blocked on office Wi-Fi.
  echo.
  call npx expo start --tunnel
) else (
  set "EXPO_OFFLINE=1"
  echo [mode] LAN - both devices must share the same Wi-Fi / hotspot.
  echo         If the QR will not connect, close this and run:
  echo             run-on-iphone.bat tunnel
  echo.
  call npx expo start
)

echo.
echo Server stopped. Press any key to close.
pause >nul
