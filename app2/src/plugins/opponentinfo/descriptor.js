'use strict';
// RuneLite's Opponent Information (net.runelite.client.plugins.opponentinfo), cloned 1:1:
// OpponentInfoConfig. Trimmed: PlayerComparisonOverlay and player hitpoints need Jagex's hiscores,
// so "Lookup players on interaction" has no effect here; there's no boss HP HUD in 2007.
module.exports = {
  id: 'opponentinfo',
  name: 'Opponent Information',
  description: 'Show name and hitpoints information about the NPC you are fighting',
  tags: ['combat', 'health', 'hitpoints', 'npcs', 'overlay'],
  enabledByDefault: true,
  game: './opponentinfo/game.js',
  page: './opponentinfo/page.js',
  config: {
    group: 'opponentinfo',
    sections: [],
    items: [
      { key: 'lookupOnInteraction', name: 'Lookup players on interaction', description: 'Display a combat stat comparison panel on player interaction. (Follow, Trade, Challenge, Attack, etc.)', type: 'boolean', default: false, position: 0 },
      { key: 'hitpointsDisplayStyle', name: 'Display style', description: "Show opponent's hitpoints as a value (if known), percentage, or both.", type: 'enum', default: 'HITPOINTS', options: [{ value: 'HITPOINTS', label: 'Hitpoints' }, { value: 'PERCENTAGE', label: 'Percentage' }, { value: 'BOTH', label: 'Both' }], position: 1 },
      { key: 'showOpponentsInMenu', name: 'Show opponents in menu', description: 'Marks opponents names in the menu which you are attacking or are attacking you (NPC only).', type: 'boolean', default: false, position: 3 },
      { key: 'showOpponentHealthOverlay', name: 'Show opponent health overlay', description: 'Shows a health bar overlay when a boss health overlay is not present.', type: 'boolean', default: true, position: 4 },
    ],
  },
};
