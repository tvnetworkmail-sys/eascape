'use strict';
// RuneLite's Metronome plugin (net.runelite.client.plugins.metronome), cloned 1:1: MetronomePluginConfiguration.
module.exports = {
  id: 'metronome',
  name: 'Metronome',
  description: 'Play a sound on a specified tick to aid in efficient skilling',
  tags: ['skilling', 'tick', 'timers'],
  enabledByDefault: false,
  game: './metronome/game.js',
  page: './metronome/page.js',
  config: {
    group: 'metronome',
    sections: [],
    items: [
      { key: 'tickCount', name: 'Tick count', description: 'Configures the tick on which a sound will be played.', type: 'int', default: 1, position: -1 },
      { key: 'tickVolume', name: 'Tick volume', description: 'Configures the volume of the tick sound. A value of 0 will disable tick sounds.', type: 'int', default: 96, min: 0, max: 127, position: -1 },
      { key: 'tockVolume', name: 'Tock volume', description: 'Configures the volume of the tock sound. A value of 0 will disable tock sounds.', type: 'int', default: 0, min: 0, max: 127, position: -1 },
    ],
  },
};
