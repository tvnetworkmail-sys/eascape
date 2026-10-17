'use strict';
// Port of RuneLite's Loot Tracker: what each monster (or player) you kill drops, and its other
// sources (clues, pickpocketing, caskets, bird nests, chests, Trawler, Barrows, Miscellania),
// added up per source in its own sidebar tab (names, defaults and wording from
// LootTrackerConfig). No prices: the
// 2004 game has no way to know what an item is really worth (no Grand Exchange).
module.exports = {
  id: 'loottracker',
  name: 'Loot Tracker',
  description: 'Tracks loot from monsters and minigames',
  tags: ['drops', 'loot', 'tracker', 'kills'],
  enabledByDefault: true,
  game: './loottracker/game.js',
  page: './loottracker/page.js',
  config: {
    group: 'loottracker',
    sections: [],
    items: [
      { key: 'syncPanel', name: 'Remember loot', description: 'Saves loot between client sessions.', type: 'boolean', default: true, position: 3 },
    ],
  },
};
