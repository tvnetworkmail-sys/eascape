'use strict';
// RuneLite's Screen Markers plugin (net.runelite.client.plugins.screenmarkers), cloned 1:1: the markers are saved in
// screenmarkers.markers as RuneLite's JSON; the sidebar panel is ui/panels/screenmarkers.js.
module.exports = {
  id: 'screenmarkers',
  name: 'Screen Markers',
  description: 'Enable drawing of screen markers on top of the client',
  tags: ['boxes', 'overlay', 'panel'],
  enabledByDefault: true,
  game: './screenmarkers/game.js',
  page: './screenmarkers/page.js',
  config: {
    group: 'screenmarkers',
    sections: [],
    items: [{ key: 'markers', name: '', description: '', type: 'string', default: '', hidden: true }],
  },
};
