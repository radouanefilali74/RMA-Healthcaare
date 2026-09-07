@echo off
title Launch Dual Watch Simulators
echo ========================================================
echo Launching Dual Watch Simulators: One Profile Per Watch
echo ========================================================
echo.

if exist "%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe" (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe"
) else (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\debug\watch-simulator.exe"
)

echo [1/2] Starting Watch Simulator 1 (Eleanor V. - Cardio Protocol)...
set WATCH_PROFILE=senior1
start "Watch-Senior-1" "%EXE_PATH%" --profile senior1

timeout /t 2 /nobreak >nul

echo [2/2] Starting Watch Simulator 2 (Arthur M. - Respiratory Protocol)...
set WATCH_PROFILE=senior2
start "Watch-Senior-2" "%EXE_PATH%" --profile senior2

echo.
echo ========================================================
echo Both dedicated watch simulators are running!
echo Window 1: Senior 1 (Eleanor V. - IMEI: 353456789012345)
echo Window 2: Senior 2 (Arthur M. - IMEI: 867530901234567)
echo ========================================================
pause
