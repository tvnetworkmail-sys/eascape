# EASCape

A private 2006-era (revision 377) RuneScape server for friends and family.

- `engine/` - the server (from Lost City's Engine-TS, branch 377-wip)
- `content/` - the game content and scripts (from Lost City's Content, branch 377-wip)
- `webclient/` - the web client, being upgraded from Lost City's 289 web client to 377

Upstream versions we started from are in UPSTREAM.txt. Lost City's code is MIT licensed
(see each folder's LICENSE). The game assets are Jagex's property.

## Running it on your PC

Needs Node.js 24 or newer and Git.

1. Double-click `start.bat` (Windows) or run `./start.sh`.
   The first start installs packages and builds the game files, which takes a few minutes.
2. Wait for `World ready` in the window.
3. Open http://localhost/rs2.cgi in your browser (port 8888 instead of 80 on Linux).
4. Close the window (or Ctrl+C) to stop the server.

## Working on the web client

In `webclient/`: `bun install`, then `bun run deploy` builds the client and copies it into
`engine/public/client/`. `bun run check377` decodes every 377 game file with the client's own
code (run the server once first so the game files exist).
