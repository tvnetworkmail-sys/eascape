'use strict';
// RuneLite's Report Button plugin (net.runelite.client.plugins.reportbutton), cloned 1:1.
module.exports = {
  id: 'reportbutton',
  name: 'Report Button',
  description: 'Replace the text on the Report button with the current time',
  tags: ['time', 'utc', 'clock'],
  enabledByDefault: true,
  game: './reportbutton/game.js',
  page: './reportbutton/page.js',
  config: {
    group: 'reportButton',
    sections: [],
    items: [
      { key: 'time', name: 'Display options', description: 'Configures what text the report button shows.', type: 'enum', default: 'LOGIN_TIME', options: [
        { value: 'DATE', label: 'Date' }, { value: 'LOGIN_TIME', label: 'Login Timer' }, { value: 'UTC', label: 'UTC Time' },
        { value: 'JAGEX', label: 'Jagex HQ Time' }, { value: 'LOCAL_TIME', label: 'Local Time' }, { value: 'GAME_TICKS', label: 'Game Ticks' },
        { value: 'IDLE_TIME', label: 'Idle Time' }] },
      { key: 'switchTimeFormat', name: 'Time format', description: 'Configures time between 12 or 24 hour time format.', type: 'enum', default: 'TIME_12H', options: [
        { value: 'TIME_12H', label: '12-hour' }, { value: 'TIME_24H', label: '24-hour' }] },
    ],
  },
};
