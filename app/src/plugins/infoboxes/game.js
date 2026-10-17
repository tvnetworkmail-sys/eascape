'use strict';
// Info Boxes, sidebar side: sends the settings, layout and images to the page side (which
// draws the boxes), and saves where you put each box.
const descriptor = require('./descriptor');
const icons = require('./icons.json');

module.exports = function infoBoxes(ctx) {
  let off = null;
  let sentIcons = false;

  function send(enabled) {
    const config = {};
    for (const it of descriptor.config.items) config[it.key] = ctx.config(it.key);
    config.layout = ctx.state('layout', null) || null;
    if (enabled && !sentIcons) {
      config.icons = icons;
      // RuneLite's infobox fonts (FontManager): the RuneScape fonts, drawn at screen size
      const font = (file) => {
        try {
          return ctx.fontUrl(file).replace(/^data:[^,]*,/, '');
        } catch {
          return null;
        }
      };
      config.fonts = { LLRunescape: font('runescape.ttf'), LLRunescapeSmall: font('runescape_small.ttf'), LLRunescapeBold: font('runescape_bold.ttf') };
      sentIcons = true;
    }
    ctx.sendToGame({ type: 'plugin-config', id: 'infoboxes', enabled, config });
  }

  return {
    start() {
      sentIcons = false;
      off = ctx.onRuntime((type, data) => {
        if (type === 'infobox-layout' && data && typeof data === 'object') ctx.setState('layout', data);
      });
      send(true);
    },
    stop() {
      if (off) off();
      send(false);
    },
    configChanged: () => send(true),
    gameReady: () => {
      sentIcons = false;
      send(true);
    },
  };
};
