'use strict';
// Port of RuneLite's HiScore plugin (net.runelite.client.plugins.hiscore, BSD 2-Clause; see
// ui/assets/RUNELITE-LICENSE.txt): a panel to look up a player's hiscores, and a Lookup option
// on players' right-click menus and on the chat and friends list names. Names, wording and
// defaults from HiscoreConfig. EASCape has one hiscore (no ironman, deadman or league
// endpoints), served by the game server (engine/src/engine/Hiscores.ts); no bounty hunter and
// no autocomplete (the 2006 game has neither the minigame nor RuneLite's name list).
module.exports = {
  id: 'hiscore',
  name: 'HiScore',
  description: 'Enable the HiScore panel and an optional Lookup option on players',
  tags: ['panel', 'players'],
  enabledByDefault: true,
  game: './hiscore/game.js',
  page: './hiscore/page.js',
  config: {
    group: 'hiscore',
    sections: [],
    items: [
      { key: 'playerOption', name: 'Player option', description: 'Add Lookup option to players.', type: 'boolean', default: true, position: 0 },
      { key: 'menuOption', name: 'Menu option', description: 'Show Lookup option in menus.', type: 'boolean', default: true, position: 1 },
      { key: 'virtualLevels', name: 'Display virtual levels', description: 'Display levels over 99 in the hiscore panel.', type: 'boolean', default: true, position: 2 },
    ],
  },
};
