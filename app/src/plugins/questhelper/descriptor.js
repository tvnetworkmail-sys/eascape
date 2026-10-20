'use strict';
// Quest Helper: step-by-step quest guides that follow your progress, with the NPC or object
// to use highlighted, a walking route to it, the game's hint arrow and the dialogue option
// to pick. Port of RuneLite's Quest Helper (BSD 2-Clause, Copyright (c) 2020, Zoinkwiz),
// built for Lost City's 2004 quests. Lost City doesn't send quest progress to the game, so
// LostLite follows it from the quest list, the quest journal and conversations, and keeps
// it on this computer, per account.
module.exports = {
  id: 'questhelper',
  name: 'Quest Helper',
  description: 'Step-by-step quest guides with highlights and walking routes',
  tags: ['quest', 'helper', 'guide', 'steps', 'route', 'path', 'walk', 'journal'],
  enabledByDefault: true,
  game: './questhelper/game.js',
  page: './questhelper/page.js',
  config: {
    group: 'questhelper',
    sections: [
      { key: 'overlay', name: 'Overlays', position: 0 },
    ],
    items: [
      { key: 'autoStart', name: 'Auto start helpers', description: 'Start guiding a quest as soon as you start it (or move it on) in game', type: 'boolean', default: true, position: 0 },
      { key: 'showRoute', name: 'Walking route', description: 'Draw the way to the next step on the ground', type: 'boolean', default: true, section: 'overlay', position: 1 },
      { key: 'showMapRoute', name: 'Route on the world map', description: 'Draw the route and the next step on the world map', type: 'boolean', default: true, section: 'overlay', position: 2 },
      { key: 'hintArrow', name: 'Hint arrow', description: 'Point the game\'s yellow arrow at the next NPC, object or spot', type: 'boolean', default: true, section: 'overlay', position: 3 },
      { key: 'highlight', name: 'Highlight targets', description: 'Outline the NPC, object or item to use', type: 'boolean', default: true, section: 'overlay', position: 4 },
      { key: 'markOptions', name: 'Highlight dialogue options', description: 'Show the option to pick in green', type: 'boolean', default: true, section: 'overlay', position: 5 },
      // DEV / TESTING ONLY - remove (with its code in page.js and game.js) when testing is done
      { key: 'devMarkDone', name: 'Dev: "Mark done" on the quest list', description: 'TESTING ONLY: right-click a quest in the quest list to mark it complete (::questdone, server test mode). To be removed when testing is done.', type: 'boolean', default: true, position: 7 },
      { key: 'colour', name: 'Highlight colour', description: 'Colour of the outlines and the route', type: 'color', default: '#00FFFF', section: 'overlay', position: 6 },
    ],
  },
};
