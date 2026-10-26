'use strict';
// EASCape's Farming tracker: RuneLite's Time Tracking plugin, farming part (BSD 2-Clause,
// Copyright (c) 2018 Abex and RuneLite contributors): TimeTrackingPanel's tabs (Overview, then
// a tab per patch type with its item icon), FarmingTabPanel's patch boxes (the crop's icon,
// "Region (Patch)", "Done at 18:40" and the like, a thin progress bar in the crop state's
// colour, and a bell to be told when that patch is done). Names, wording and defaults are
// RuneLite's TimeTrackingConfig. The game here has allotments, flowers, herbs and hops (Farming
// step 1); the patches and states come from our own farming data (patches.json, written by
// tools/farming/app_export.py). Left out, as not in this game (yet): trees, fruit trees, bushes,
// special patches, bird houses, farming contracts, the clocks.
module.exports = {
  id: 'farming',
  name: 'Time Tracking',
  description: 'Enable the Time Tracking panel, which contains farming trackers',
  tags: ['time', 'tracking', 'farming', 'patch', 'patches', 'herb', 'allotment', 'flower', 'hops', 'timer'],
  enabledByDefault: true,
  game: './farming/game.js',
  page: './farming/page.js',
  config: {
    group: 'farming',
    sections: [],
    items: [
      { key: 'timeFormatMode', name: 'Time format', description: 'What format to display times in', type: 'enum', default: 'ABSOLUTE_24H', options: [{ value: 'RELATIVE', label: 'Relative' }, { value: 'ABSOLUTE_12H', label: '12 Hour' }, { value: 'ABSOLUTE_24H', label: '24 Hour' }], position: 1 },
    ],
  },
};
