'use strict';
// RuneLite's Implings plugin (net.runelite.client.plugins.implings), cloned 1:1: ImplingsConfig.
// Trimmed for Sept 2007 (Impetuous Impulses, 11 Jun 2007): no crystal (2019) or lucky (2017) implings.
module.exports = {
  id: 'implings',
  name: 'Implings',
  description: 'Highlight nearby implings on the minimap and on-screen',
  tags: ['hunter', 'minimap', 'overlay', 'imp'],
  // 2006RS-2: off by default: the game this plugin is for isn't in our 2006 game (app2/README.md)
  enabledByDefault: false,
  game: './implings/game.js',
  page: './implings/page.js',
  config: {
    group: 'implings',
    sections: [{ key: 'implings', name: 'Impling type settings', description: 'Configuration for each type of impling.', position: 99 }],
    items: [
      { key: 'showbaby', method: 'showBaby', name: 'Baby implings', description: 'Configures whether or not baby impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 1 },
      { key: 'babyColor', method: 'getBabyColor', name: 'Baby impling color', description: 'Text color for baby implings.', type: 'color', alpha: true, default: '#FFB18FB3', section: 'implings', position: 2 },
      { key: 'showyoung', method: 'showYoung', name: 'Young implings', description: 'Configures whether or not young impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 3 },
      { key: 'youngColor', method: 'getYoungColor', name: 'Young impling color', description: 'Text color for young implings.', type: 'color', alpha: true, default: '#FFAFA488', section: 'implings', position: 4 },
      { key: 'showgourmet', method: 'showGourmet', name: 'Gourmet implings', description: 'Configures whether or not gourmet impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 5 },
      { key: 'gourmetColor', method: 'getGourmetColor', name: 'Gourmet impling color', description: 'Text color for gourmet implings.', type: 'color', alpha: true, default: '#FFA98362', section: 'implings', position: 6 },
      { key: 'showearth', method: 'showEarth', name: 'Earth implings', description: 'Configures whether or not earth impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 7 },
      { key: 'earthColor', method: 'getEarthColor', name: 'Earth impling color', description: 'Text color for earth implings.', type: 'color', alpha: true, default: '#FF3E5640', section: 'implings', position: 8 },
      { key: 'showessence', method: 'showEssence', name: 'Essence implings', description: 'Configures whether or not essence impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 9 },
      { key: 'essenceColor', method: 'getEssenceColor', name: 'Essence impling color', description: 'Text color for essence implings.', type: 'color', alpha: true, default: '#FF20595A', section: 'implings', position: 10 },
      { key: 'showeclectic', method: 'showEclectic', name: 'Eclectic implings', description: 'Configures whether or not eclectic impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 11 },
      { key: 'eclecticColor', method: 'getEclecticColor', name: 'Eclectic impling color', description: 'Text color for eclectic implings.', type: 'color', alpha: true, default: '#FF919B45', section: 'implings', position: 12 },
      { key: 'shownature', method: 'showNature', name: 'Nature implings', description: 'Configures whether or not nature impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 13 },
      { key: 'natureColor', method: 'getNatureColor', name: 'Nature impling color', description: 'Text color for nature implings.', type: 'color', alpha: true, default: '#FF5C8A5F', section: 'implings', position: 14 },
      { key: 'showmagpie', method: 'showMagpie', name: 'Magpie implings', description: 'Configures whether or not magpie impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 15 },
      { key: 'magpieColor', method: 'getMagpieColor', name: 'Magpie impling color', description: 'Text color for magpie implings.', type: 'color', alpha: true, default: '#FF8E8E13', section: 'implings', position: 16 },
      { key: 'showninja', method: 'showNinja', name: 'Ninja implings', description: 'Configures whether or not ninja impling tags are displayed.', type: 'enum', default: 'NONE', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 17 },
      { key: 'ninjaColor', method: 'getNinjaColor', name: 'Ninja impling color', description: 'Text color for ninja implings.', type: 'color', alpha: true, default: '#FF47464B', section: 'implings', position: 18 },
      { key: 'showdragon', method: 'showDragon', name: 'Dragon implings', description: 'Configures whether or not dragon impling tags are displayed.', type: 'enum', default: 'HIGHLIGHT', options: [{ value: 'NONE', label: 'NONE' }, { value: 'HIGHLIGHT', label: 'HIGHLIGHT' }, { value: 'NOTIFY', label: 'NOTIFY' }], section: 'implings', position: 21 },
      { key: 'dragonColor', method: 'getDragonColor', name: 'Dragon impling color', description: 'Text color for dragon implings.', type: 'color', alpha: true, default: '#FFD2554B', section: 'implings', position: 22 },
      { key: 'showspawn', method: 'showSpawn', name: 'Show spawn locations', description: 'Configures whether or not spawn locations are displayed in Puro-Puro.', type: 'boolean', default: false, position: 25 },
      { key: 'spawnColor', method: 'getSpawnColor', name: 'Impling spawn color', description: 'Text color for impling spawns in Puro-Puro.', type: 'color', alpha: true, default: '#FFFFFFFF', position: 26 },
      { key: 'showname', method: 'showName', name: 'Show name on minimap', description: 'Configures whether or not impling names are displayed on minimap.', type: 'boolean', default: false, position: 27 },
    ],
  },
};
