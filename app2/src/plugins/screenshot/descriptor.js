'use strict';
// RuneLite's Screenshot plugin (net.runelite.client.plugins.screenshot), cloned 1:1 and era-trimmed to Sep 2007.
module.exports = {
  id: 'screenshot',
  name: 'Screenshot',
  description: 'Enable the manual and automatic taking of screenshots',
  tags: ['external', 'images', 'imgur', 'integration', 'notifications'],
  enabledByDefault: true,
  game: './screenshot/game.js',
  page: './screenshot/page.js',
  config: {
    group: 'screenshot',
    sections: [{ key: 'what', name: 'What to screenshot', description: 'All the options that select what to screenshot.', position: 99 }],
    items: [
      { key: 'displayDate', name: 'Display date', description: 'Configures whether or not the report button shows the date the screenshot was taken.', type: 'boolean', default: true, position: 1 },
      { key: 'notifyWhenTaken', name: 'Notify when taken', description: 'Configures whether or not you are notified when a screenshot has been taken.', type: 'boolean', default: true, position: 2 },
      { key: 'copyToClipboard', name: 'Copy to clipboard', description: 'Copies the saved screenshot to clipboard.', type: 'boolean', default: false, position: 4 },
      { key: 'hotkey', name: 'Screenshot hotkey', description: 'When you press this key a screenshot will be taken.', type: 'keybind', default: '', position: 4 },
      { key: 'rewards', method: 'screenshotRewards', name: 'Screenshot rewards', description: 'Configures whether screenshots are taken of clues, barrows, and quest completion.', type: 'boolean', default: true, position: 3, section: 'what' },
      { key: 'levels', method: 'screenshotLevels', name: 'Screenshot levels', description: 'Configures whether screenshots are taken of level ups.', type: 'boolean', default: true, position: 4, section: 'what' },
      { key: 'kingdom', method: 'screenshotKingdom', name: 'Screenshot kingdom reward', description: 'Configures whether screenshots are taken of kingdom reward.', type: 'boolean', default: true, position: 5, section: 'what' },
      { key: 'kills', method: 'screenshotKills', name: 'Screenshot PvP kills', description: 'Configures whether or not screenshots are automatically taken of PvP kills.', type: 'boolean', default: false, position: 8, section: 'what' },
      { key: 'boss', method: 'screenshotBossKills', name: 'Screenshot boss kills', description: 'Configures whether or not screenshots are automatically taken of boss kills.', type: 'boolean', default: false, position: 9, section: 'what' },
      { key: 'playerDeath', method: 'screenshotPlayerDeath', name: 'Screenshot deaths', description: 'Configures whether or not screenshots are automatically taken when you die.', type: 'boolean', default: false, position: 10, section: 'what' },
      { key: 'friendDeath', method: 'screenshotFriendDeath', name: 'Screenshot friend deaths', description: 'Configures whether or not screenshots are automatically taken when friends or friends chat members die.', type: 'boolean', default: false, position: 11, section: 'what' },
      { key: 'duels', method: 'screenshotDuels', name: 'Screenshot duels', description: 'Configures whether or not screenshots are automatically taken of the duel end screen.', type: 'boolean', default: false, position: 13, section: 'what' },
      { key: 'baHighGamble', method: 'screenshotHighGamble', name: 'Screenshot BA high gambles', description: 'Take a screenshot of your reward from a high gamble at Barbarian Assault.', type: 'boolean', default: false, position: 18, section: 'what' },
    ],
  },
};
