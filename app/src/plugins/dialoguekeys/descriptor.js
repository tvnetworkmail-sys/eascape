'use strict';
// Keyboard for NPC conversations, as in the modern game: Space for "Click here to continue"
// and the number keys for "Select an Option". One key press is one click on the game's own
// button, nothing more (holding a key doesn't repeat it). The option chosen stays lit, as a
// hovered option is, until the game answers, so a click or key press shows it was taken.
module.exports = {
  id: 'dialoguekeys',
  name: 'Dialogue Keys',
  description: 'Space to continue conversations, number keys to choose options',
  tags: ['dialogue', 'dialog', 'chat', 'npc', 'conversation', 'space', 'continue', 'options', 'keys', 'quest'],
  enabledByDefault: true,
  game: './dialoguekeys/game.js',
  page: './dialoguekeys/page.js',
  config: {
    group: 'dialoguekeys',
    sections: [],
    items: [
      { key: 'spaceContinue', name: 'Space to continue', description: 'Space presses "Click here to continue"', type: 'boolean', default: true, position: 0 },
      { key: 'numberOptions', name: 'Number keys choose options', description: 'Keys 1-5 pick the options in "Select an Option", top to bottom', type: 'boolean', default: true, position: 1 },
      { key: 'showNumbers', name: 'Show option numbers', description: 'Put "1.", "2." ... in front of each option', type: 'boolean', default: true, position: 2 },
      { key: 'highlightChoice', name: 'Light the chosen option', description: 'The option you click or press stays lit, like a hovered one, until the game answers', type: 'boolean', default: true, position: 3 },
    ],
  },
};
