'use strict';
// Port of RuneLite's Clue Scroll plugin for the 2004 treasure trails (revision 274: map,
// riddle, anagram, coordinate and challenge clues, puzzle boxes). The clue list is built
// from Lost City's content by tools/clues/extract.py.
module.exports = {
  id: 'cluescroll',
  name: 'Clue Scroll',
  description: 'Shows the answer to the clue scroll you are carrying, with highlights, the hint arrow and a world map marker',
  tags: ['clue', 'scroll', 'treasure', 'trail', 'arrow', 'hint', 'world', 'map', 'coordinates', 'anagram', 'riddle', 'puzzle'],
  enabledByDefault: true,
  game: './cluescroll/game.js',
  page: './cluescroll/page.js',
  config: {
    group: 'cluescroll',
    sections: [],
    items: [
      { key: 'displayHintArrows', name: 'Display hint arrows', description: 'Point the game\'s hint arrow at the clue\'s NPC or spot', type: 'boolean', default: true, position: 0 },
      { key: 'highlight', name: 'Highlight NPC or spot', description: 'Outline the NPC to talk to, or the tile to dig or search', type: 'boolean', default: true, position: 1 },
      { key: 'showOnMap', name: 'Show on world map', description: 'Mark where to go on the world map', type: 'boolean', default: true, position: 2 },
      { key: 'solvePuzzle', name: 'Puzzle solver', description: 'When a puzzle box is open, show the next piece to click', type: 'boolean', default: true, position: 3 },
      { key: 'highlightColor', name: 'Highlight color', description: 'Colour of the outlines', type: 'color', default: '#FF9040', position: 4 },
    ],
  },
};
