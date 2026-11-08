# EASCape Update Tracker

The 103 RuneScape game updates from 24 November 2004 to 13 June 2006, with whether each is in
EASCape ("added"), whether it has been tested ("tested") and testing notes ("notes").

- `index.html`: the tracker page. One self-contained file (Google Fonts are its only outside link).
  The update list (date, title, RS wiki link) is the `UPDATES` array in its script.
- `updates.json`: the ticks and notes, keyed by the update's id (`YYYY-MM-DD-slug`, the same ids
  as `UPDATES`). An update missing from it is neither added nor tested.

On claude.ai the page saves ticks and notes to its own database. Anywhere else (a website, or
opened from disk through a web server) it reads `updates.json` next to it and shows it read-only.
To make it editable on a website, replace the `window.claude.use('db')` part of the script with
your own storage (each update's record is `{added, tested, notes}`) and keep `updates.json` as
the starting data. Exported from the live tracker on 8 Nov 2026.
