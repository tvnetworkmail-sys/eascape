'use strict';
// The app side of every plugin cloned from RuneLite: sends its settings (all of its config items,
// hidden ones too) to the page, where the clone runs on the RuneLite core.
const fs = require('fs');
const path = require('path');

/** descriptor.resources: files in the plugin's folder (RuneLite's resources), sent once as data URLs */
function resources(descriptor) {
  const out = {};
  for (const f of descriptor.resources || []) {
    const ext = path.extname(f).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'json' ? 'application/json' : 'application/octet-stream';
    out[f] = `data:${mime};base64,${fs.readFileSync(path.join(__dirname, '..', descriptor.id, f)).toString('base64')}`;
  }
  return out;
}

module.exports = (descriptor) => function clone(ctx) {
  let sent = false;
  function send(enabled) {
    // every saved value of the plugin's group (hidden state such as RuneScape-profile keys too), then its items
    const config = Object.assign({}, ctx.groupValues ? ctx.groupValues() : {});
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    if (enabled && !sent) {
      config.__items = descriptor.config.items;
      if (descriptor.resources) config.__resources = resources(descriptor);
      sent = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: descriptor.id, enabled, config });
  }
  return {
    start: () => send(true),
    stop: () => send(false),
    configChanged: () => send(true),
    gameReady: () => { sent = false; send(true); },
  };
};
