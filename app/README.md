# EASCape app

EASCape's own app, copied from LostLite (16-17 Oct 2026): RuneLite's title bar, sidebar,
settings, profiles, screenshots and plugins around the EASCape 2006 client.

- It opens the EASCape server (by default the one start.bat runs on this PC; set
  `EASCAPE_SERVER`, e.g. `http://localhost:8888`, to use another address).
- Nothing is patched: the client has the app's hooks built in (`webclient/src/client/LostLite.ts`),
  and the app only puts its runtime and the plugins' page code in front of the client.
- Plugins stay off until each is checked against the 2006 game (plan step 4.2); checked ones
  go in `CHECKED_2006` in `src/main/plugins.js`.
- No self-updating installer while the repo is private: start.bat pulls updates and opens
  the app (`npm install` once, then `npm start`).

LostLite itself stays a separate app for Lost City's 2004 worlds. Credits: the sidebar's look,
fonts and interface icons come from RuneLite (BSD 2-Clause, `src/ui/assets/RUNELITE-LICENSE.txt`).
