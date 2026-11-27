'use strict';
// RuneLite core, app side: sends the fonts, RuneLite's skill icons, the overlay settings and
// the saved overlay positions (group runelite); saves what the page changes (rl-config) and shows its
// notifications (rl-notify).
const fs = require('fs');
const path = require('path');

const descriptor = require('./descriptor');

function assets() {
  const out = {};
  for (const dir of ['skill_icons', 'skill_icons_small', 'bank', 'orbicon']) {
    const d = path.join(__dirname, 'assets', dir);
    for (const f of fs.readdirSync(d)) out[`${dir}/${f}`] = `data:image/png;base64,${fs.readFileSync(path.join(d, f)).toString('base64')}`;
  }
  return out;
}

module.exports = function runeliteCore(ctx) {
  // the game's world map, which the core's WorldMapOverlay draws on
  const worldMap = require('../../ui/worldmap')(ctx);
  let off = null;
  let sentStatic = false;
  function send() {
    const runelite = ctx.groupValues('runelite');
    for (const it of descriptor.config.items) if (runelite[it.key] === undefined) runelite[it.key] = it.default;
    const config = { values: { runelite } };
    if (!sentStatic) {
      config.fonts = { RLRuneScape: ctx.fontUrl('runescape.ttf'), RLRuneScapeSmall: ctx.fontUrl('runescape_small.ttf'), RLRuneScapeBold: ctx.fontUrl('runescape_bold.ttf') };
      config.assets = assets();
      sentStatic = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'runelite', enabled: true, config });
  }
  // World Hopper: our server's world list (main/worlds.js) for the core's WorldService
  function sendWorlds() {
    ctx.invoke('worlds-get').then((r) => { if (r && r.worlds) ctx.sendToGame({ type: 'plugin-config', id: 'runelite', enabled: true, config: { worlds: r.worlds } }); }).catch(() => {});
  }
  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'rl-config' && data && typeof data.group === 'string' && typeof data.key === 'string') ctx.setConfig(data.group, data.key, data.value);
        else if (type === 'rl-notify') ctx.notify('2006RS-2', String(data));
        else if (type === 'rl-worlds-refresh') sendWorlds();
        else if (type === 'rl-ping' && data) ctx.invoke('worlds-ping', data.id).then((ms) => ctx.sendToGame({ type: 'plugin-config', id: 'runelite', enabled: true, config: { pong: { seq: data.seq, ms } } })).catch(() => {});
        else if (type === 'rl-world-hop') ctx.invoke('world-hop', Number(data)).catch(() => {});
        else if (type === 'rl-open-config' && data && typeof data.id === 'string') window.dispatchEvent(new CustomEvent('lostlite-open-config', { detail: { id: data.id } }));
      });
      send();
      sendWorlds();
      worldMap.start();
    },
    stop() { if (off) off(); worldMap.stop(); },
    configChanged: () => send(),
    gameReady: () => { sentStatic = false; send(); sendWorlds(); },
  };
};
