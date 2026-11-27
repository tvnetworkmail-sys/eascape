'use strict';
// RuneLite's Pyramid Plunder plugin (net.runelite.client.plugins.pyramidplunder), cloned 1:1 for content
// the server doesn't have yet (the 2007 cache does; see page.js).
module.exports = {
  id: 'pyramidplunder',
  name: 'Pyramid Plunder',
  description: 'Show custom overlay for Pyramid Plunder',
  tags: ['minigame', 'thieving', 'pp'],
  enabledByDefault: false,
  game: './pyramidplunder/game.js',
  page: './pyramidplunder/page.js',
  config: {
    group: 'pyramidplunder',
    sections: [],
    items: [
      { key: 'hideTimer', name: 'Hide default timer', description: 'Hides the default pyramid plunder timer.', type: 'boolean', default: true, position: 0 },
      { key: 'showExactTimer', name: 'Show exact timer', description: 'Displays the amount of time remaining as an infobox.', type: 'boolean', default: true, position: 1 },
      { key: 'timerLowWarning', name: 'Timer low warning', description: 'Determines the time when the timers color will change.', type: 'int', default: 30, position: 2 },
      { key: 'highlightDoorsColor', name: 'Highlight doors', description: 'Selects the color for highlighting tomb doors.', type: 'color', alpha: true, default: '#FF00FF00', position: 3 },
      { key: 'highlightDoors', name: 'Highlight doors', description: 'Highlights the four tomb doors in each room.', type: 'boolean', default: true, position: 4 },
      { key: 'highlightSpeartrapColor', method: 'highlightSpeartrapsColor', name: 'Highlight speartrap', description: 'Selects the color for highlighting speartraps.', type: 'color', alpha: true, default: '#FFFFC800', position: 5 },
      { key: 'highlightSpeartraps', name: 'Highlight speartraps', description: 'Highlight the spear traps at the entrance of each room.', type: 'boolean', default: true, position: 6 },
      { key: 'highlightContainersColor', name: 'Highlight containers', description: 'Selects the color for highlighting urns, chests and sarcophagus.', type: 'color', alpha: true, default: '#FFFFFF00', position: 7 },
      { key: 'highlightUrnsFloor', name: 'Highlight urns floor', description: 'Highlight the urns starting at selected floor and up.', type: 'int', default: 9, position: 8 },
      { key: 'highlightedChestFloor', method: 'highlightChestFloor', name: 'Highlight chest floor', description: 'Highlight the grand gold chest starting at selected floor and up.', type: 'int', default: 9, position: 9 },
      { key: 'highlightedSarcophagusFloor', method: 'highlightSarcophagusFloor', name: 'Highlight sarcophagus floor', description: 'Highlight the sarcophagus starting at selected floor and up.', type: 'int', default: 9, position: 10 },
    ],
  },
};
