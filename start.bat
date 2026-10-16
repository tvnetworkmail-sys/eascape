@echo off
title EASCape server
cd /d "%~dp0"
if exist .git (
    echo Checking for updates...
    git pull
)
cd engine
call npm start
pause
