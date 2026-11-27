'use strict';
// RuneLite's NPC Aggression Timer plugin (net.runelite.client.plugins.npcunaggroarea), cloned 1:1.
module.exports = {
  id: 'npcunaggroarea',
  name: 'NPC Aggression Timer',
  description: 'Highlights the unaggressive area of NPCs nearby and timer until it becomes active',
  tags: ['highlight', 'lines', 'unaggro', 'aggro', 'aggressive', 'npcs', 'area', 'slayer'],
  enabledByDefault: false,
  game: './npcunaggroarea/game.js',
  page: './npcunaggroarea/page.js',
  config: {
    group: 'npcUnaggroArea',
    sections: [],
    items: [
      { key: 'npcUnaggroAlwaysActive', method: 'alwaysActive', name: 'Always active', description: "Always show this plugin's overlays.<br>Otherwise, they will only be shown when any NPC name matches the list.", type: 'boolean', default: false, position: 1 },
      { key: 'npcUnaggroNames', method: 'npcNamePatterns', name: 'NPC names', description: 'Enter names of NPCs where you wish to use this plugin.', type: 'string', default: '', position: 2 },
      { key: 'npcUnaggroShowTimer', method: 'showTimer', name: 'Show timer', description: 'Display a timer until NPCs become unaggressive.', type: 'boolean', default: true, position: 3 },
      { key: 'npcUnaggroShowAreaLines', method: 'showAreaLines', name: 'Show area lines', description: 'Display lines, when walked past, the unaggressive timer resets.', type: 'boolean', default: false, position: 4 },
      { key: 'npcAggroAreaColor', method: 'aggroAreaColor', name: 'Aggressive color', description: 'Choose color to use for marking NPC unaggressive area when NPCs are aggressive.', type: 'color', alpha: true, default: '#64FFFF00', position: 5 },
      { key: 'npcUnaggroAreaColor', method: 'unaggroAreaColor', name: 'Unaggressive color', description: 'Choose color to use for marking NPC unaggressive area after NPCs have lost aggression.', type: 'color', alpha: true, default: '#FFFFFF00', position: 6 },
      { key: 'notifyExpire', name: 'Notify expiration', description: 'Send a notification when the unaggressive timer expires.', type: 'notification', default: false, position: 7 },
      { key: 'hideIfOutOfCombat', name: 'Hide when out of combat', description: 'Hides unaggressive area lines when out of combat.', type: 'boolean', default: false, position: 8 },
      { key: 'showOnSlayerTask', name: 'Show on slayer task', description: 'Enable for current slayer task NPCs.', type: 'boolean', default: false, position: 9 },
    ],
  },
};
