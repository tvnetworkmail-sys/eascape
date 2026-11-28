'use strict';
// RuneLite's Time Tracking plugin (net.runelite.client.plugins.timetracking), cloned 1:1: TimeTrackingConfig.
// Left out (later than Sept 2007): "Show farming contract infobox" (farming contracts, 2019) and bird houses
// (Fossil Island, 2017). The Notification config type is a checkbox (the core has no per-notification settings).
module.exports = {
  id: 'timetracking',
  name: 'Time Tracking',
  description: 'Enable the Time Tracking panel, which contains timers, stopwatches, and farming and bird house trackers',
  tags: ['birdhouse', 'farming', 'hunter', 'notifications', 'skilling', 'stopwatches', 'timers', 'panel'],
  enabledByDefault: true,
  game: './timetracking/game.js',
  page: ['./timetracking/data.js', './timetracking/farming2006.js', './timetracking/page.js'],
  config: {
    group: 'timetracking',
    sections: [],
    items: [
      { key: 'timeFormatMode', name: 'Time format', description: 'What format to display times in.', type: 'enum', default: 'ABSOLUTE_24H', options: [{ value: 'RELATIVE', label: 'Relative' }, { value: 'ABSOLUTE_12H', label: '12 Hour' }, { value: 'ABSOLUTE_24H', label: '24 Hour' }], position: 1 },
      { key: 'timerNotification', name: 'Timer notification', description: 'Notify you whenever a timer has finished counting down.', type: 'notification', default: false, position: 2 },
      { key: 'defaultTimerMinutes', name: 'Default time', description: 'The default time for the timer in minutes.', type: 'int', default: 5, unit: ' mins', position: 5 },
      { key: 'sortOrder', name: 'Sort order', description: 'The order in which to sort the timers.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'ASC', label: 'ASC' }, { value: 'DESC', label: 'DESC' }], position: 6 },
      { key: 'timerWarningThreshold', name: 'Warning threshold', description: 'The time at which to change the timer color to the warning color.', type: 'int', default: 10, unit: ' secs', position: 6 },
      { key: 'preferSoonest', name: 'Prefer soonest completion', description: 'When displaying completion times on the overview, prefer showing the soonest any patch will complete.', type: 'boolean', default: false, position: 7 },
      { key: 'activeTab', hidden: true, name: 'Active tab', description: 'The currently selected tab.', type: 'string', default: 'CLOCK', position: -1 },
    ],
  },
};
