'use strict';
// HiScore, sidebar side: looks names up on the game server (GET /hiscores/player/<name>, from
// this page's own server) and reports the result to the HiScore panel. A lookup comes from the
// panel's search box (config "command") or from a Lookup menu click in the game (runtime message
// "hiscore-lookup"), which also opens the panel, as RuneLite's lookupPlayer does.
const descriptor = require('./descriptor');

const MAX_USERNAME_LENGTH = 12; // HiscorePanel

module.exports = function hiscore(ctx) {
  let off = null;
  let seq = 0;
  let state = { name: '', loading: false, result: null, error: null };

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'hiscore', enabled, config });
  }

  function report() {
    ctx.report(Object.assign({}, state));
  }

  async function lookup(raw, open) {
    const name = String(raw || '').replace(/<[^>]*>|@[a-z0-9~]{3}@/gi, '').replace(/ /g, ' ').trim().slice(0, MAX_USERNAME_LENGTH);
    if (!name) return;
    if (open) ctx.openPanel();
    const mine = ++seq;
    state = { name, loading: true, result: null, error: null };
    report();
    try {
      const res = await fetch(`${location.origin}/hiscores/player/${encodeURIComponent(name.toLowerCase())}`, { cache: 'no-store' });
      if (mine !== seq) return;
      if (res.status === 404) {
        state = { name, loading: false, result: null, error: 'not found' };
      } else if (!res.ok) {
        state = { name, loading: false, result: null, error: 'error' };
      } else {
        state = { name, loading: false, result: await res.json(), error: null };
      }
    } catch {
      if (mine !== seq) return;
      state = { name, loading: false, result: null, error: 'error' };
    }
    report();
  }

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'hiscore-lookup') lookup(data, true);
      });
      send(true);
      report();
    },
    stop() {
      if (off) off();
      send(false);
    },
    configChanged(key) {
      if (key === 'command') {
        const cmd = ctx.config('command');
        if (cmd && cmd.action === 'lookup') lookup(cmd.name, false);
        return;
      }
      send(true);
    },
    gameReady: () => send(true),
  };
};
