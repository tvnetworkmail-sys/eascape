'use strict';
// RuneLite's XP Drop plugin (net.runelite.client.plugins.xpdrop), cloned 1:1 over the core's OSRS-style XP drops
// (runelite/core2007.js).
// Era deviation: enabledByDefault is false here, while RuneLite's XP Drop is on by default. 2007 had no XP drops or XP
// counter, so the core's OSRS-style counter and drops only exist while this plugin is enabled, and their settings (the
// OSRS XP orb's Setup, which 2007 lacks) are this plugin's "2007RS" section.
module.exports = {
  id: 'xpdrop',
  name: 'XP Drop',
  description: 'Enable customization of the way XP drops are displayed',
  tags: ['experience', 'levels', 'tick', 'prayer', 'xpdrop'],
  enabledByDefault: false,
  game: './xpdrop/game.js',
  page: './xpdrop/page.js',
  config: {
    group: 'xpdrop',
    sections: [{ key: 'eascape2007', name: '2006RS-2', description: "The OSRS game's XP counter and drops (set from OSRS's XP orb, which 2007 lacks).", position: 10 }],
    items: [
      { key: 'hideSkillIcons', name: 'Hide skill icons', description: 'Configure if XP drops will show their respective skill icons.', type: 'boolean', default: false, position: 0 },
      { key: 'standardColor', name: 'Standard color', description: 'XP drop color when no prayer is active.', type: 'color', default: null, position: 1 },
      { key: 'meleePrayerColor', method: 'getMeleePrayerColor', name: 'Melee prayer color', description: 'XP drop color when a melee prayer is active.', type: 'color', default: '#FF1580AD', position: 2 },
      { key: 'rangePrayerColor', method: 'getRangePrayerColor', name: 'Range prayer color', description: 'XP drop color when a range prayer is active.', type: 'color', default: '#FF1580AD', position: 3 },
      { key: 'magePrayerColor', method: 'getMagePrayerColor', name: 'Mage prayer color', description: 'XP drop color when a mage prayer is active.', type: 'color', default: '#FF1580AD', position: 4 },
      { key: 'fakeXpDropDelay', name: 'Fake XP drop delay', description: 'Configures how many ticks should pass between fake XP drops, 0 to disable.', type: 'int', default: 0, min: 0, unit: 'ticks', position: 5 },
      // 2007RS: the OSRS game's XP counter and drops (core2007.js), only while this plugin is on
      { key: 'xpDropsEnabled', name: 'Show XP drops', description: "Show the XP counter and XP drops (the OSRS XP orb's toggle).", type: 'boolean', default: true, section: 'eascape2007', position: 50 },
      { key: 'xpDropsPosition', name: 'Position', description: 'Where the XP counter and drops are.', type: 'enum', default: 'RIGHT', options: [{ value: 'RIGHT', label: 'Right' }, { value: 'CENTRE', label: 'Middle' }, { value: 'LEFT', label: 'Left' }], section: 'eascape2007', position: 51 },
      { key: 'xpDropsSize', name: 'Size', description: 'The size of the XP drops.', type: 'enum', default: 'LARGEST', options: [{ value: 'SMALLEST', label: 'Smallest' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LARGEST', label: 'Largest' }], section: 'eascape2007', position: 52 },
      { key: 'xpDropsDuration', name: 'Duration', description: 'How long the XP drops take to reach the counter.', type: 'enum', default: 'DEFAULT', options: [{ value: 'DEFAULT', label: 'Default' }, { value: 'LONGER', label: 'Longer' }, { value: 'LONGEST', label: 'Longest' }], section: 'eascape2007', position: 53 },
      { key: 'xpDropsCounter', name: 'Counter', description: 'What the XP counter shows.', type: 'enum', default: 'TOTAL', options: [{ value: 'TOTAL', label: 'Total XP' }, { value: 'RECENT', label: 'Most recent skill' }, { value: 'OFF', label: 'Off' }], section: 'eascape2007', position: 54 },
      { key: 'xpDropsColour', name: 'Colour', description: 'The colour of the XP drops and counter.', type: 'enum', default: 'WHITE', options: [['WHITE', 'White'], ['LILAC', 'Lilac'], ['CYAN', 'Cyan'], ['JADE', 'Jade'], ['LIME', 'Lime'], ['YELLOW', 'Yellow'], ['ORANGE', 'Orange'], ['PINK', 'Pink']].map(([value, label]) => ({ value, label })), section: 'eascape2007', position: 55 },
      { key: 'xpDropsGroup', name: 'Group', description: 'Show the XP gained in several skills in one tick as one drop.', type: 'boolean', default: true, section: 'eascape2007', position: 56 },
    ],
  },
};
