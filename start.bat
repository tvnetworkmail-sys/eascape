@echo off
title EASCape server
cd /d "%~dp0"
if exist .git (
    echo Checking for updates...
    git pull
)
rem Everything after the update lives in launch.bat, so an update never changes this file
rem while it is running.
call "%~dp0launch.bat"
