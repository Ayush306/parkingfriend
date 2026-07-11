@echo off
REM Helper used by run-on-phone.bat — waits until Metro answers on localhost,
REM then opens the app on the phone via the USB tunnel (exp://127.0.0.1:8081).
REM Runs minimized in its own window; closes itself when done.
set "ADB=%~1"
for /l %%i in (1,1,90) do (
  curl -s -m 2 http://localhost:8081/status >nul 2>&1 && goto ready
  timeout /t 2 /nobreak >nul
)
exit /b 1
:ready
"%ADB%" reverse tcp:8081 tcp:8081 >nul
"%ADB%" shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" >nul
exit /b 0
