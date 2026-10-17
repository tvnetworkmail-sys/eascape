#!/bin/sh
# Pulls updates, starts the server in the background (log in engine/server.log) and opens the
# app. Stopping the app leaves the server running; stop it with: kill $(cat engine/server.pid)
cd "$(dirname "$0")"
[ -d .git ] && git pull
(cd engine && npm start > server.log 2>&1 & echo $! > server.pid)
cd app && npm install --no-audit --no-fund && EASCAPE_SERVER=${EASCAPE_SERVER:-http://localhost:8888} npm start
