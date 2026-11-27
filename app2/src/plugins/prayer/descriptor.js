'use strict';
// RuneLite's Prayer plugin (net.runelite.client.plugins.prayer), cloned 1:1 and era-trimmed (no Sanfew serum, Chivalry,
// Piety and later prayers; no prayer reordering: the 2007 prayer tab is an if1 interface with no drag).
const LOCATIONS = [{ value: 'NONE', label: 'NONE' }, { value: 'PRAYER_ORB', label: 'PRAYER_ORB' }, { value: 'PRAYER_BAR', label: 'PRAYER_BAR' }, { value: 'BOTH', label: 'BOTH' }];
module.exports = {
  id: 'prayer',
  name: 'Prayer',
  description: 'Show various information related to prayer',
  tags: ['combat', 'flicking', 'overlay'],
  enabledByDefault: true,
  game: './prayer/game.js',
  page: './prayer/page.js',
  config: {
    group: 'prayer',
    sections: [],
    items: [
      { key: 'prayerFlickLocation', name: 'Pray flick location', description: 'Choose where to display the prayer flick helper.', type: 'enum', default: 'NONE', options: LOCATIONS, position: 0 },
      { key: 'prayerFlickColor', name: 'Pray flick color', description: 'Color of the flick helper on the prayer orb and prayer bar.', type: 'color', alpha: true, default: '#FF00FFFF', position: 1 },
      { key: 'prayerFlickAlwaysOn', name: 'Never hide prayer flick helper', description: "Show prayer flick helper regardless of if you're praying or not.", type: 'boolean', default: false, position: 2 },
      { key: 'prayerIndicator', name: 'Boost indicator', description: 'Enable infoboxes for prayers.', type: 'boolean', default: false, position: 3 },
      { key: 'prayerIndicatorOverheads', name: 'Overhead indicator', description: 'Also enable infoboxes for overheads.', type: 'boolean', default: false, position: 4 },
      { key: 'showPrayerDoseIndicator', name: 'Show prayer dose indicator', description: 'Enables the prayer dose indicator.', type: 'boolean', default: true, position: 5 },
      { key: 'prayerDoseOrbStartColor', name: 'Dose indicator color', description: 'Color of the flashing ring around the prayer orb when a potion should be drank.', type: 'color', alpha: true, default: '#FF00FFFF', position: 6 },
      { key: 'showPrayerTooltip', method: 'showPrayerStatistics', name: 'Show prayer orb tooltip', description: 'Displays time remaining and prayer bonus as a tooltip on the quick-prayer icon.', type: 'boolean', default: true, position: 7 },
      { key: 'showPrayerBar', name: 'Show prayer bar', description: 'Displays prayer bar under HP bar when praying.', type: 'boolean', default: false, position: 8 },
      { key: 'prayerBarHideIfNotPraying', method: 'hideIfNotPraying', name: 'Hide bar while prayer is inactive', description: 'Prayer bar will be hidden while prayers are inactive.', type: 'boolean', default: true, position: 9 },
      { key: 'prayerBarHideIfNonCombat', method: 'hideIfOutOfCombat', name: 'Hide bar while out-of-combat', description: 'Prayer bar will be hidden while out-of-combat.', type: 'boolean', default: false, position: 10 },
      { key: 'replaceOrbText', name: 'Show time left', description: 'Show time remaining of current prayers in the prayer orb.', type: 'boolean', default: false, position: 11 },
    ],
  },
};
