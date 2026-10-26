'use strict';
// Every plugin LostLite ships, in the shape RuneLite's @PluginDescriptor and @ConfigItem
// annotations describe. The main process reads this for defaults and enabled state, the
// sidebar builds the plugin list and settings editor from it, and the game preload loads
// each plugin's game-side module (if it has one).
//
// Config item types: boolean, int, string, color, enum, hotkey.

module.exports = [
  require('./lostlite/descriptor'),
  require('./camera/descriptor'),
  require('./menuentryswapper/descriptor'),
  require('./loginscreen/descriptor'),
  require('./bank/descriptor'),
  require('./privatemessages/descriptor'),
  require('./grounditems/descriptor'),
  require('./npcindicators/descriptor'),
  require('./orbs/descriptor'),
  require('./worldmap/descriptor'),
  require('./cluescroll/descriptor'),
  require('./dialoguekeys/descriptor'),
  require('./questhelper/descriptor'),
  require('./extras/descriptor'),
  require('./idlenotifier/descriptor'),
  require('./xpdrops/descriptor'),
  require('./xptracker/descriptor'),
  require('./infoboxes/descriptor'),
  require('./timersandbuffs/descriptor'),
  require('./opponentinfo/descriptor'),
  require('./objectindicators/descriptor'),
  require('./groundmarkers/descriptor'),
  require('./woodcutting/descriptor'),
  require('./mining/descriptor'),
  require('./agility/descriptor'),
  require('./barrows/descriptor'),
  require('./slayer/descriptor'),
  require('./cooking/descriptor'),
  require('./fishing/descriptor'),
  require('./loottracker/descriptor'),
  require('./farming/descriptor'),
  require('./chatnotifications/descriptor'),
  require('./devtools/descriptor'),
];
