'use strict';
// RuneLite's Slayer plugin (net.runelite.client.plugins.slayer), cloned 1:1: SlayerConfig.
// Trimmed for Sept 2007: no superior foes (2016), so no "Superior foe notification"; the "!task" command
// needs RuneLite's chat server (left out).
module.exports = {
  id: 'slayer',
  name: 'Slayer',
  description: 'Show additional slayer task related information',
  tags: ['combat', 'notifications', 'overlay', 'tasks'],
  enabledByDefault: true,
  game: './slayer/game.js',
  page: ['./slayer/data.js', './slayer/page.js'],
  config: {
    group: 'slayer',
    sections: [],
    items: [
      { key: 'infobox', method: 'showInfobox', name: 'Task infobox', description: 'Display task information in an infobox.', type: 'boolean', default: true, position: 1 },
      { key: 'itemoverlay', method: 'showItemOverlay', name: 'Count on items', description: 'Display task count remaining on slayer items.', type: 'boolean', default: true, position: 2 },
      { key: 'statTimeout', name: 'Infobox expiry', description: 'Set the time until the infobox expires.', type: 'int', default: 5, units: ' mins', position: 4 },
      { key: 'highlightHull', name: 'Highlight hull', description: 'Configures whether the NPC hull should be highlighted.', type: 'boolean', default: false, position: 5 },
      { key: 'highlightTile', name: 'Highlight tile', description: 'Configures whether the NPC tile should be highlighted.', type: 'boolean', default: false, position: 6 },
      { key: 'highlightOutline', name: 'Highlight outline', description: 'Configures whether or not the NPC outline should be highlighted.', type: 'boolean', default: false, position: 7 },
      { key: 'targetColor', method: 'getTargetColor', name: 'Target color', description: 'Color of the highlighted targets.', type: 'color', alpha: true, default: '#FFFF0000', position: 8 },
      { key: 'weaknessPrompt', name: 'Show monster weakness', description: 'Show an overlay on a monster when it is weak enough to finish off (only lizards, gargoyles, rockslugs & zygomites).', type: 'boolean', default: true, position: 9 },
    ],
  },
};
