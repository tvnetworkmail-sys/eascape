'use strict';
// XP drops: a total XP counter in the top right of the game view, and each gain rising up
// to it with the skill's icon, like the modern game's XP drops that RuneLite's XP Drop plugin
// builds on. Drawn into the game view with the 2004 game's stat icons and bold font.
module.exports = {
  id: 'xpdrops',
  name: 'XP Drops',
  description: 'Floating XP drops when you gain experience',
  tags: ['xp', 'experience', 'drop', 'drops', 'skill', 'skills', 'exp'],
  enabledByDefault: true,
  game: './xpdrops/game.js',
  page: './xpdrops/page.js',
  config: {
    group: 'xpdrops',
    sections: [],
    items: [
      { key: 'showIcons', name: 'Show skill icons', description: 'Show the skill icon next to each drop', type: 'boolean', default: true, position: 0 },
      { key: 'colour', name: 'Drop colour', description: 'Colour of the XP drop text', type: 'color', default: '#FFFFFF', position: 1 },
      { key: 'duration', name: 'Drop time', description: 'How long each drop takes to rise to the counter, in milliseconds', type: 'int', default: 2000, min: 500, max: 10000, position: 2 },
      { key: 'showCounter', name: 'XP counter', description: 'Show your total XP in a box in the top right of the game view', type: 'boolean', default: true, position: 4 },
      { key: 'groupDrops', name: 'Group drops', description: 'Show XP gained in several skills at once (like attack and hitpoints) as one drop', type: 'boolean', default: true, position: 3 },
    ],
  },
};
