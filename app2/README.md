# 2006RS-2 (test app)

The owner's test app: the 2007RS app (`tvnetworkmail-sys/2007scape`, `app/`, 0.1.6 at 0df4e636,
23 Nov 2026), RuneLite's shell and 98 RuneLite-style plugins, ported to 2006RS. Only the owner
has it while it's tested; if it works out it becomes the main client in place of `app/`.

- It opens the live worlds (2006rs.com, worlds 1-3 and the test server, world 20) like `app/`:
  `src/main/worlds.js`, `clientLoader.js` and `patcher.js` are `app/`'s. `EASCAPE_SERVER` points it
  at another server, as in `app/`.
- It installs beside the normal app (its own name, app id and settings folder) and never updates
  itself: the owner builds it from this folder (`npm install`, then `npm run dist:win`, or
  `npm start` to run it from here).
- The server knows it as the app (`EASCapeApp/<version>` in its user agent, as `app/`). It tells
  the game it is version 999.0.0, so the game's "Your app needs updating" notice (which follows
  `app/`'s versions) never shows.
- The plugins were written for the 2007 client. Many read the game through calls the 2007 client
  gives the app (`webclient/src/client/LostLite.ts` in 2007scape); the 2006 client's own
  `LostLite.ts` is being given the same calls. Plugins for content 2006RS doesn't have are left in
  and get turned off as testing goes.
- Plugins are moving to data the server sends (hidden `~2007rsapp~` chat lines the runtime takes
  out of the chat box, as 2007RS's bank already does), so they don't guess from animations.

`docs/PLUGIN_PARITY.md` and `docs/BATTLE-PLAN.md` are 2007RS's notes, kept as they were.
