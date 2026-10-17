'use strict';
// Port of RuneLite's Agility plugin (BSD 2-Clause, Copyright (c) 2018, Cas and RuneLite
// contributors) for the 2004 game's courses (Gnome Stronghold, Barbarian Outpost, Wilderness)
// and shortcuts: the obstacle clickboxes, the lap counter and shortcut highlights (names,
// defaults and wording from AgilityConfig). Marks of grace, portals, traps, the Agility Arena
// and the Hallowed Sepulchre aren't in the game (the Agility Arena comes with 377).
module.exports = {
  id: 'agility',
  name: 'Agility',
  description: 'Show helpful information about agility courses and obstacles',
  tags: ['grace', 'marks', 'overlay', 'shortcuts', 'skilling', 'traps', 'agility', 'laps', 'course'],
  enabledByDefault: true,
  game: './agility/game.js',
  page: './agility/page.js',
  config: {
    group: 'agility',
    sections: [],
    items: [
      { key: 'showClickboxes', name: 'Show clickboxes', description: 'Show agility course and other obstacle clickboxes', type: 'boolean', default: true, position: 0 },
      { key: 'showLapCount', name: 'Show lap count', description: 'Enable/disable the lap counter', type: 'boolean', default: true, position: 1 },
      { key: 'lapTimeout', name: 'Hide lap count', description: 'Time until the lap counter hides/resets', type: 'int', default: 5, min: 1, max: 60, unit: 'mins', position: 2 },
      { key: 'lapsToLevel', name: 'Show laps until goal', description: 'Show number of laps remaining until next goal is reached.', type: 'boolean', default: true, position: 3 },
      { key: 'lapsPerHour', name: 'Show laps per hour', description: 'Shows how many laps you can expect to complete per hour.', type: 'boolean', default: true, position: 4 },
      { key: 'overlayColor', name: 'Overlay color', description: 'Color of Agility overlay', type: 'color', default: '#00FF00', position: 5 },
      { key: 'highlightShortcuts', name: 'Highlight agility shortcuts', description: 'Highlight agility shortcuts', type: 'boolean', default: true, position: 8 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
