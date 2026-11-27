'use strict';
// RuneLite's client core (api.js): the overlay system, info boxes, tooltips, event bus and the
// Client API its plugins are written against. Shown as RuneLite's own "RuneLite" entry with
// RuneLiteConfig's "Overlay settings" (same keys, names, defaults); it keeps every overlay's saved
// position in group "runelite", keys "<Overlay>_preferredLocation / _preferredPosition /
// _preferredSize" as RuneLite does.
module.exports = {
  id: 'runelite',
  name: 'RuneLite',
  description: "RuneLite's overlay, info box and plugin core",
  tags: [],
  alwaysOn: true,
  game: './runelite/game.js',
  page: ['./runelite/api.js', './runelite/agilityshortcut.js', './runelite/fishingspot.js', './runelite/combatinterface.js', './runelite/quest.js', './runelite/itemvariations.js', './runelite/itemstats.js', './runelite/core2007.js', './runelite/corea.js'],
  config: {
    group: 'runelite',
    sections: [{ key: 'overlaySettings', name: 'Overlay settings', description: 'Overlay settings', position: 2 }],
    items: [
      // 2007RS: no prices or values anywhere until the game has a player market on its website. One switch for every clone
      // (items marked prices: true are hidden while it is off); hidden from the settings.
      { key: 'showPrices', name: 'Show prices', description: 'Show item prices and values', type: 'boolean', default: false, hidden: true },
      { key: 'fontType', name: 'Dynamic overlay font', description: 'Configures what font is used for in-game overlays such as player name, ground items, etc.', type: 'enum', default: 'SMALL', options: [{ value: 'REGULAR', label: 'Regular' }, { value: 'BOLD', label: 'Bold' }, { value: 'SMALL', label: 'Small' }], section: 'overlaySettings', position: 30 },
      { key: 'tooltipFontType', name: 'Tooltip font', description: 'Configures what font is used for in-game tooltips such as food stats, NPC names, etc.', type: 'enum', default: 'SMALL', options: [{ value: 'REGULAR', label: 'Regular' }, { value: 'BOLD', label: 'Bold' }, { value: 'SMALL', label: 'Small' }], section: 'overlaySettings', position: 31 },
      { key: 'interfaceFontType', name: 'Interface font', description: 'Configures what font is used for in-game interface overlays such as panels, opponent info, clue scrolls etc.', type: 'enum', default: 'REGULAR', options: [{ value: 'REGULAR', label: 'Regular' }, { value: 'BOLD', label: 'Bold' }, { value: 'SMALL', label: 'Small' }], section: 'overlaySettings', position: 32 },
      { key: 'infoboxFontType', name: 'Infobox font', description: 'Configures what font is used for infoboxes.', type: 'enum', default: 'REGULAR', options: [{ value: 'REGULAR', label: 'Regular' }, { value: 'BOLD', label: 'Bold' }, { value: 'SMALL', label: 'Small' }], section: 'overlaySettings', position: 33 },
      { key: 'tooltipPosition', name: 'Tooltip position', description: 'Configures whether to show the tooltip above or under the cursor.', type: 'enum', default: 'UNDER_CURSOR', options: [{ value: 'ABOVE_CURSOR', label: 'Above cursor' }, { value: 'UNDER_CURSOR', label: 'Under cursor' }], section: 'overlaySettings', position: 35 },
      { key: 'infoBoxVertical', name: 'Display infoboxes vertically', description: 'Toggles the infoboxes to display vertically.', type: 'boolean', default: false, section: 'overlaySettings', position: 40 },
      { key: 'infoBoxSize', name: 'Infobox size', description: 'Configures the size of each infobox in pixels.', type: 'int', default: 35, min: 0, max: 2147483647, unit: 'px', section: 'overlaySettings', position: 42 },
      { key: 'infoBoxTextOutline', name: 'Outline infobox text', description: 'Draw a full outline instead of a simple shadow for infobox text.', type: 'boolean', default: false, section: 'overlaySettings', position: 43 },
      { key: 'overlayBackgroundColor', name: 'Overlay color', description: 'Configures the background color of infoboxes and overlays.', type: 'color', alpha: true, default: '#9C463D32', section: 'overlaySettings', position: 44 },
    ],
  },
};
