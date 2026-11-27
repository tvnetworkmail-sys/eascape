'use strict';
// RuneLite's Item Charges plugin (net.runelite.client.plugins.itemcharges), cloned 1:1: ItemChargeConfig.
// Era-trim (22 Sep 2007): no dodgy necklace, amulets of chemistry / bounty, explorer's ring, bracelets of slaughter /
// expeditious bracelet or blood essence (all later; their items aren't in the 2007 cache), so their options are gone.
module.exports = {
  id: 'itemcharges',
  name: 'Item Charges',
  description: 'Show number of item charges remaining',
  tags: ['inventory', 'notifications', 'overlay'],
  enabledByDefault: true,
  game: './itemcharges/game.js',
  page: ['./itemcharges/data.js', './itemcharges/page.js'],
  config: {
    group: 'itemCharge',
    sections: [
      { key: 'charges', name: 'Charge settings', description: 'Configuration for which charges should be displayed.', position: 98 },
      { key: 'notifications', name: 'Notification settings', description: 'Configuration for notifications.', position: 99 },
    ],
    items: [
      { key: 'veryLowWarningColor', name: 'Very low warning', description: 'The color of the overlay when charges are very low.', type: 'color', default: '#FF0000', position: 1 },
      { key: 'lowWarningColor', method: 'lowWarningolor', name: 'Low warning', description: 'The color of the overlay when charges are low.', type: 'color', default: '#FFFF00', position: 2 },
      { key: 'veryLowWarning', name: 'Very low warning', description: 'The charge count for the very low warning color.', type: 'int', default: 1, position: 3 },
      { key: 'lowWarning', name: 'Low warning', description: 'The charge count for the low warning color.', type: 'int', default: 2, position: 4 },
      { key: 'showTeleportCharges', name: 'Teleport charges', description: 'Show teleport item charge counts.', type: 'boolean', default: true, section: 'charges', position: 5 },
      { key: 'showImpCharges', name: 'Imp-in-a-box charges', description: 'Show imp-in-a-box item charges.', type: 'boolean', default: true, section: 'charges', position: 8 },
      { key: 'showFungicideCharges', name: 'Fungicide charges', description: 'Show fungicide item charges.', type: 'boolean', default: true, section: 'charges', position: 9 },
      { key: 'showWateringCanCharges', name: 'Watering can charges', description: 'Show watering can item charges.', type: 'boolean', default: true, section: 'charges', position: 10 },
      { key: 'showWaterskinCharges', name: 'Waterskin charges', description: 'Show waterskin dose counts.', type: 'boolean', default: true, section: 'charges', position: 11 },
      { key: 'showBellowCharges', name: 'Bellows charges', description: 'Show ogre bellows item charges.', type: 'boolean', default: true, section: 'charges', position: 12 },
      { key: 'showBasketCharges', name: 'Basket charges', description: 'Show fruit basket item counts.', type: 'boolean', default: true, section: 'charges', position: 13 },
      { key: 'showSackCharges', name: 'Sack charges', description: 'Show sack item counts.', type: 'boolean', default: true, section: 'charges', position: 14 },
      { key: 'showAbyssalBraceletCharges', name: 'Abyssal bracelet charges', description: 'Show abyssal bracelet item charges.', type: 'boolean', default: true, section: 'charges', position: 15 },
      { key: 'recoilNotification', name: 'Ring of recoil notification', description: 'Send a notification when a ring of recoil breaks.', type: 'notification', default: false, section: 'notifications', position: 18 },
      { key: 'showBindingNecklaceCharges', name: 'Binding necklace charges', description: 'Show binding necklace item charges.', type: 'boolean', default: true, section: 'charges', position: 19 },
      { key: 'bindingNotification', name: 'Binding necklace notification', description: 'Send a notification when a binding necklace breaks.', type: 'notification', default: true, section: 'notifications', position: 20 },
      { key: 'showRingOfForgingCount', name: 'Ring of forging charges', description: 'Show ring of forging item charges.', type: 'boolean', default: true, section: 'charges', position: 22 },
      { key: 'ringOfForgingNotification', name: 'Ring of forging notification', description: 'Send a notification when a ring of forging breaks.', type: 'notification', default: true, section: 'notifications', position: 23 },
      { key: 'showInfoboxes', name: 'Infoboxes', description: 'Show an infobox with remaining charges for equipped items.', type: 'boolean', default: false, position: 24 },
      { key: 'showPotionDoseCount', name: 'Potion doses', description: 'Show remaining potion doses.', type: 'boolean', default: false, section: 'charges', position: 25 },
      { key: 'showGuthixRestDoses', name: 'Guthix rest doses', description: 'Show guthix rest doses.', type: 'boolean', default: true, section: 'charges', position: 29 },
      { key: 'showBraceletOfClayCharges', name: 'Bracelet of clay charges', description: 'Show bracelet of clay item charges.', type: 'boolean', default: true, section: 'charges', position: 31 },
      { key: 'braceletOfClayNotification', name: 'Bracelet of clay notification', description: 'Send a notification when a bracelet of clay breaks.', type: 'notification', default: true, section: 'notifications', position: 32 },
    ],
  },
};
