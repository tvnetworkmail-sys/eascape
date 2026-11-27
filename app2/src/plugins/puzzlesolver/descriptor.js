'use strict';
// RuneLite's Puzzle Solver plugin (net.runelite.client.plugins.puzzlesolver), cloned. Era-trim: the clue sliding
// puzzle boxes and Monkey Madness's reinitialisation puzzle (IDAStarMM); no light box (Elemental Workshop II) and no
// Varrock museum quiz.
module.exports = {
  id: 'puzzlesolver',
  name: 'Puzzle Solver',
  description: 'Show you where to click to solve puzzle boxes',
  tags: ['clues', 'scrolls', 'overlay'],
  enabledByDefault: true,
  game: './puzzlesolver/game.js',
  page: './puzzlesolver/page.js',
  config: {
    group: 'puzzlesolver',
    sections: [],
    items: [
      { key: 'displaySolution', name: 'Display solution', description: 'Display a solution to the puzzle.', type: 'boolean', default: true, position: 0 },
      { key: 'displayRemainingMoves', name: 'Display remaining moves', description: 'Add a text line above puzzle boxes displaying the amount of remaining moves.', type: 'boolean', default: true, position: 1 },
      { key: 'drawDots', name: 'Draw dots instead of arrows', description: 'Draw dots increasing in size instead of arrows for the solution.', type: 'boolean', default: true, position: 2 },
      { key: 'movesToShow', name: 'Number of dots', description: 'The number of moves as dots to show for the puzzle.', type: 'int', default: 4, min: 4, max: 8, position: 3 },
      { key: 'dotColor', name: 'Dot start color', description: 'Dot color for the first solution dot.', type: 'color', default: '#FFFFFF00', position: 4 },
      { key: 'dotEndColor', name: 'Dot end color', description: 'Dot color of the last solution dot that dots blend towards.', type: 'color', default: '#FFFF0000', position: 5 },
    ],
  },
};
