'use strict';
// RuneLite's Cannon plugin (net.runelite.client.plugins.cannon), cloned 1:1: CannonConfig.
module.exports = {
  id: 'cannon',
  name: 'Cannon',
  description: 'Show information about cannon placement and/or amount of cannonballs',
  tags: ['combat', 'notifications', 'ranged', 'overlay'],
  enabledByDefault: true,
  game: './cannon/game.js',
  page: './cannon/page.js',
  config: {
    group: 'cannon',
    sections: [],
    items: [
      { key: 'showEmptyCannonNotification', method: 'showCannonNotifications', name: 'Enable cannon notifications', description: 'Configures whether to notify you when your cannon is low on cannonballs.', type: 'notification', default: true, position: 1 },
      { key: 'lowWarningThreshold', name: 'Low warning threshold', description: 'Configures the number of cannonballs remaining before a notification is sent.<br>Regardless of this value, a notification will still be sent when your cannon is empty.', type: 'int', default: 0, max: 60, position: 2 },
      { key: 'showInfobox', name: 'Show cannonball infobox', description: 'Configures whether to show the cannonballs in an infobox.', type: 'boolean', default: false, position: 3 },
      { key: 'showDoubleHitSpot', name: 'Show double hit spots', description: 'Configures whether to show the NPC double hit spot.', type: 'boolean', default: false, position: 4 },
      { key: 'highlightDoubleHitColor', name: 'Double hit spots', description: 'Configures the highlight color of double hit spots.', type: 'color', alpha: true, default: '#FFFF0000', position: 5 },
      { key: 'showCannonSpots', name: 'Show common cannon spots', description: 'Configures whether to show common cannon spots or not.', type: 'boolean', default: true, position: 6 },
    ],
  },
};
