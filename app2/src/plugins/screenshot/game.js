'use strict';
// app side: RuneLite clone boilerplate (sends the settings to the page), plus the page's screenshots saved by the app
// (main.js 'screenshot-save': RuneLite's ImageCapture) and "Open screenshot folder...".
const clone = require('../runelite/clone')(require('./descriptor'));

module.exports = function screenshot(ctx) {
  const base = clone(ctx);
  let off = null;
  return Object.assign({}, base, {
    start() {
      base.start();
      off = ctx.onRuntime((type, data) => {
        if (type === 'rl-screenshot' && data && typeof data.png === 'string') {
          ctx.invoke('screenshot-save', data).then((file) => {
            if (!file || !data.notify) return;
            ctx.notify('2006RS-2', data.clipboard ? 'A screenshot was saved and inserted into your clipboard!' : 'A screenshot was saved to ' + file);
          }).catch(() => {});
        } else if (type === 'rl-screenshot-folder') ctx.invoke('screenshot-open-folder').catch(() => {});
      });
    },
    stop() { if (off) off(); off = null; base.stop(); },
  });
};
