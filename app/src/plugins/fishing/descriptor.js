'use strict';
// Port of RuneLite's Fishing plugin (BSD 2-Clause, Copyright (c) 2017, Seth and RuneLite
// contributors) for the 2004 game: fishing spot tiles, icons (the game's own fish icons) and
// names, and the session panel (names, defaults and wording from FishingConfig). Minnows,
// aerial fishing, harpoonfish and flying fish aren't in the game; spots on the minimap aren't
// drawn yet.
module.exports = {
  id: 'fishing',
  name: 'Fishing',
  description: 'Show fishing stats and mark fishing spots',
  tags: ['overlay', 'skilling', 'fish', 'fishing', 'spots'],
  enabledByDefault: true,
  game: './fishing/game.js',
  page: './fishing/page.js',
  config: {
    group: 'fishing',
    sections: [],
    items: [
      { key: 'onlyCurrent', name: 'Display only currently fished fish', description: 'Configures whether only current fished fish\'s fishing spots are displayed.', type: 'boolean', default: false, position: 1 },
      { key: 'showTiles', name: 'Display spot tiles', description: 'Configures whether tiles for fishing spots are highlighted.', type: 'boolean', default: true, position: 2 },
      { key: 'showIcons', name: 'Display spot icons', description: 'Configures whether icons for fishing spots are displayed.', type: 'boolean', default: true, position: 3 },
      { key: 'iconSize', name: 'Spot icon size', description: 'The size of the fish icons over the spots, in percent of the inventory icon.', type: 'int', default: 50, min: 25, max: 100, unit: '%', position: 3 },
      { key: 'showNames', name: 'Display spot names', description: 'Configures whether names for fishing spots are displayed.', type: 'boolean', default: false, position: 4 },
      { key: 'overlayColor', name: 'Overlay color', description: 'Color of overlays.', type: 'color', default: '#00FFFF', position: 5 },
      { key: 'statTimeout', name: 'Reset stats', description: 'The time until fishing session data is reset in minutes.', type: 'int', default: 5, min: 1, max: 60, unit: 'mins', position: 9 },
      { key: 'showFishingStats', name: 'Show fishing session stats', description: 'Display the fishing session stats.', type: 'boolean', default: true, position: 10 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
