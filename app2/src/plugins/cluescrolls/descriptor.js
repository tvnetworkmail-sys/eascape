'use strict';
// RuneLite's Clue Scroll (net.runelite.client.plugins.cluescrolls), cloned 1:1 and trimmed to the treasure trails of
// Sept 2007 (easy, medium and hard): ClueScrollConfig. RuneLite has no sidebar panel for it: the clue's answer is the
// Clue Scroll overlay, with the world overlay, the emote tab highlight, the hint arrow and the world map point.
module.exports = {
  id: 'cluescrolls',
  name: 'Clue Scroll',
  description: 'Show answers to clue scroll riddles, anagrams, ciphers, and cryptic clues',
  tags: ['arrow', 'hints', 'world', 'map', 'coordinates', 'emotes'],
  enabledByDefault: true,
  game: './cluescrolls/game.js',
  page: ['./cluescrolls/data.js', './cluescrolls/page.js'],
  resources: ['emote.png', 'clue_arrow.png'],
  config: {
    group: 'cluescroll',
    sections: [],
    items: [
      { key: 'displayHintArrows', name: 'Display hint arrows', description: 'Configures whether or not to display hint arrows for clues.', type: 'boolean', default: true, position: -1 },
      { key: 'identify', name: 'Identify', description: 'Identify clue scrolls when read, picked up, or always on pickup. Does not work for beginner or master clues.', type: 'enum', default: 'ON_READ', options: [{ value: 'ON_READ', label: 'ON_READ' }, { value: 'IF_INACTIVE', label: 'IF_INACTIVE' }, { value: 'ON_PICKUP', label: 'ON_PICKUP' }], position: -1 },
    ],
  },
};
