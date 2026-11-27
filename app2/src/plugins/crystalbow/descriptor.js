'use strict';
// EASCape: Crystal Bow (ours, your call 31 Oct 2026; RuneLite has no such plugin). A warning a
// few shots before the crystal bow you wield goes down a tenth (every 250 shots it loses 1/10th
// of its strength, and after the last tenth it reverts to a seed). The server sends the shots
// used in the present tenth as varp 801 (crystal_bow_shots, crystal_equipment.rs2).
module.exports = {
  id: 'crystalbow',
  name: 'Crystal Bow',
  description: 'Warn before your crystal bow loses a tenth of its charges',
  tags: ['crystal', 'bow', 'charges', 'degrade', 'roving', 'elves', 'warning'],
  enabledByDefault: true,
  game: './crystalbow/game.js',
  page: './crystalbow/page.js',
  config: {
    group: 'crystalbow',
    sections: [],
    items: [
      { key: 'warnAt', name: 'Warn at shots left', description: 'Warn when this many shots are left before the bow goes down a tenth.', type: 'int', default: 10, position: 1 },
      { key: 'notify', name: 'Notification', description: 'Also send a desktop notification, not just a chat message.', type: 'boolean', default: true, position: 2 },
    ],
  },
};
