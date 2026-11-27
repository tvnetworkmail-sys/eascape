'use strict';
// RuneLite's Agility plugin (net.runelite.client.plugins.agility), cloned 1:1: AgilityConfig.
// Trimmed for Sept 2007: no marks of grace (rooftop courses, 2013) and their colour, no Prifddinas portals (2019), no
// Hallowed Sepulchre section (2020). The obstacle lists are RuneLite's trimmed to the 2007 cache (obstacles.js and the
// core's agilityshortcut.js, made by app/tools/runelite/agility.py).
module.exports = {
  id: 'agility',
  name: 'Agility',
  description: 'Show helpful information about agility courses and obstacles',
  tags: ['grace', 'marks', 'overlay', 'shortcuts', 'skilling', 'traps', 'sepulchre'],
  game: './agility/game.js',
  page: ['./agility/obstacles.js', './agility/page.js'],
  config: {
    group: 'agility',
    sections: [],
    items: [
      { key: 'showClickboxes', name: 'Show clickboxes', description: 'Show agility course and other obstacle clickboxes.', type: 'boolean', default: true, position: 0 },
      { key: 'showLapCount', name: 'Show lap count', description: 'Enable/disable the lap counter.', type: 'boolean', default: true, position: 1 },
      { key: 'lapTimeout', name: 'Hide lap count', description: 'Time until the lap counter hides/resets.', type: 'int', default: 5, unit: ' mins', position: 2 },
      { key: 'lapsToLevel', name: 'Show laps until goal', description: 'Show number of laps remaining until next goal is reached.', type: 'boolean', default: true, position: 3 },
      { key: 'lapsPerHour', name: 'Show laps per hour', description: 'Shows how many laps you can expect to complete per hour.', type: 'boolean', default: true, position: 4 },
      { key: 'overlayColor', method: 'getOverlayColor', name: 'Overlay color', description: 'Color of agility overlay.', type: 'color', alpha: true, default: '#FF00FF00', position: 5 },
      { key: 'highlightShortcuts', name: 'Highlight agility shortcuts', description: 'Enable/disable the highlighting of agility shortcuts.', type: 'boolean', default: true, position: 10 },
      { key: 'trapOverlay', method: 'showTrapOverlay', name: 'Show trap overlay', description: 'Enable/disable the highlighting of traps on agility courses.', type: 'boolean', default: true, position: 11 },
      { key: 'trapHighlight', method: 'getTrapColor', name: 'Trap overlay color', description: 'Color of agility trap overlay.', type: 'color', alpha: true, default: '#FFFF0000', position: 12 },
      { key: 'agilityArenaNotifier', method: 'notifyAgilityArena', name: 'Agility Arena notifier', description: 'Notify on ticket location change in Agility Arena.', type: 'notification', default: true, position: 13 },
      { key: 'agilityArenaTimer', method: 'showAgilityArenaTimer', name: 'Agility Arena timer', description: 'Configures whether Agility Arena timer is displayed.', type: 'boolean', default: true, position: 14 },
      { key: 'highlightStick', name: 'Highlight stick', description: 'Highlight the retrievable stick in the Werewolf Agility Course.', type: 'boolean', default: true, position: 15 },
      { key: 'stickHighlightColor', name: 'Stick highlight color', description: 'Color of highlighted stick.', type: 'color', alpha: true, default: '#FFFF0000', position: 16 },
    ],
  },
};
