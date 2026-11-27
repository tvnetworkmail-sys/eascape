'use strict';
// RuneLite's World Map plugin (net.runelite.client.plugins.worldmap), cloned 1:1: WorldMapConfig.
// Trimmed for Sept 2007: no quest status icons (OSRS's quest DB tables / map element categories), rooftop courses (2013),
// Arceuus spellbook (2016), teleport scrolls, mooring / salvaging (Sailing). The points are RuneLite's location enums
// trimmed to the 2007 map (data.js, made by app/tools/worldmap/points.py). They're drawn by the core's WorldMapOverlay
// on the game's world map (ui/worldmap.js).
module.exports = {
  id: 'worldmap',
  name: 'World Map',
  description: 'Enhance the world map to display additional information',
  tags: ['agility', 'dungeon', 'fairy', 'farming', 'rings', 'teleports'],
  game: './worldmap/game.js',
  page: ['./worldmap/data.js', './worldmap/page.js'],
  resources: ["air_altar_icon.png", "amulet_of_glory_teleport_icon.png", "annakarl_teleport_icon.png", "ape_atoll_teleport_icon.png", "ardougne_teleport_icon.png", "astral_altar_icon.png", "barbarian_teleport_icon.png", "body_altar_icon.png", "camelot_teleport_icon.png", "camulet_teleport_icon.png", "carrallanger_teleport_icon.png", "catherby_teleport_icon.png", "chaos_altar_icon.png", "combat_bracelet_teleport_icon.png", "cosmic_altar_icon.png", "dareeyak_teleport_icon.png", "death_altar_icon.png", "earth_altar_icon.png", "ectophial_teleport_icon.png", "enchanted_lyre_teleport_icon.png", "fairy_ring_travel.png", "falador_teleport_icon.png", "fire_altar_icon.png", "fishing_guild_teleport_icon.png", "games_necklace_teleport_icon.png", "ghorrock_teleport_icon.png", "ice_plateau_teleport_icon.png", "kharyrll_teleport_icon.png", "khazard_teleport_icon.png", "lassar_teleport_icon.png", "law_altar_icon.png", "lumbridge_teleport_icon.png", "mind_altar_icon.png", "moonclan_teleport_icon.png", "nature_altar_icon.png", "nope_icon.png", "obelisk_icon.png", "paddewwa_teleport_icon.png", "ring_of_dueling_teleport_icon.png", "senntisten_teleport_icon.png", "skills_necklace_teleport_icon.png", "trollheim_teleport_icon.png", "varrock_teleport_icon.png", "watchtower_teleport_icon.png", "water_altar_icon.png", "waterbirth_teleport_icon.png"],
  config: {
    group: 'worldmap',
    sections: [],
    items: [
      { key: "fairyRingTooltips", name: "Fairy ring code tooltip", description: "Display the code for fairy rings in the icon tooltip.", type: "boolean", default: true, position: 1 },
      { key: "fairyRingIcon", name: "Fairy ring travel icon", description: "Override the travel icon for fairy rings.", type: "boolean", default: true, position: 2 },
      { key: "agilityShortcutTooltips", name: "Agility level requirement", description: "Display the required agility level in the icon tooltip.", type: "boolean", default: true, position: 3 },
      { key: "agilityShortcutIcon", method: "agilityShortcutLevelIcon", name: "Indicate inaccessible shortcuts", description: "Indicate shortcuts you do not have the level to use on the icon.", type: "boolean", default: true, position: 4 },
      { key: "agilityCourseTooltips", method: "agilityCourseTooltip", name: "Agility course tooltip", description: "Displays the name of the agility course in the tooltip.", type: "boolean", default: true, position: 5 },
      { key: "standardSpellbookIcon", method: "normalTeleportIcon", name: "Standard spellbook destinations", description: "Show icons at the destinations for teleports in the standard spellbook.", type: "boolean", default: true, position: 7 },
      { key: "minigameTooltip", name: "Minigame names", description: "Display the name of the minigame in the icon tooltip.", type: "boolean", default: true, position: 8 },
      { key: "ancientSpellbookIcon", method: "ancientTeleportIcon", name: "Ancient magicks destinations", description: "Show icons at the destinations for teleports in the ancient spellbook.", type: "boolean", default: true, position: 9 },
      { key: "lunarSpellbookIcon", method: "lunarTeleportIcon", name: "Lunar spellbook destinations", description: "Show icons at the destinations for teleports in the lunar spellbook.", type: "boolean", default: true, position: 10 },
      { key: "jewelleryIcon", method: "jewelleryTeleportIcon", name: "Jewellery teleport destinations", description: "Show icons at the destinations for teleports from jewellery.", type: "boolean", default: true, position: 12 },
      { key: "miscellaneousTeleportIcon", name: "Misc teleport destinations", description: "Show icons at the destinations for miscellaneous teleport items.", type: "boolean", default: true, position: 14 },
      { key: "farmingpatchTooltips", method: "farmingPatchTooltips", name: "Farming patch type", description: "Display the type of farming patches in the icon tooltip.", type: "boolean", default: true, position: 16 },
      { key: "rareTreeTooltips", name: "Rare tree type", description: "Display the type of rare tree in the icon tooltip.", type: "boolean", default: true, position: 17 },
      { key: "rareTreeIcon", method: "rareTreeLevelIcon", name: "Indicate unavailable trees", description: "Indicate rare trees you do not have the level to cut on the icon.", type: "boolean", default: true, position: 18 },
      { key: "transportationTooltips", method: "transportationTeleportTooltips", name: "Transportation tooltips", description: "Indicates types and destinations of transportation.", type: "boolean", default: true, position: 19 },
      { key: "runecraftingAltarIcon", name: "Runecrafting altar locations", description: "Show the icons of runecrafting altars.", type: "boolean", default: true, position: 20 },
      { key: "miningSiteTooltips", name: "Mining site tooltips", description: "Indicates the ore available at mining sites.", type: "boolean", default: true, position: 21 },
      { key: "dungeonTooltips", name: "Dungeon tooltips", description: "Indicates the names of dungeons.", type: "boolean", default: true, position: 22 },
      { key: "hunterAreaTooltips", name: "Hunter area tooltips", description: "Indicates the creatures inside a hunting area.", type: "boolean", default: true, position: 23 },
      { key: "fishingSpotTooltips", name: "Fishing spot tooltips", description: "Indicates the type of fish fishable at the fishing spot.", type: "boolean", default: true, position: 24 },
    ],
  },
};
