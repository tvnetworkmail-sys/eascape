'use strict';
// RuneLite's Idle Notifier plugin (net.runelite.client.plugins.idlenotifier), cloned 1:1: IdleNotifierConfig.
// Trimmed for Sept 2007: no Six hour logout (later), no Oxygen (Fossil Island, 2017).
module.exports = {
  id: 'idlenotifier',
  name: 'Idle Notifier',
  description: 'Send a notification when going idle, or when HP/Prayer reaches a threshold',
  tags: ['health', 'hitpoints', 'notifications', 'prayer'],
  enabledByDefault: false,
  game: './idlenotifier/game.js',
  page: './idlenotifier/page.js',
  config: {
    group: 'idlenotifier',
    sections: [],
    items: [
      { key: 'animationidle', method: 'animationIdle', name: 'Idle animation notifications', description: 'Configures if idle animation notifications are enabled.', type: 'notification', default: true, position: 1 },
      { key: 'interactionidle', method: 'interactionIdle', name: 'Idle interaction notifications', description: 'Configures if idle interaction notifications are enabled e.g. combat, fishing.', type: 'notification', default: true, position: 2 },
      { key: 'movementidle', method: 'movementIdle', name: 'Idle movement notifications', description: 'Configures if idle movement notifications are enabled e.g. running, walking.', type: 'notification', default: false, position: 3 },
      { key: 'logoutidle', method: 'logoutIdle', name: 'Idle logout notifications', description: 'Configures if the idle logout notifications are enabled.', type: 'notification', default: true, position: 4 },
      { key: 'timeout', method: 'getIdleNotificationDelay', name: 'Idle notification delay', description: 'The notification delay after the player is idle.', type: 'int', default: 5000, unit: 'ms', position: 5 },
      { key: 'hitpointsNotification', method: 'getHitpointsNotification', name: 'Hitpoints notification', description: 'Configures if hitpoints notifications are enabled.', type: 'notification', default: false, position: 6 },
      { key: 'hitpoints', method: 'getHitpointsThreshold', name: 'Hitpoints threshold', description: 'The amount of hitpoints to send a notification at.', type: 'int', default: 1, min: 1, position: 7 },
      { key: 'prayerNotification', method: 'getPrayerNotification', name: 'Prayer notification', description: 'Configures if prayer notifications are enabled.', type: 'notification', default: false, position: 8 },
      { key: 'prayer', method: 'getPrayerThreshold', name: 'Prayer threshold', description: 'The amount of prayer points to send a notification at.', type: 'int', default: 1, min: 1, position: 9 },
      { key: 'lowEnergyNotification', method: 'getLowEnergyNotification', name: 'Low energy notification', description: 'Configures if low energy notifications are enabled.', type: 'notification', default: false, position: 10 },
      { key: 'lowEnergy', method: 'getLowEnergyThreshold', name: 'Low energy threshold', description: 'The amount of energy points remaining to send a notification at.', type: 'int', default: 0, max: 99, unit: '%', position: 11 },
      { key: 'highEnergyNotification', method: 'getHighEnergyNotification', name: 'High energy notification', description: 'Configures if high energy notifications are enabled.', type: 'notification', default: false, position: 12 },
      { key: 'highEnergy', method: 'getHighEnergyThreshold', name: 'High energy threshold', description: 'The amount of energy points reached to send a notification.', type: 'int', default: 100, min: 1, max: 100, unit: '%', position: 13 },
      { key: 'specNotification', method: 'getSpecNotification', name: 'Spec notification', description: 'Configures if special attack notifications are enabled.', type: 'notification', default: false, position: 16 },
      { key: 'spec', method: 'getSpecEnergyThreshold', name: 'Spec threshold', description: 'The amount of special attack energy reached to send a notification at.', type: 'int', default: 1, min: 1, unit: '%', position: 17 },
    ],
  },
};
