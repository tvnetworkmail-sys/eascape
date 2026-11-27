'use strict';
// RuneLite's Kingdom of Miscellania plugin (net.runelite.client.plugins.kingdomofmiscellania), cloned 1:1: KingdomConfig.
module.exports = {
  id: 'kingdomofmiscellania',
  name: 'Kingdom of Miscellania',
  description: 'Show amount of approval when inside Miscellania',
  tags: ['favor', 'favour', 'managing', 'overlay', 'approval', 'coffer'],
  enabledByDefault: false,
  game: './kingdomofmiscellania/game.js',
  page: './kingdomofmiscellania/page.js',
  config: {
    group: 'kingdomofmiscellania',
    sections: [],
    items: [
      { key: 'sendNotifications', method: 'shouldSendNotifications', name: 'Send notifications', description: 'Send chat notifications upon login showing current estimated coffer and approval.', type: 'boolean', default: false, position: 1 },
      { key: 'cofferThreshold', method: 'getCofferThreshold', name: 'Coffer threshold', description: 'Send notifications if coffer is below this value.', type: 'int', default: 7500000, min: 0, max: 7500000, position: 2 },
      { key: 'approvalThreshold', method: 'getApprovalThreshold', name: 'Approval threshold', description: 'Send notifications if approval percentage is below this value.', type: 'int', default: 100, min: 0, max: 100, position: 3 },
    ],
  },
};
