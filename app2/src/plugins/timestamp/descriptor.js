'use strict';
// RuneLite's Chat Timestamps (net.runelite.client.plugins.timestamp), cloned 1:1: TimestampConfig.
module.exports = {
  id: 'timestamp',
  name: 'Chat Timestamps',
  description: 'Add timestamps to chat messages',
  tags: ['timestamp'],
  enabledByDefault: false,
  game: './timestamp/game.js',
  page: './timestamp/page.js',
  config: {
    group: 'timestamp',
    sections: [],
    items: [
      { key: 'opaqueTimestamp', name: 'Timestamps (opaque)', description: 'Color of timestamps from the Timestamps plugin (opaque).', type: 'color', default: null, position: 1 },
      { key: 'transparentTimestamp', name: 'Timestamps (transparent)', description: 'Color of timestamps from the Timestamps plugin (transparent).', type: 'color', default: null, position: 2 },
      { key: 'format', method: 'timestampFormat', name: 'Timestamp format', description: "Customize your timestamp format by using the following characters:\n'yyyy' : year\n'MM' : month\n'dd' : day\n'HH' : hour in 24 hour format\n'hh' : hour in 12 hour format\n'mm' : minute\n'ss' : second\n'a'  : AM/PM", type: 'string', default: '[HH:mm]', position: 3 },
    ],
  },
};
