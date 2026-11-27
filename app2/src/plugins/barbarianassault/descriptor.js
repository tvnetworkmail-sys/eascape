'use strict';
// RuneLite's Barbarian Assault plugin (net.runelite.client.plugins.barbarianassault), cloned 1:1: BarbarianAssaultConfig.
// Barbarian Assault came on 4 Jan 2007; our server doesn't have it yet, so this is ready for when it's built (see page.js
// for the interface ids it waits for).
module.exports = {
  id: 'barbarianassault',
  name: 'Barbarian Assault',
  description: 'Show a timer to the next call change and game/wave duration in chat.',
  tags: ['minigame', 'overlay', 'timer'],
  enabledByDefault: true,
  game: './barbarianassault/game.js',
  page: './barbarianassault/page.js',
  resources: ['clock.png'],
  config: {
    group: 'barbarianAssault',
    sections: [],
    items: [
      { key: 'showTimer', name: 'Show call change timer', description: 'Show time to next call change.', type: 'boolean', default: true, position: -1 },
      { key: 'showHealerBars', name: 'Show health bars for teammates when healer', description: 'Displays team health for healer.', type: 'boolean', default: true, position: -1 },
      { key: 'waveTimes', name: 'Show wave and game duration', description: 'Displays wave and game duration.', type: 'boolean', default: true, position: -1 },
    ],
  },
};
