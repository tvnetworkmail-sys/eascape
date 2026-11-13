'use strict';
// Puzzle Solver (ours, after RuneLite's Puzzle Solver plugin): solves Monkey Madness's sliding
// puzzle (the reinitialisation panel in the hangar) and marks the next piece to click until the
// picture is done. The Treasure Trail puzzle boxes are solved by the Clue Scroll plugin.
module.exports = {
  id: 'puzzlesolver',
  name: 'Puzzle Solver',
  description: "Shows the next piece to click on Monkey Madness's sliding puzzle (puzzle boxes: Clue Scroll plugin)",
  tags: ['puzzle', 'sliding', 'monkey madness', 'solver', 'quest'],
  enabledByDefault: true,
  game: './puzzlesolver/game.js',
  page: './puzzlesolver/page.js',
  config: {
    group: 'puzzlesolver',
    sections: [],
    items: [
      { key: 'colour', name: 'Highlight colour', description: 'The colour of the box round the next piece to click.', type: 'color', default: '#00FF00', position: 1 },
      { key: 'movesLeft', name: 'Show moves left', description: 'Show how many clicks are left on the next piece.', type: 'boolean', default: true, position: 2 },
    ],
  },
};
