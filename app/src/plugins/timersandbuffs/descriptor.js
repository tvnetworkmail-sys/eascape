'use strict';
// Port of RuneLite's Timers & Buffs for the timers the 2004 game has (sections, names,
// descriptions and defaults from TimersAndBuffsConfig). Shown as info boxes.
module.exports = {
  id: 'timersandbuffs',
  name: 'Timers & Buffs',
  description: 'Show various timers and buffs in an infobox',
  tags: ['timers', 'buffs', 'antifire', 'antipoison', 'charge', 'freeze', 'bind', 'snare', 'entangle', 'stun', 'potion', 'infobox'],
  enabledByDefault: true,
  game: './timersandbuffs/game.js',
  page: './timersandbuffs/page.js',
  // also listed in the Info Boxes sidebar tab
  infoboxes: ['showAntipoison', 'showAntiFire', 'showCharge', 'showFreezes', 'showPickpocketStun'],
  config: {
    group: 'timersandbuffs',
    sections: [
      { key: 'consumablesSection', name: 'Potions & consumables', position: 1 },
      { key: 'spellsSection', name: 'Spells', position: 2 },
      { key: 'miscellaneousSection', name: 'Miscellaneous', position: 3 },
    ],
    items: [
      { key: 'showAntipoison', name: 'Antipoison timers', description: 'Configures whether timers for poison protection are displayed.', type: 'boolean', default: true, section: 'consumablesSection', position: 0 },
      { key: 'showAntiFire', name: 'Antifire timer', description: 'Configures whether antifire timer is displayed.', type: 'boolean', default: true, section: 'consumablesSection', position: 1 },
      { key: 'showCharge', name: 'Charge timer', description: 'Configures whether to show a timer for the charge spell.', type: 'boolean', default: true, section: 'spellsSection', position: 0 },
      { key: 'showFreezes', name: 'Freeze timer', description: 'Configures whether freeze timer is displayed.', type: 'boolean', default: true, section: 'miscellaneousSection', position: 0 },
      { key: 'showPickpocketStun', name: 'Pickpocket stun timer', description: 'Configures whether pickpocket stun timer is displayed.', type: 'boolean', default: true, section: 'miscellaneousSection', position: 1 },
    ],
  },
};
