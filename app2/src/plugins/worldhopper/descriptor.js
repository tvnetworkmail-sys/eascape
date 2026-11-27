'use strict';
// RuneLite's World Hopper plugin (net.runelite.client.plugins.worldhopper), cloned 1:1: WorldHopperConfig.
// Era-trimmed to Sept 2007: the region filter keeps the regions with worlds then (U.K., USA, Australia), the world
// type filter keeps NORMAL (PvP, Deadman, seasonal, speedrunning, fresh start, total level, high risk and Bounty
// Hunter worlds are all later). The world list is our server's own (app main/worlds.js), not Jagex's.
const REGIONS = [
  { value: 'AUSTRALIA', label: 'AUSTRALIA' },
  { value: 'UNITED_KINGDOM', label: 'U.K.' },
  { value: 'UNITED_STATES', label: 'USA' },
];

module.exports = {
  id: 'worldhopper',
  name: 'World Hopper',
  description: 'Allows you to quickly hop worlds',
  tags: ['ping', 'switcher'],
  enabledByDefault: true,
  game: './worldhopper/game.js',
  page: './worldhopper/page.js',
  resources: ['icon.png', 'arrow_down.png', 'flag_aus.png', 'flag_uk.png', 'flag_us.png', 'flag_us_east.png', 'flag_us_west.png'],
  config: {
    group: 'worldhopper',
    sections: [],
    items: [
      { key: 'previousKey', name: 'Quick-hop previous', description: "When you press this key you'll hop to the previous world.", type: 'hotkey', default: 'Ctrl+Shift+ArrowLeft', position: 0 },
      { key: 'nextKey', name: 'Quick-hop next', description: "When you press this key you'll hop to the next world.", type: 'hotkey', default: 'Ctrl+Shift+ArrowRight', position: 1 },
      { key: 'quickhopOutOfDanger', name: 'Quick-hop out of dangerous worlds', description: "Don't hop to a PvP/high risk world when quick-hopping.", type: 'boolean', default: true, position: 2 },
      { key: 'showSidebar', name: 'Show world switcher sidebar', description: 'Show sidebar containing all worlds that mimics in-game interface.', type: 'boolean', default: true, position: 4 },
      { key: 'ping', name: 'Show world ping', description: 'Shows ping to each game world.', type: 'boolean', default: true, position: 5 },
      { key: 'showMessage', method: 'showWorldHopMessage', name: 'Show world hop message in chat', description: 'Shows what world is being hopped to in the chat.', type: 'boolean', default: true, position: 6 },
      { key: 'menuOption', name: 'Show hop-to menu option', description: 'Adds Hop-to menu option to the friends list and friends chat members list.', type: 'boolean', default: true, position: 7 },
      { key: 'subscriptionFilter', name: 'Subscription filter', description: 'Only show free worlds, member worlds, or both types of worlds in sidebar.', type: 'enum', default: 'BOTH', options: [{ value: 'BOTH', label: 'BOTH' }, { value: 'FREE', label: 'FREE' }, { value: 'MEMBERS', label: 'MEMBERS' }], position: 8 },
      { key: 'regionFilter', name: 'Region filter', description: 'Only show and quick-hop to worlds in specific regions.', type: 'enumset', default: '', options: REGIONS, position: 9 },
      { key: 'worldTypeFilter', name: 'World type filter', description: 'Only show worlds of specific types.', type: 'enumset', default: '', options: [{ value: 'NORMAL', label: 'NORMAL' }], position: 10 },
      { key: 'displayPing', name: 'Display current ping', description: 'Displays ping to current game world.', type: 'boolean', default: false, position: 11 },
    ],
  },
};
