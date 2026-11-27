'use strict';
// RuneLite's Loot Tracker plugin (net.runelite.client.plugins.loottracker), cloned 1:1: LootTrackerConfig.
// Prices (prices: true) only with the core's price switch (runelite.showPrices, off until the game has a market).
// Trimmed for Sept 2007: no raids (2017), so no "Show chat message for raids loot".
module.exports = {
  id: 'loottracker',
  name: 'Loot Tracker',
  description: 'Tracks loot from monsters and minigames',
  tags: ['drops'],
  enabledByDefault: true,
  game: './loottracker/game.js',
  page: './loottracker/page.js',
  config: {
    group: 'loottracker',
    sections: [{ key: 'ignored', name: 'Ignored entries', description: 'The ignored items and sources.', position: -2, closedByDefault: true }],
    items: [
      { key: 'ignoredItems', method: 'getIgnoredItems', name: 'Ignored items', description: 'Configures which items should be ignored when calculating loot prices.', type: 'string', default: '', section: 'ignored', position: -1 },
      { key: 'priceType', prices: true, name: 'Price type', description: 'What type of price to use for calculating value.', type: 'enum', default: 'GRAND_EXCHANGE', options: [{ value: 'GRAND_EXCHANGE', label: 'GRAND_EXCHANGE' }, { value: 'HIGH_ALCHEMY', label: 'HIGH_ALCHEMY' }], position: -1 },
      { key: 'showPriceType', prices: true, name: 'Show price type', description: 'Whether to show a GE: or HA: next to the total values in the tracker.', type: 'boolean', default: false, position: -1 },
      { key: 'syncPanel', method: 'rememberLoot', name: 'Remember loot', description: 'Saves loot between client sessions.', type: 'boolean', default: true, position: -1 },
      { key: 'ignoredEvents', method: 'getIgnoredEvents', name: 'Ignored loot sources', description: 'Hide specific NPCs or sources of loot in the loot tracker (e.g., goblin, barrows chest, H.A.M. member).', type: 'string', default: '', section: 'ignored', position: -1 },
      { key: 'npcKillChatMessage', prices: true, name: 'Show chat message for NPC kills', description: 'Adds a chat message with monster name and kill value when receiving loot from an NPC kill.', type: 'boolean', default: false, position: -1 },
      { key: 'pvpKillChatMessage', prices: true, name: 'Show chat message for PvP kills', description: 'Adds a chat message with player name and kill value when receiving loot from a player kill.', type: 'boolean', default: false, position: -1 },
    ],
  },
};
