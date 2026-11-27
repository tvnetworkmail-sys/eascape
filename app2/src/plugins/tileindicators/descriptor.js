'use strict';
// RuneLite's Tile Indicators (net.runelite.client.plugins.tileindicators), cloned 1:1: TileIndicatorsConfig.
const B = (key, name, description, def, section, position) => ({ key, name, description, type: 'boolean', default: def, section, position });
const C = (key, name, description, def, section, position) => ({ key, name, description, type: 'color', alpha: true, default: def, section, position });
const W = (key, name, description, section, position) => ({ key, name, description, type: 'double', default: 2, section, position });
module.exports = {
  id: 'tileindicators',
  name: 'Tile Indicators',
  description: 'Highlight the tile you are currently moving to',
  tags: ['highlight', 'overlay'],
  enabledByDefault: false,
  game: './tileindicators/game.js',
  page: './tileindicators/page.js',
  config: {
    group: 'tileindicators',
    sections: [
      { key: 'destinationTile', name: 'Destination tile', description: 'Destination tile configuration.', position: 0 },
      { key: 'hoveredTile', name: 'Hovered tile', description: 'Hovered tile configuration.', position: 1 },
      { key: 'currentTile', name: 'Current tile', description: 'Current tile configuration.', position: 2 },
    ],
    items: [
      B('highlightDestinationTile', 'Highlight destination tile', 'Highlights tile player is walking to.', true, 'destinationTile', 1),
      C('highlightDestinationColor', 'Highlight color', 'Configures the highlight color of current destination.', '#FF808080', 'destinationTile', 2),
      C('destinationTileFillColor', 'Fill color', 'Configures the fill color of destination tile.', '#32000000', 'destinationTile', 3),
      W('destinationTileBorderWidth', 'Border width', 'Width of the destination tile marker border.', 'destinationTile', 4),
      B('highlightHoveredTile', 'Highlight hovered tile', 'Highlights tile player is hovering with mouse.', false, 'hoveredTile', 1),
      C('highlightHoveredColor', 'Highlight color', 'Configures the highlight color of hovered tile.', '#00000000', 'hoveredTile', 2),
      C('hoveredTileFillColor', 'Fill color', 'Configures the fill color of hovered tile.', '#32000000', 'hoveredTile', 3),
      W('hoveredTileBorderWidth', 'Border width', 'Width of the hovered tile marker border.', 'hoveredTile', 4),
      B('highlightCurrentTile', 'Highlight true tile', 'Highlights true tile player is on as seen by server.', false, 'currentTile', 1),
      C('highlightCurrentColor', 'Highlight color', 'Configures the highlight color of current true tile.', '#FF00FFFF', 'currentTile', 2),
      C('currentTileFillColor', 'Fill color', 'Configures the fill color of current true tile.', '#32000000', 'currentTile', 3),
      W('currentTileBorderWidth', 'Border width', 'Width of the true tile marker border.', 'currentTile', 4),
    ],
  },
};
