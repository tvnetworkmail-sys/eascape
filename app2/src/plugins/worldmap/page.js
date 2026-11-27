'use strict';
// RuneLite's World Map plugin, cloned from net.runelite.client.plugins.worldmap (BSD 2-Clause, Copyright (c) 2018,
// Morgan Lewis <https://github.com/MESLewis> and RuneLite contributors): WorldMapPlugin, MapPoint and the location
// enums (data.js, from app/tools/worldmap/points.py). Its points go to the core's WorldMapPointManager; the core's
// WorldMapOverlay draws them on the game's world map. Most are a tooltip over an icon the map already draws.
// Trimmed for Sept 2007: no quest status icons (OSRS's quest DB tables), rooftop courses, Arceuus spellbook, teleport
// scrolls, Sailing (mooring points, salvaging spots); the points are only where the 2007 map has that kind of icon.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl || !ll.worldMapData) return;
  const { client, Skill, WorldPoint, WorldMapPoint, worldMapPointManager } = rl;
  const D = ll.worldMapData;
  const wp = (p) => new WorldPoint(p[0], p[1], p[2]);

  // ---------------------------------------------------------------- MapPoint
  const Type = Object.freeze({
    TELEPORT: 'TELEPORT', RUNECRAFT_ALTAR: 'RUNECRAFT_ALTAR', MINING_SITE: 'MINING_SITE', DUNGEON: 'DUNGEON', HUNTER: 'HUNTER',
    FISHING: 'FISHING', AGILITY_COURSE: 'AGILITY_COURSE', AGILITY_SHORTCUT: 'AGILITY_SHORTCUT', QUEST: 'QUEST', FAIRY_RING: 'FAIRY_RING',
    MINIGAME: 'MINIGAME', FARMING_PATCH: 'FARMING_PATCH', RARE_TREE: 'RARE_TREE', TRANSPORTATION: 'TRANSPORTATION',
  });
  class MapPoint extends WorldMapPoint {
    getType() { return this.type; }
  }
  MapPoint.Type = Type;
  const isType = (type) => (w) => w instanceof MapPoint && w.getType() === type;

  // ---------------------------------------------------------------- icons
  // Original size of world map icons is 15; a size of 17 gives a buffer when triggering tooltips
  const worldMapIconSize = 15;
  const iconOffset = 1;
  const iconBufferSize = worldMapIconSize + iconOffset * 2;
  const hasDom = typeof document !== 'undefined' && document.createElement;
  /** a transparent buffer of that size with the resource drawn at (offset, offset) once it has loaded */
  function buffered(resource, size, offset) {
    if (!hasDom) return { w: size, h: size, px: new Int32Array(size * size) };
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const paint = () => { try { c.getContext('2d').drawImage(resource, offset, offset); } catch { /* not loaded */ } };
    if (resource) { if (resource.complete) paint(); else resource.addEventListener('load', paint); }
    return c;
  }

  // ---------------------------------------------------------------- WorldMapPlugin
  class WorldMapPlugin {
    constructor() {
      this.configGroup = 'worldmap';
      this.config = rl.configProxy('worldmap', () => this.configItems);
      this.agilityLevel = 0;
      this.woodcuttingLevel = 0;
    }
    icons() {
      if (!this._icons) {
        const r = this.resources || {};
        this._icons = {
          BLANK_ICON: buffered(null, iconBufferSize, iconOffset),
          FAIRY_TRAVEL_ICON: buffered(r['fairy_ring_travel.png'], iconBufferSize, iconOffset),
          NOPE_ICON: buffered(r['nope_icon.png'], iconBufferSize, iconOffset),
        };
      }
      return this._icons;
    }
    startUp() {
      this.agilityLevel = client.getRealSkillLevel(Skill.AGILITY);
      this.woodcuttingLevel = client.getRealSkillLevel(Skill.WOODCUTTING);
      this.updateShownIcons();
    }
    shutDown() {
      worldMapPointManager.removeIf((p) => p instanceof MapPoint);
      this.agilityLevel = 0;
      this.woodcuttingLevel = 0;
    }
    onConfigChanged(event) {
      if (event.getGroup() !== 'worldmap') return;
      this.updateShownIcons();
    }
    onStatChanged(statChanged) {
      const skill = statChanged.getSkill();
      if (skill === Skill.AGILITY) {
        const newAgilityLevel = statChanged.getBoostedLevel();
        if (newAgilityLevel !== this.agilityLevel) { this.agilityLevel = newAgilityLevel; this.updateAgilityIcons(); }
      } else if (skill === Skill.WOODCUTTING) {
        const newWoodcutLevel = statChanged.getBoostedLevel();
        if (newWoodcutLevel !== this.woodcuttingLevel) { this.woodcuttingLevel = newWoodcutLevel; this.updateRareTreeIcons(); }
      }
    }
    add(fields) { worldMapPointManager.add(MapPoint.builder().type(fields.type).worldPoint(fields.worldPoint).image(fields.image)
      .tooltip(fields.tooltip == null ? null : fields.tooltip).target(fields.target || null).jumpOnClick(!!fields.jumpOnClick).name(fields.name || null).build()); }

    updateAgilityIcons() {
      const config = this.config; const { BLANK_ICON, NOPE_ICON } = this.icons();
      worldMapPointManager.removeIf(isType(Type.AGILITY_SHORTCUT));
      if (config.agilityShortcutLevelIcon() || config.agilityShortcutTooltips()) {
        for (const l of rl.AgilityShortcut ? rl.AgilityShortcut.values() : []) {
          if (l.getWorldMapLocation() == null) continue;
          this.add({ type: Type.AGILITY_SHORTCUT, worldPoint: l.getWorldMapLocation(),
            image: this.agilityLevel > 0 && config.agilityShortcutLevelIcon() && l.getLevel() > this.agilityLevel ? NOPE_ICON : BLANK_ICON,
            tooltip: config.agilityShortcutTooltips() ? l.getTooltip() : null });
        }
      }
    }
    updateAgilityCourseIcons() {
      const config = this.config; const { BLANK_ICON } = this.icons();
      worldMapPointManager.removeIf(isType(Type.AGILITY_COURSE));
      if (config.agilityCourseTooltip()) {
        // (no rooftop courses in 2007, so never ROOFTOP_COURSE_ICON)
        for (const l of D.agilityCourses) this.add({ type: Type.AGILITY_COURSE, worldPoint: wp(l.p), image: BLANK_ICON, tooltip: l.tooltip });
      }
    }
    updateRareTreeIcons() {
      const config = this.config; const { BLANK_ICON, NOPE_ICON } = this.icons();
      worldMapPointManager.removeIf(isType(Type.RARE_TREE));
      if (config.rareTreeLevelIcon() || config.rareTreeTooltips()) {
        for (const rareTree of D.rareTrees) {
          for (const point of rareTree.locations) {
            this.add({ type: Type.RARE_TREE, worldPoint: wp(point),
              image: this.woodcuttingLevel > 0 && config.rareTreeLevelIcon() && rareTree.levelReq > this.woodcuttingLevel ? NOPE_ICON : BLANK_ICON,
              tooltip: config.rareTreeTooltips() ? rareTree.tooltip : null });
          }
        }
      }
    }
    updateShownIcons() {
      const config = this.config; const { BLANK_ICON, FAIRY_TRAVEL_ICON } = this.icons();
      this.updateAgilityIcons();
      this.updateAgilityCourseIcons();
      this.updateRareTreeIcons();

      worldMapPointManager.removeIf(isType(Type.FAIRY_RING));
      if (config.fairyRingIcon() || config.fairyRingTooltips()) {
        for (const l of D.fairyRings) {
          this.add({ type: Type.FAIRY_RING, worldPoint: wp(l.locations[0]), image: config.fairyRingIcon() ? FAIRY_TRAVEL_ICON : BLANK_ICON,
            tooltip: config.fairyRingTooltips() ? 'Fairy Ring - ' + l.tooltip : null });
        }
      }

      worldMapPointManager.removeIf(isType(Type.MINIGAME));
      if (config.minigameTooltip()) {
        for (const l of D.minigames) this.add({ type: Type.MINIGAME, worldPoint: wp(l.locations[0]), image: BLANK_ICON, tooltip: l.tooltip });
      }

      worldMapPointManager.removeIf(isType(Type.TRANSPORTATION));
      if (config.transportationTeleportTooltips()) {
        for (const l of D.transportation) {
          const target = l.target ? wp(l.target) : null;
          this.add({ type: Type.TRANSPORTATION, worldPoint: wp(l.locations[0]), image: BLANK_ICON, target, jumpOnClick: target != null,
            name: titleCase(l.name), tooltip: l.tooltip });
        }
      }

      worldMapPointManager.removeIf(isType(Type.FARMING_PATCH));
      if (config.farmingPatchTooltips()) {
        for (const location of D.farmingPatches) {
          for (const point of location.locations) this.add({ type: Type.FARMING_PATCH, worldPoint: wp(point), image: BLANK_ICON, tooltip: location.tooltip });
        }
      }

      worldMapPointManager.removeIf(isType(Type.TELEPORT));
      const r = this.resources || {};
      const enabledType = { NORMAL_MAGIC: config.normalTeleportIcon(), ANCIENT_MAGICKS: config.ancientTeleportIcon(), LUNAR_MAGIC: config.lunarTeleportIcon(),
        JEWELLERY: config.jewelleryTeleportIcon(), OTHER: config.miscellaneousTeleportIcon() };
      for (const l of D.teleports) {
        if (!enabledType[l.type]) continue;
        this.add({ type: Type.TELEPORT, worldPoint: wp(l.p), tooltip: l.tooltip, image: r[l.icon] || BLANK_ICON });
      }

      worldMapPointManager.removeIf(isType(Type.RUNECRAFT_ALTAR));
      if (config.runecraftingAltarIcon()) {
        for (const l of D.runecraftingAltars) this.add({ type: Type.RUNECRAFT_ALTAR, worldPoint: wp(l.p), image: r[l.icon] || BLANK_ICON, tooltip: l.tooltip });
      }

      worldMapPointManager.removeIf(isType(Type.MINING_SITE));
      if (config.miningSiteTooltips()) {
        // (every 2007 site has its map icon, so never MINING_SITE_ICON)
        for (const l of D.miningSites) this.add({ type: Type.MINING_SITE, worldPoint: wp(l.locations[0]), image: BLANK_ICON, tooltip: l.tooltip });
      }

      worldMapPointManager.removeIf(isType(Type.DUNGEON));
      if (config.dungeonTooltips()) {
        for (const l of D.dungeons) this.add({ type: Type.DUNGEON, worldPoint: wp(l.locations[0]), image: BLANK_ICON, tooltip: l.tooltip });
      }

      worldMapPointManager.removeIf(isType(Type.HUNTER));
      if (config.hunterAreaTooltips()) {
        for (const l of D.hunterAreas) this.add({ type: Type.HUNTER, worldPoint: wp(l.locations[0]), image: BLANK_ICON, tooltip: l.tooltip });
      }

      worldMapPointManager.removeIf(isType(Type.FISHING));
      if (config.fishingSpotTooltips()) {
        for (const location of D.fishingSpots) {
          for (const point of location.locations) this.add({ type: Type.FISHING, worldPoint: wp(point), image: BLANK_ICON, tooltip: location.tooltip });
        }
      }
    }
  }
  /** Text.titleCase(enum): "ARDOUGNE_TO_BRIMHAVEN" -> "Ardougne To Brimhaven" */
  function titleCase(name) {
    return String(name).toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  }

  const plugin = new WorldMapPlugin();
  ll.__worldmap = { plugin, MapPoint };
  rl.registerPlugin('worldmap', plugin);
})();
