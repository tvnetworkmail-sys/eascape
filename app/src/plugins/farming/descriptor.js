'use strict';
// EASCape's Farming tracker: after RuneLite's Time Tracking plugin, farming part (BSD 2-Clause,
// Copyright (c) 2018 Abex and RuneLite contributors). Its sidebar panel lists every patch:
// what's in it, how it's doing and about when it's grown, kept while you're logged out too.
// The patches and their states are our own (tools/farming/app_export.py writes patches.json
// from the server's farming data); the client already gets every patch's state from the
// server, so the tracker reads those and remembers them per account.
module.exports = {
  id: 'farming',
  name: 'Farming Tracker',
  description: 'Keep track of your farming patches in the sidebar',
  tags: ['farming', 'patch', 'patches', 'herb', 'allotment', 'flower', 'hops', 'time', 'tracking', 'timer'],
  enabledByDefault: true,
  game: './farming/game.js',
  page: './farming/page.js',
  config: {
    group: 'farming',
    sections: [],
    items: [
      { key: 'notify', name: 'Notify when grown', description: 'Send a notification when a patch you planted is fully grown', type: 'boolean', default: false, position: 0 },
    ],
  },
};
