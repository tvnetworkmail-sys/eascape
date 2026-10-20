'use strict';
// Slayer: RuneLite's Slayer plugin (BSD 2-Clause, Copyright (c) 2017, Tyler <https://github.com/tylerthardy>
// and RuneLite contributors) for the 2006 game. The server sends your task and how many are
// left (varps slayer_target and slayer_count), so the plugin always knows it; RuneLite has
// to read it from the chat and the game's own varps. Names, wording and defaults are
// RuneLite's SlayerConfig. Left out, as after May 2006: superior Slayer monsters, Slayer
// points and task streaks; and the "outline" highlight (this client draws hulls and tiles).
module.exports = {
  id: 'slayer',
  name: 'Slayer',
  description: 'Show additional slayer task related information',
  tags: ['slayer', 'task', 'gem', 'combat', 'highlight', 'weakness', 'infobox'],
  enabledByDefault: true,
  game: './slayer/game.js',
  page: './slayer/page.js',
  config: {
    group: 'slayer',
    sections: [],
    items: [
      { key: 'infobox', name: 'Task infobox', description: 'Display task information in an infobox.', type: 'boolean', default: true, position: 1 },
      { key: 'itemoverlay', name: 'Count on items', description: 'Display task count remaining on slayer items.', type: 'boolean', default: true, position: 2 },
      { key: 'statTimeout', name: 'Infobox expiry', description: 'Set the time until the infobox expires.', type: 'int', default: 5, min: 0, max: 1440, unit: ' mins', position: 4 },
      { key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether the NPC hull should be highlighted.', type: 'boolean', default: false, position: 5 },
      { key: 'highlightTile', name: 'Highlight tile', description: 'Configures whether the NPC tile should be highlighted.', type: 'boolean', default: false, position: 6 },
      { key: 'targetColor', name: 'Target color', description: 'Color of the highlighted targets.', type: 'color', default: '#FF0000', position: 8 },
      { key: 'weaknessPrompt', name: 'Show monster weakness', description: 'Show an overlay on a monster when it is weak enough to finish off (only lizards, gargoyles, rockslugs & zygomites).', type: 'boolean', default: true, position: 9 },
      { key: 'taskCommand', name: 'Task command', description: 'Configures whether the slayer task command is enabled: !task', type: 'boolean', default: true, position: 10 },
    ],
  },
};
