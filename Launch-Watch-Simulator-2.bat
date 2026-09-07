@echo off
title Watch Simulator - Senior 2 (Arthur M.)
echo ========================================================
echo Launching Dedicated Watch Simulator for:
echo   SENIOR 2: Arthur M. (Respiratory Protocol)
echo   IMEI: 867530901234567
echo   Ref ID: SNR-92104-Y
echo ========================================================

set WATCH_PROFILE=senior2

if exist "%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe" (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe"
) else (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\debug\watch-simulator.exe"
)

start "Watch-Senior-2" "%EXE_PATH%" --profile senior2
