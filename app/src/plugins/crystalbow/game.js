'use strict';
// Crystal Bow, sidebar side: sends the settings to the page side and turns its warnings into
// notifications.
const descriptor = require('./descriptor');

module.exports = function crystalbow(ctx) {
  let off = null;
  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    ctx.sendToGame({ type: 'plugin-config', id: 'crystalbow', enabled, config });
  }
  return {
    start() {
      send(true);
      off = ctx.onRuntime((type, data) => {
        // the page has put the warning in the chat box; this is the desktop one only
        if (type === 'crystalbow-warn' && data && ctx.config('notify') !== false) ctx.invoke('notify', 'Crystal Bow', data.text).catch(() => {});
      });
    },
    stop() {
      send(false);
      if (off) off();
      off = null;
    },
    configChanged: () => send(true),
    gameReady: () => send(true),
  };
};
