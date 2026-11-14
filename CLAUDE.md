# EASCape: notes for Claude sessions

## The two repos, and which way changes go

- **eascape** (github.com/tvnetworkmail-sys/eascape) is the owner's **local test environment**:
  updates are made and tested here first, on a server on their own computer (start.bat).
- **eascape-live** (github.com/tvnetworkmail-sys/eascape-live) is the live game at 2006rs.com:
  worlds 1-3, the website, and the online sandbox (2006rs.com/test, world 20, where players
  can try things in test mode). The sandbox is part of the live game, not the local test
  environment.

Changes go **one way: eascape → eascape-live**. A live update merges all of eascape's main
branch into eascape-live.

**Never copy eascape-live's files, or its app, into eascape.** On 13 Nov 2026 a session replaced
eascape's app with the live 2006RS app (commit 5d6edf01). The local copy then opened the live
game instead of the local server, and showed live's worlds and the sandbox. Fixed by 85a481eb and
f2ad2a80. If something from live is needed here, ask the owner first and bring over only that
one change.

## How the app stays local here and live there

- One app serves both. `app/src/main/worlds.js` lists the live worlds by default. When
  `EASCAPE_SERVER` is set, it lists only that server, as one world.
- `launch.bat` (run by `start.bat`) sets `EASCAPE_SERVER=http://localhost`, so the local copy
  only ever plays on this computer's server. The live app never sets it. Keep both.
- `app/package.json` differs on purpose: eascape says EASCape, eascape-live says 2006RS and has
  its own version numbers. When merging into eascape-live, keep live's `app/package.json`.

## When merging eascape into eascape-live

- Merge everything new, but keep live's own files: `app/package.json`, `deploy/`, the website,
  and live's server settings.
- Afterwards, list anything eascape has that eascape-live doesn't, and why. A plain merge
  silently keeps anything live removed on its own (Idle Notifier, 8 Nov).
- Content `.pack` files (varp, obj, loc and so on): keep both sides' new entries, with no
  clashing ids.
