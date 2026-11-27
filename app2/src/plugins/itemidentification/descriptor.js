'use strict';
// RuneLite's Item Identification plugin (net.runelite.client.plugins.itemidentification), cloned 1:1:
// ItemIdentificationConfig. Era-trim: no coral fragments, sap-treated logs, repair kits or teleport scrolls (all later
// than Sept 2007, so those categories have no items).
module.exports = {
  id: 'itemidentification',
  name: 'Item Identification',
  description: 'Show identifying text over items with difficult to distinguish sprites',
  tags: ['abbreviations', 'labels', 'seeds', 'herbs', 'saplings', 'seedlings'],
  enabledByDefault: false,
  game: './itemidentification/game.js',
  page: ['./itemidentification/data.js', './itemidentification/page.js'],
  config: {
    group: 'itemidentification',
    sections: [
      { key: 'identification', name: 'Categories', description: 'The categories of items to identify.', position: 99 },
    ],
    items: [
      { key: 'identificationType', name: 'Identification type', description: 'How much to show of the item name.', type: 'enum', options: [{ value: 'SHORT', label: 'SHORT' }, { value: 'MEDIUM', label: 'MEDIUM' }], default: 'SHORT', position: -4 },
      { key: 'textColor', name: 'Color', description: 'The color of the identification text.', type: 'color', default: '#FFFFFF', position: -3 },
      { key: 'showHerbSeeds', name: 'Seeds (herb)', description: 'Show identification on herb seeds.', type: 'boolean', default: true, section: 'identification', position: -1 },
      { key: 'showAllotmentSeeds', name: 'Seeds (allotment)', description: 'Show identification on allotment seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showFlowerSeeds', name: 'Seeds (flower)', description: 'Show identification on flower seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showFruitTreeSeeds', name: 'Seeds (fruit tree)', description: 'Show identification on fruit tree seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showTreeSeeds', name: 'Seeds (tree)', description: 'Show identification on tree seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showSpecialSeeds', name: 'Seeds (special)', description: 'Show identification on special seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showBerrySeeds', name: 'Seeds (berry)', description: 'Show identification on berry seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showHopSeeds', method: 'showHopsSeeds', name: 'Seeds (hops)', description: 'Show identification on hops seeds.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showSacks', name: 'Sacks', description: 'Show identification on sacks.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showHerbs', name: 'Herbs', description: 'Show identification on herbs.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showLogs', name: 'Logs', description: 'Show identification on logs.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showPyreLogs', name: 'Logs (pyre)', description: 'Show identification on pyre logs.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showPlanks', name: 'Planks', description: 'Show identification on planks.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showYarn', name: 'Yarn', description: 'Show identification on yarns.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showCloth', name: 'Cloth', description: 'Show identification on bolts of cloth.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showSaplings', name: 'Saplings', description: 'Show identification on saplings and seedlings.', type: 'boolean', default: true, section: 'identification', position: -1 },
      { key: 'showComposts', name: 'Composts', description: 'Show identification on composts.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showOres', name: 'Ores', description: 'Show identification on ores.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showBars', name: 'Bars', description: 'Show identification on bars.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showGems', name: 'Gems', description: 'Show identification on gems.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showPotions', name: 'Potions', description: 'Show identification on potions.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showButterflyMothJars', name: 'Butterfly & Moth jars', description: 'Show identification on Butterfly and Moth jars', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showImplingJars', name: 'Impling jars', description: 'Show identification on impling jars.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showTablets', name: 'Tablets', description: 'Show identification on tablets.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showJewellery', name: 'Jewellery (unenchanted)', description: 'Show identification on unenchanted jewellery.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showEnchantedJewellery', name: 'Jewellery (enchanted)', description: 'Show identification on enchanted jewellery.', type: 'boolean', default: false, section: 'identification', position: -1 },
      { key: 'showWines', name: 'Wines', description: 'Show identification on jugs of wine.', type: 'boolean', default: false, section: 'identification', position: -1 },
    ],
  },

};
