'use strict';
// RuneLite's Music plugin (net.runelite.client.plugins.music), cloned 1:1: MusicConfig.
module.exports = {
  id: 'music',
  name: 'Music',
  description: 'Adds search and filter for the music list, and additional volume control',
  tags: ['sound', 'volume'],
  enabledByDefault: true,
  game: './music/game.js',
  page: './music/page.js',
  config: {
    group: 'music',
    sections: [],
    items: [
      { key: 'muteOwnAreaSounds', name: 'Mute player area sounds', description: 'Mute area sounds caused by yourself.', type: 'boolean', default: false, position: 0 },
      { key: 'muteOtherAreaSounds', name: 'Mute other players\' area sounds', description: 'Mute area sounds caused by other players.', type: 'boolean', default: false, position: 1 },
      { key: 'muteOtherAreaNPCSounds', method: 'muteNpcAreaSounds', name: 'Mute NPCs\' area sounds', description: 'Mute area sounds caused by NPCs.', type: 'boolean', default: false, position: 2 },
      { key: 'muteOtherAreaEnvironmentSounds', method: 'muteEnvironmentAreaSounds', name: 'Mute environment area sounds', description: 'Mute area sounds caused by neither NPCs nor players.', type: 'boolean', default: false, position: 3 },
      { key: 'muteAmbientSounds', name: 'Mute ambient sounds', description: 'Mute background noise such as magic trees and furnaces.', type: 'boolean', default: false, position: 4 },
      { key: 'mutePrayerSounds', name: 'Mute prayer sounds', description: 'Mute prayer activation and deactivation sounds.', type: 'boolean', default: false, position: 5 },
    ],
  },
};
