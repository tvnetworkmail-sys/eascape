'use strict';
// RuneLite's Mouse Tooltips (net.runelite.client.plugins.mousehighlight), cloned 1:1: MouseHighlightConfig.
module.exports = {
  id: 'mousehighlight',
  name: 'Mouse Tooltips',
  description: 'Render default actions as a tooltip',
  tags: ['actions', 'overlay', 'tooltip', 'hide'],
  enabledByDefault: true,
  game: './mousehighlight/game.js',
  page: './mousehighlight/page.js',
  config: {
    group: 'mousehighlight',
    sections: [],
    items: [
      { key: 'uiTooltip', name: 'Interface tooltips', description: 'Whether or not tooltips are shown on interfaces.', type: 'boolean', default: true, position: 0 },
      { key: 'chatboxTooltip', name: 'Chatbox tooltips', description: 'Whether or not tooltips are shown over the chatbox.', type: 'boolean', default: true, position: 1 },
      { key: 'disableSpellbooktooltip', name: 'Disable spellbook tooltips', description: "Disable spellbook tooltips so they don't cover descriptions.", type: 'boolean', default: false, position: 2 },
    ],
  },
};
