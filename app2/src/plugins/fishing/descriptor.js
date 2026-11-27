'use strict';
// RuneLite's Fishing plugin (net.runelite.client.plugins.fishing), cloned 1:1: FishingConfig.
// Trimmed for Sept 2007: no minnows (2014), aerial fishing (2017) or Tempoross harpoonfish (2021) colours, minnow overlay
// or flying fish notification. The Fishing Trawler (2002) timer and contribution rewrite the Trawler overlay's text
// through the core's display-only widget writes (Widget.setText). The spots are the core's FishingSpot
// (runelite/fishingspot.js).
module.exports = {
  id: 'fishing',
  name: 'Fishing',
  description: 'Show fishing stats and mark fishing spots',
  tags: ['overlay', 'skilling'],
  game: './fishing/game.js',
  page: './fishing/page.js',
  config: {
    group: 'fishing',
    sections: [],
    items: [
      { key: 'onlyCurrent', method: 'onlyCurrentSpot', name: 'Display only currently fished fish', description: "Configures whether only current fished fish's fishing spots are displayed.", type: 'boolean', default: false, position: 0 },
      { key: 'showTiles', method: 'showSpotTiles', name: 'Display spot tiles', description: 'Configures whether tiles for fishing spots are highlighted.', type: 'boolean', default: true, position: 1 },
      { key: 'showIcons', method: 'showSpotIcons', name: 'Display spot icons', description: 'Configures whether icons for fishing spots are displayed.', type: 'boolean', default: true, position: 2 },
      { key: 'showNames', method: 'showSpotNames', name: 'Display spot names', description: 'Configures whether names for fishing spots are displayed.', type: 'boolean', default: false, position: 3 },
      { key: 'overlayColor', method: 'getOverlayColor', name: 'Overlay color', description: 'Color of overlays.', type: 'color', alpha: true, default: '#FF00FFFF', position: 4 },
      { key: 'statTimeout', name: 'Reset stats', description: 'The time until fishing session data is reset in minutes.', type: 'int', default: 5, unit: ' mins', position: 7 },
      { key: 'trawlerTimer', name: 'Trawler timer in m:ss', description: 'Trawler timer will display a more accurate timer in M:SS format.', type: 'boolean', default: true, position: 11 },
      { key: 'trawlerContribution', name: 'Trawler contribution', description: 'Display the exact number of trawler contribution points gained.', type: 'boolean', default: true, position: 12 },
      { key: 'showFishingStats', name: 'Show fishing session stats', description: 'Display the fishing session stats.', type: 'boolean', default: true, position: 8 },
    ],
  },
};
