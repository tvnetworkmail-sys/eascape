@echo off
rem Run by start.bat after it has pulled the latest version.
title EASCape
cd /d "%~dp0"

rem A folder downloaded as a ZIP has no git history, so start.bat can't update it.
if not exist "%~dp0.git" (
    echo.
    echo This copy of EASCape was downloaded as a ZIP, so it can't update itself.
    echo To get updates, make the folder with:  git clone https://github.com/tvnetworkmail-sys/eascape
    echo.
)

rem Only one server can run on this computer at a time (it uses port 43594).
netstat -an | findstr /r /c:":43594 .*LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo An EASCape server is already running on this computer, so this one won't start.
    echo Close the other "EASCape server" window first if you want this copy's server.
    echo The app will open on the server that's already running.
    echo.
) else (
    rem The server runs in its own window; close that window to stop it.
    echo Starting the server in its own window...
    start "EASCape server" /D "%~dp0engine" cmd /k npm start
)

rem The app. The first time it installs itself, which downloads Electron (a minute or two).
rem It waits for the server by itself.
cd /d "%~dp0app"
echo Getting the app ready...
call npm install --no-audit --no-fund
echo Opening EASCape...
call npm start
