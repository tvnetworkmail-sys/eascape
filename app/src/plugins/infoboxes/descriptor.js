'use strict';
// Info Boxes (RuneLite's info boxes: the InfoBoxManager / InfoBoxOverlay core, with the Boosts
// plugin's boxes, its next-boost-change timer, an idle logout timer and active prayers).
// Settings live in the Info Boxes sidebar tab as well as here.
const KINDS = [
  { key: 'boosts', name: 'Boosts', description: 'A box for each boosted or drained stat (potions, beer, stat drains), like RuneLite\'s Boosts plugin' },
  { key: 'boostTimer', name: 'Next boost drop', description: 'Time until boosted stats drop back by one (every minute)' },
  { key: 'logout', name: 'Logout timer', description: 'Counts down the 90 second idle logout' },
  { key: 'prayers', name: 'Active prayers', description: 'A box for each prayer you have switched on' },
  { key: 'prayerPotion', name: 'Prayer potion', description: 'Pops up when it is time to drink a prayer potion or super restore' },
];

module.exports = {
  id: 'infoboxes',
  name: 'Info Boxes',
  description: 'Small boxes with timers and counters on the game view, like RuneLite\'s',
  tags: ['infobox', 'info', 'box', 'boxes', 'boost', 'boosts', 'timer', 'prayer', 'logout', 'overlay'],
  enabledByDefault: true,
  game: './infoboxes/game.js',
  page: './infoboxes/page.js',
  KINDS,
  config: {
    group: 'infoboxes',
    sections: [
      { key: 'boxes', name: 'Boxes', position: 0 },
      { key: 'boosts', name: 'Boosts', position: 1 },
      { key: 'logout', name: 'Logout timer', position: 2 },
      { key: 'prayer', name: 'Prayer potion', position: 3 },
      { key: 'look', name: 'Layout', position: 4 },
      { key: 'hint', name: 'Hint arrow', position: 5 },
    ],
    items: [
      ...KINDS.map((k, i) => ({ key: `show_${k.key}`, name: k.name, description: k.description, type: 'boolean', default: true, section: 'boxes', position: i })),
      { key: 'displayBoosts', name: 'Display boosts', description: 'Which skill boosts to show', type: 'enum', default: 'combat', options: [{ value: 'combat', label: 'Combat' }, { value: 'noncombat', label: 'Non-combat' }, { value: 'both', label: 'Both' }], section: 'boosts', position: 0 },
      { key: 'relativeBoost', name: 'Show relative boosts', description: 'Show the boost (+5) instead of the boosted level', type: 'boolean', default: false, section: 'boosts', position: 1 },
      { key: 'boostThreshold', name: 'Boost threshold', description: 'Levels above your level at which a boost shows green instead of yellow', type: 'int', default: 0, min: 0, max: 99, section: 'boosts', position: 2 },
      { key: 'logoutFrom', name: 'Logout timer from', description: 'Show the logout timer for the last this many seconds', type: 'int', default: 30, min: 5, max: 90, unit: 's', section: 'logout', position: 0 },
      { key: 'prayerMode', name: 'Show when', description: 'When a dose would not be wasted (you are missing at least one dose of points), or when your prayer drops to a level you choose', type: 'enum', default: 'dose', options: [{ value: 'dose', label: 'A dose won\'t be wasted' }, { value: 'level', label: 'Below a level' }], section: 'prayer', position: 0 },
      { key: 'prayerLevel', name: 'Prayer level', description: 'With "Below a level": show the box when your prayer points are this or lower', type: 'int', default: 10, min: 0, max: 99, section: 'prayer', position: 1 },
      { key: 'prayerWithout', name: 'Show without a potion', description: 'Show the reminder even when you have no prayer potion or super restore with you', type: 'boolean', default: false, section: 'prayer', position: 2 },
      { key: 'size', name: 'Box size', description: 'The size of each box in pixels', type: 'int', default: 35, min: 16, max: 80, unit: 'px', section: 'look', position: 0 },
      { key: 'vertical', name: 'Display vertically', description: 'Line the boxes you haven\'t moved up in a column instead of a row', type: 'boolean', default: false, section: 'look', position: 1 },
      { key: 'wrap', name: 'Boxes per row', description: 'How many boxes in a row (or column) before starting the next', type: 'int', default: 4, min: 1, max: 20, section: 'look', position: 2 },
      { key: 'gap', name: 'Gap', description: 'Space between boxes in pixels', type: 'int', default: 1, min: 0, max: 20, unit: 'px', section: 'look', position: 3 },
      { key: 'font', name: 'Font', description: 'The font of the box text (boxes under 32 px always use the small font)', type: 'enum', default: 'regular', options: [{ value: 'small', label: 'Small' }, { value: 'regular', label: 'Regular' }, { value: 'bold', label: 'Bold' }], section: 'look', position: 4 },
      { key: 'outline', name: 'Outline text', description: 'Draw a full outline instead of a simple shadow around the text', type: 'boolean', default: false, section: 'look', position: 5 },
      { key: 'background', name: 'Background colour', description: 'Colour of the boxes', type: 'color', default: '#463D32', section: 'look', position: 6 },
      { key: 'panelSize', name: 'Panel size', description: 'The size of panels like the opponent\'s health bar and the skilling panels, in percent (100 is RuneLite\'s size)', type: 'int', default: 100, min: 50, max: 300, unit: '%', section: 'look', position: 8 },
      { key: 'backgroundOpacity', name: 'Background opacity', description: 'How solid the boxes are, in percent', type: 'int', default: 61, min: 0, max: 100, unit: '%', section: 'look', position: 7 },
      { key: 'showHintArrow', name: 'Off-screen hint arrow', description: 'When the hint arrow (from the game, the Quest Helper or the Clue Helper) points at something out of view, show an arrow at the edge of the view pointing the way', type: 'boolean', default: true, section: 'hint', position: 0 },
      { key: 'hintArrowColor', name: 'Arrow colour', description: 'Colour of the off-screen arrow', type: 'color', default: '#FFFF00', section: 'hint', position: 1 },
    ],
  },
};
