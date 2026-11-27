'use strict';
// RuneLite's FPS Control (net.runelite.client.plugins.fps), cloned: FpsConfig. The limits are kept as
// settings but not applied: the 2007 client runs its game logic in its draw loop, so capping the
// loop would slow the game (a gap until the client separates them).
module.exports = {
  id: 'fps',
  name: 'FPS Control',
  description: 'Show current FPS and/or set an FPS limit',
  tags: ['frames', 'framerate', 'limit', 'overlay'],
  enabledByDefault: false,
  game: './fps/game.js',
  page: './fps/page.js',
  config: {
    group: 'fpscontrol',
    sections: [],
    items: [
      { key: 'limitFps', name: 'Limit global FPS', description: 'Global FPS limit in effect regardless of whether window is in focus or not.', type: 'boolean', default: false, position: 1 },
      { key: 'maxFps', name: 'Global FPS target', description: 'Desired max global frames per second.', type: 'int', default: 50, min: 1, max: 360, position: 2 },
      { key: 'limitFpsUnfocused', name: 'Limit FPS unfocused', description: 'FPS limit while window is out of focus.', type: 'boolean', default: false, position: 3 },
      { key: 'maxFpsUnfocused', name: 'Unfocused FPS target', description: 'Desired max frames per second for unfocused.', type: 'int', default: 50, min: 1, max: 360, position: 4 },
      { key: 'drawFps', name: 'Draw FPS indicator', description: 'Show a number in the corner for the current FPS.', type: 'boolean', default: true, position: 5 },
    ],
  },
};
