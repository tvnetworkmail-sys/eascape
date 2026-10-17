# EASCape

A private 2006-era (revision 377) RuneScape server for friends and family.

- `engine/` - the server (from Lost City's Engine-TS, branch 377-wip)
- `content/` - the game content and scripts (from Lost City's Content, branch 377-wip)
- `webclient/` - the web client, being upgraded from Lost City's 289 web client to 377
- `app/` - the EASCape app (copied from LostLite): RuneLite-style sidebar, settings and plugins

Upstream versions we started from are in UPSTREAM.txt. Lost City's code is MIT licensed
(see each folder's LICENSE). The game assets are Jagex's property.

## Running it on your PC

Needs Node.js 24 or newer and Git.

1. Double-click `start.bat` (Windows). It pulls the latest version, starts the server in its
   own window and opens the EASCape app, which waits for the server and then shows the game.
   The first start installs the app and builds the game files, which takes a few minutes.
2. Close the app to stop playing; close the "EASCape server" window to stop the server.

On Linux, `./start.sh` does the same (server on port 8888, log in `engine/server.log`).
A browser still works too: http://localhost/rs2.cgi (port 8888 on Linux).

## Working on the web client

In `webclient/`: `bun install`, then `bun run deploy` builds the client and copies it into
`engine/public/client/`. `bun run check377` decodes every 377 game file with the client's own
code (run the server once first so the game files exist).
