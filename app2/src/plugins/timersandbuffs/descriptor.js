'use strict';
// RuneLite's Timers & Buffs plugin (net.runelite.client.plugins.timersandbuffs), cloned 1:1: TimersAndBuffsConfig,
// trimmed to the timers of Sept 2007 content (no stamina, overloads, divines, imbued heart, Lunar / Arceuus
// spells, raids, ToA, Puro-Puro, Staff of the Dead, dragonfire shield, Sire, Scurrius, minigame teleports...).
const SECTIONS = [
  { key: 'bossesSection', name: 'Bosses', description: 'Timers and buffs related to bosses.', position: 0 },
  { key: 'consumablesSection', name: 'Potions & consumables', description: 'Timers and buffs related to potions/consumables/boosts.', position: 1 },
  { key: 'spellsSection', name: 'Spells', description: 'Timers and buffs related to spells you cast.', position: 2 },
  { key: 'miscellaneousSection', name: 'Miscellaneous', description: 'Timers and buffs related to miscellaneous items or activities.', position: 3 },
];
const b = (key, name, description, section, extra) => Object.assign({ key, name, description, type: 'boolean', default: true, position: -1, section }, extra);
module.exports = {
  id: 'timersandbuffs',
  name: 'Timers & Buffs',
  description: 'Show various timers and buffs in an infobox',
  tags: ['combat', 'items', 'magic', 'potions', 'prayer', 'overlay', 'inferno', 'fight', 'caves', 'cape', 'timer', 'tzhaar', 'thieving', 'pickpocket', 'buff'],
  enabledByDefault: true,
  game: './timersandbuffs/game.js',
  page: './timersandbuffs/page.js',
  config: {
    group: 'timers',
    sections: SECTIONS,
    items: [
      b('showHomeMinigameTeleports', 'Teleport cooldown timers', 'Configures whether timers for home and minigame teleport cooldowns are displayed.', 'miscellaneousSection'),
      b('showAntipoison', 'Antipoison/venom timers', 'Configures whether timers for poison and venom protection are displayed.', 'consumablesSection', { method: 'showAntiPoison' }),
      b('showAntiFire', 'Antifire timer', 'Configures whether antifire timer is displayed.', 'consumablesSection'),
      b('showCannon', 'Cannon timer', 'Configures whether cannon timer is displayed.', 'miscellaneousSection'),
      b('showCharge', 'Charge timer', 'Configures whether to show a timer for the charge spell.', 'spellsSection'),
      b('showTeleblock', 'Teleblock timer', 'Configures whether teleblock timer is displayed.', 'miscellaneousSection'),
      b('showFreezes', 'Freeze timer', 'Configures whether freeze timer is displayed.', 'miscellaneousSection'),
      b('showGodWarsAltar', 'God wars altar timer', 'Configures whether god wars altar timer is displayed.', 'bossesSection'),
      b('showTzhaarTimers', 'Fight caves and inferno timers', 'Display elapsed time in the fight caves and inferno.', 'bossesSection'),
      { key: 'tzhaarStartTime', name: '', description: '', type: 'string', default: '', hidden: true, position: -1, section: 'bossesSection' },
      { key: 'tzhaarLastTime', name: '', description: '', type: 'string', default: '', hidden: true, position: -1, section: 'bossesSection' },
      b('showPickpocketStun', 'Pickpocket stun timer', 'Configures whether pickpocket stun timer is displayed.', 'miscellaneousSection'),
    ],
  },
};
