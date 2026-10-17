@echo off
rem Run by start.bat after it has pulled the latest version.
title EASCape
cd /d "%~dp0"

rem The server runs in its own window; close that window to stop it.
echo Starting the server in its own window...
start "EASCape server" /D "%~dp0engine" cmd /k npm start

rem The app. The first time it installs itself, which downloads Electron (a minute or two).
rem It waits for the server by itself.
cd /d "%~dp0app"
echo Getting the app ready...
call npm install --no-audit --no-fund
echo Opening EASCape...
call npm start
