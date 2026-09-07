@echo off
title Watch Simulator - Senior 1 (Eleanor V.)
echo ========================================================
echo Launching Dedicated Watch Simulator for:
echo   SENIOR 1: Eleanor V. (Cardio Protocol)
echo   IMEI: 353456789012345
echo   Ref ID: SNR-84920-X
echo ========================================================

set WATCH_PROFILE=senior1

if exist "%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe" (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\release\watch-simulator.exe"
) else (
    set "EXE_PATH=%~dp0watch-simulator\src-tauri\target\debug\watch-simulator.exe"
)

start "Watch-Senior-1" "%EXE_PATH%" --profile senior1
