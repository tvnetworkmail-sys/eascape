'use strict';
// RuneLite's Tears Of Guthix plugin (net.runelite.client.plugins.tearsofguthix), cloned 1:1: TearsOfGuthixConfig.
module.exports = {
  id: 'tearsofguthix',
  name: 'Tears Of Guthix',
  description: 'Show timers for the Tears Of Guthix streams',
  tags: ['minigame', 'overlay', 'skilling', 'timers', 'tog'],
  enabledByDefault: true,
  game: './tearsofguthix/game.js',
  page: './tearsofguthix/page.js',
  config: {
    group: 'tearsofguthix',
    sections: [],
    items: [
      { key: 'showGreenTearsTimer', name: 'Enable green tears timer', description: 'Configures whether to display a timer for green tears or not.', type: 'boolean', default: true, position: 1 },
      { key: 'blueTearsColor', method: 'getBlueTearsColor', name: 'Blue tears color', description: 'Color of blue tears timer.', type: 'color', alpha: true, default: '#6400FFFF', position: 2 },
      { key: 'greenTearsColor', method: 'getGreenTearsColor', name: 'Green tears color', description: 'Color of green tears timer.', type: 'color', alpha: true, default: '#6400FF00', position: 3 },
    ],
  },
};
