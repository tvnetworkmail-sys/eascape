'use strict';
// Port of RuneLite's Opponent Information: the name and health bar of what you're fighting,
// at the top left of the game view (names, defaults and wording from OpponentInfoConfig).
module.exports = {
  id: 'opponentinfo',
  name: 'Opponent Information',
  description: 'Show name and hitpoints information about the NPC you are fighting',
  tags: ['combat', 'health', 'hitpoints', 'npc', 'overlay', 'opponent', 'hp', 'target'],
  enabledByDefault: true,
  game: './opponentinfo/game.js',
  page: './opponentinfo/page.js',
  config: {
    group: 'opponentinfo',
    sections: [],
    items: [
      { key: 'hitpointsDisplayStyle', name: 'Display style', description: "Show opponent's hitpoints as a value (if known), percentage, or both.", type: 'enum', default: 'hitpoints', options: [{ value: 'hitpoints', label: 'Hitpoints' }, { value: 'percentage', label: 'Percentage' }, { value: 'both', label: 'Both' }], position: 1 },
      { key: 'showOpponentHealthOverlay', name: 'Show opponent health overlay', description: 'Shows a health bar overlay.', type: 'boolean', default: true, position: 3 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of this plugin\'s panel on the game view, in percent (100 is RuneLite\'s size). Info Boxes > Layout > Panel size sizes every panel at once.', type: 'int', default: 100, min: 50, max: 300, unit: '%', position: 99 },
    ],
  },
};
