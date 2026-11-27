// RuneLite's Clue Scroll, cloned from net.runelite.client.plugins.cluescrolls (BSD 2-Clause, Copyright (c) 2016-2018,
// Adam <Adam@sigterm.info>, Lotto, Eadgars Ruse and RuneLite contributors): ClueScrollPlugin, ClueScrollConfig,
// ClueScrollOverlay, ClueScrollWorldOverlay, ClueScrollEmoteOverlay, ClueScrollWorldMapPoint, clues/ClueScroll,
// CrypticClue, AnagramClue, CipherClue, CoordinateClue, MapClue, EmoteClue, Enemy, emote/Emote, emote/STASHUnit
// (the code; no units), item/* requirements. The clue lists (data.js) are RuneLite's, trimmed by a converter to the
// clues our server has (Sept 2007: easy, medium and hard), with our scrolls' texts and spots where they differ.
// Left out, as nothing of theirs existed by 22 Sep 2007: beginner, elite and master clues (2016-2019) and with them
// BeginnerMapClue, HotColdClue, SkillChallengeClue, ThreeStepCrypticClue, MusicClue, FaloTheBardClue and FairyRingClue;
// cipher clues (our server has none), STASH units (2014; the code is kept, no clue has one), the rune pouch (2015),
// the POH costume bank tags (no Bank Tags here) and the developer "::clue" command.
// 2007 changes: the clue text is the 2007 scroll's eight lines (interface 345, components 1-8) joined as RuneLite's
// sanitizeMultilineText would; a clue item is one named "Clue scroll" / "Challenge scroll" (no CLUE_SCROLL param);
// the overlay icon is the 2007 clue scroll (2677, there's no master clue); the emote tab is 2007's (464).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Rectangle, Point, Dimension, Overlay, OverlayPanel, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil,
    TitleComponent, LineComponent, ComponentConstants, TextComponent, FontManager, Text, WorldPoint, LocalPoint, Perspective, GameState,
    InventoryID, itemManager, worldMapPointManager, WorldMapPoint } = rl;
  const DATA = ll.cluescrollsData || {};

  // ---- 2007 ids (RuneLite's ItemID / InterfaceID names)
  const ItemID = { SPADE: 952, TRAIL_CLUE_EASY_SIMPLE001: 2677 };
  const TRAIL_CLUETEXT = 345; // trail_cluelong: the scroll's eight lines are components 1-8
  const TRAIL_CLUETEXT_LINES = [1, 2, 3, 4, 5, 6, 7, 8];
  const EMOTE_TAB = 464;

  /** java.lang.String.hashCode */
  const javaHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
  const wp = (a) => (a ? new WorldPoint(a[0], a[1], a[2] | 0) : null);
  const TITLED_CONTENT_COLOR = new Color(190, 190, 190);
  const IMAGE_Z_OFFSET = 30;
  const CLICKBOX_BORDER_COLOR = Color.ORANGE;
  const CLICKBOX_HOVER_BORDER_COLOR = Color.ORANGE.darker();
  const CLICKBOX_FILL_COLOR = new Color(0, 255, 0, 20);
  const line = (o) => { const b = LineComponent.builder(); for (const [k, v] of Object.entries(o || {})) b[k](v); return b.build(); };

  // ---------------------------------------------------------------- clues/item
  const EquipmentInventorySlot = { HEAD: 0, CAPE: 1, AMULET: 2, WEAPON: 3, BODY: 4, SHIELD: 5, LEGS: 7, GLOVES: 9, BOOTS: 10, RING: 12, AMMO: 13 };
  class SingleItemRequirement {
    constructor(itemId) { this.itemId = itemId; }
    fulfilledBy(x) { if (typeof x === 'number') return this.itemId === x; return x.some((it) => it && it.getId() === this.itemId); }
    getCollectiveName(c) { const d = c.getItemDefinition(this.itemId); return d ? d.getName() : 'N/A'; }
  }
  class MultipleOfItemRequirement {
    constructor(itemId, quantity) { this.itemId = itemId; this.quantity = quantity; }
    fulfilledBy(x) {
      if (typeof x === 'number') return x === this.itemId;
      let found = 0;
      for (const it of x) if (it && it.getId() === this.itemId) { found += it.getQuantity(); if (found >= this.quantity) return true; }
      return false;
    }
    getCollectiveName(c) { const d = c.getItemDefinition(this.itemId); return d ? `${d.getName()} x${this.quantity}` : 'N/A'; }
  }
  class RangeItemRequirement {
    constructor(name, start, end) { this.name = name; this.startItemId = start; this.endItemId = end; }
    fulfilledBy(x) { if (typeof x === 'number') return x >= this.startItemId && x <= this.endItemId; return x.some((it) => it && it.getId() >= this.startItemId && it.getId() <= this.endItemId); }
    getCollectiveName() { return this.name; }
  }
  class AnyRequirementCollection {
    constructor(name, reqs) { this.name = name; this.requirements = reqs; }
    fulfilledBy(x) { return this.requirements.some((r) => r.fulfilledBy(x)); }
    getCollectiveName() { return this.name; }
  }
  class AllRequirementsCollection {
    constructor(name, reqs) { this.name = name || 'N/A'; this.requirements = reqs; }
    fulfilledBy(x) { if (typeof x === 'number') return this.requirements.some((r) => r.fulfilledBy(x)); return this.requirements.every((r) => r.fulfilledBy(x)); }
    getCollectiveName() { return this.name; }
  }
  class SlotLimitationRequirement {
    constructor(description, slots) { this.description = description; this.slots = slots; }
    fulfilledBy(x) {
      if (typeof x === 'number') return false;
      for (const s of this.slots) {
        const idx = EquipmentInventorySlot[s];
        if (idx >= x.length) continue; // (nothing in it: the array hasn't been resized)
        if (x[idx] && x[idx].getId() !== -1) return false;
      }
      return true;
    }
    getCollectiveName() { return this.description; }
  }
  const item = (id) => new SingleItemRequirement(id);
  const any = (name, ...reqs) => new AnyRequirementCollection(name, reqs);
  /** data.js requirement trees -> the classes */
  function req(t) {
    switch (t.t) {
      case 'item': return new SingleItemRequirement(t.id);
      case 'xof': return new MultipleOfItemRequirement(t.id, t.qty);
      case 'range': return new RangeItemRequirement(t.name, t.start, t.end);
      case 'any': return new AnyRequirementCollection(t.name, t.reqs.map(req));
      case 'all': return new AllRequirementsCollection(t.name, t.reqs.map(req));
      case 'empty': return new SlotLimitationRequirement(t.name, t.slots);
      default: return null;
    }
  }

  // ---------------------------------------------------------------- Enemy, emote/Emote
  const Enemy = {
    DOUBLE_AGENT_65: 'Double Agent level 65', DOUBLE_AGENT_108: 'Double Agent level 108', DOUBLE_AGENT_141: 'Double Agent level 141',
    ZAMORAK_WIZARD: 'Zamorak Wizard', SARADOMIN_WIZARD: 'Saradomin Wizard', ARMADYLEAN_OR_BANDOSIAN_GUARD: 'Armadylean OR Bandosian Guard',
    ARMADYLEAN_GUARD: 'Armadylean Guard', BANDOSIAN_GUARD: 'Bandosian Guard', BRASSICAN_MAGE: 'Brassican Mage', ANCIENT_WIZARDS: 'Ancient Wizard Trio',
    BRASSICAN_OR_WIZARDS: 'Brassican Mage OR Ancient Wizards',
  };
  const enemy = (k) => (k && Enemy[k] ? { getText: () => Enemy[k] } : null);
  // name, and the emote's button in 2007's emote tab (464; RuneLite matches the button's sprite)
  const EMOTES = [['BULL_ROARER', 'Bull Roarer', -1], ['YES', 'Yes', 1], ['NO', 'No', 2], ['THINK', 'Think', 5], ['BOW', 'Bow', 3], ['ANGRY', 'Angry', 4],
    ['CRY', 'Cry', 17], ['LAUGH', 'Laugh', 10], ['CHEER', 'Cheer', 8], ['WAVE', 'Wave', 6], ['BECKON', 'Beckon', 9], ['DANCE', 'Dance', 13], ['CLAP', 'Clap', 21],
    ['PANIC', 'Panic', 19], ['JIG', 'Jig', 14], ['SPIN', 'Spin', 15], ['HEADBANG', 'Headbang', 16], ['JUMP_FOR_JOY', 'Jump for Joy', 11], ['RASPBERRY', 'Raspberry', 20],
    ['YAWN', 'Yawn', 12], ['SALUTE', 'Salute', 22], ['SHRUG', 'Shrug', 7], ['BLOW_KISS', 'Blow Kiss', 18], ['GOBLIN_SALUTE', 'Goblin Salute', 24],
    ['SLAP_HEAD', 'Slap Head', -1], ['STAMP', 'Stamp', -1], ['FLAP', 'Flap', -1], ['PUSH_UP', 'Push up', -1], ['CRAB_DANCE', 'Crab Dance', -1]];
  const Emote = {};
  for (const [k, name, comp] of EMOTES) Emote[k] = { name: k, getName: () => name, getComponent: () => comp, hasSprite: () => comp !== -1 };

  // ---------------------------------------------------------------- clues/ClueScroll
  class ClueScroll {
    constructor() { this.requiresSpade = false; this.requiresLight = false; this.firePitVarbitId = -1; this.enemy = null; }
    isRequiresSpade() { return this.requiresSpade; }
    isRequiresLight() { return this.requiresLight; }
    getFirePitVarbitId() { return this.firePitVarbitId; }
    getEnemy() { return this.enemy; }
    getConfigKeys() { return null; }
    renderOverlayNote(panelComponent, plugin) {
      const keys = this.getConfigKeys();
      if (keys == null) return;
      const note = plugin.getClueNote(keys[0]);
      if (note) {
        panelComponent.getChildren().push(line({ left: 'Note:' }));
        panelComponent.getChildren().push(line({ left: note, leftColor: TITLED_CONTENT_COLOR }));
      }
    }
  }
  /** the NPCs to mark, as they are this frame (our NPC objects are snapshots) */
  const freshNpcs = (plugin) => plugin.getNpcsToMark().map((n) => client.getTopLevelWorldView().npcs().byIndex(n.getIndex()) || n);
  function renderObjectsToMark(graphics, plugin) {
    const mousePosition = client.getMouseCanvasPosition();
    for (const gameObject of plugin.getObjectsToMark()) {
      OverlayUtil.renderHoverableArea(graphics, gameObject.getClickbox(), mousePosition, CLICKBOX_FILL_COLOR, CLICKBOX_BORDER_COLOR, CLICKBOX_HOVER_BORDER_COLOR);
      OverlayUtil.renderImageLocation(client, graphics, gameObject.getLocalLocation(), plugin.getClueScrollImage(), IMAGE_Z_OFFSET);
    }
  }

  // ---------------------------------------------------------------- clues/CrypticClue
  class CrypticClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemIds = new Set(d.itemIds || (d.itemId != null ? [d.itemId] : [-1]));
      this.text = d.text;
      this.npc = d.npc || null;
      this.objectId = d.objectId > 0 ? d.objectId : -1;
      this.location = wp(d.location);
      this.solution = d.solution;
      this.questionText = d.questionText || null;
      this.answer = d.answer || null;
      this.npcRegions = d.npcRegions || [];
      this.requiresSpade = this.location != null && this.npc == null && this.objectId === -1;
      this.requiresLight = !!d.requiresLight;
    }
    getNpc() { return this.npc; }
    getLocation() { return this.location; }
    getSolution() { return this.solution; }
    getAnswer() { return this.answer; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Cryptic Clue').build());
      const npc = this.getNpc(plugin);
      if (npc != null) {
        ch.push(line({ left: 'NPC:' }));
        ch.push(line({ left: npc, leftColor: TITLED_CONTENT_COLOR }));
      }
      if (this.objectId !== -1) {
        let object = client.getObjectDefinition(this.objectId);
        if (object && object.getImpostorIds() != null) object = object.getImpostor();
        if (object) {
          ch.push(line({ left: 'Object:' }));
          ch.push(line({ left: object.getName(), leftColor: TITLED_CONTENT_COLOR }));
        }
      }
      ch.push(line({ left: 'Solution:' }));
      ch.push(line({ left: this.getSolution(plugin), leftColor: TITLED_CONTENT_COLOR }));
      if (this.getAnswer() != null) {
        ch.push(line({ left: 'Answer:' }));
        ch.push(line({ left: this.getAnswer(), leftColor: TITLED_CONTENT_COLOR }));
      }
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      const location = this.getLocation(plugin);
      if (location != null && this.getNpc(plugin) == null && this.objectId === -1) {
        const localLocation = LocalPoint.fromWorld(client, location);
        if (localLocation != null) OverlayUtil.renderTileOverlay(client, graphics, localLocation, plugin.getSpadeImage(), Color.ORANGE);
      }
      for (const npc of freshNpcs(plugin)) OverlayUtil.renderActorOverlayImage(graphics, npc, plugin.getClueScrollImage(), Color.ORANGE, IMAGE_Z_OFFSET);
      if (this.objectId !== -1) renderObjectsToMark(graphics, plugin);
    }
    static forItemId(itemId) { return CrypticClue.CLUES.find((c) => c.itemIds.has(itemId)) || null; }
    static forText(text) { return CrypticClue.CLUES.find((c) => eqIgnoreCase(text, c.text) || eqIgnoreCase(text, c.questionText)) || null; }
    getObjectIds() { return [this.objectId]; }
    getNpcs(plugin) { return [this.getNpc(plugin)]; }
    getNpcRegions() { return this.npcRegions; }
    getConfigKeys() { return [javaHash(this.text)]; }
  }
  const eqIgnoreCase = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();

  // ---------------------------------------------------------------- clues/AnagramClue
  const ANAGRAM_TEXT = 'This anagram reveals who to speak to next: ';
  const ANAGRAM_TEXT_BEGINNER = 'The anagram reveals who to speak to next: ';
  class AnagramClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemId = d.itemId != null ? d.itemId : -1;
      this.text = d.text;
      this.npc = d.npc;
      this.location = wp(d.location);
      this.area = d.area;
      this.question = d.question || null;
      this.answer = d.answer != null ? d.answer : null;
      this.objectId = d.objectId != null ? d.objectId : -1;
    }
    getLocation() { return this.location; }
    getArea() { return this.area; }
    getAnswer() { return this.answer; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Anagram Clue').build());
      ch.push(line({ left: 'NPC:' }));
      ch.push(line({ left: this.npc, leftColor: TITLED_CONTENT_COLOR }));
      ch.push(line({ left: 'Location:' }));
      ch.push(line({ left: this.getArea(), leftColor: TITLED_CONTENT_COLOR }));
      const answer = this.getAnswer(plugin);
      if (answer != null) {
        ch.push(line({ left: 'Answer:' }));
        ch.push(line({ left: answer, leftColor: TITLED_CONTENT_COLOR }));
      }
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      if (!this.getLocation(plugin).isInScene(client)) return;
      if (this.objectId === -1) for (const npc of freshNpcs(plugin)) OverlayUtil.renderActorOverlayImage(graphics, npc, plugin.getClueScrollImage(), Color.ORANGE, IMAGE_Z_OFFSET);
      if (this.objectId !== -1) renderObjectsToMark(graphics, plugin);
    }
    static forItemId(itemId) { return AnagramClue.CLUES.find((c) => c.itemId === itemId) || null; }
    static forText(plugin, text) {
      return AnagramClue.CLUES.find((c) => eqIgnoreCase(text, ANAGRAM_TEXT + c.text) || eqIgnoreCase(text, ANAGRAM_TEXT_BEGINNER + c.text) || eqIgnoreCase(text, c.question)) || null;
    }
    getNpcs() { return [this.npc]; }
    getNpcRegions() { return []; }
    getObjectIds() { return [this.objectId]; }
    getConfigKeys() { return [this.text != null ? javaHash(this.text) : this.objectId]; }
  }

  // ---------------------------------------------------------------- clues/CipherClue (no cipher clues on our server)
  class CipherClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemId = d.itemId != null ? d.itemId : -1;
      this.text = 'The cipher reveals who to speak to next: ' + d.text;
      this.npc = d.npc != null ? d.npc : -1;
      this.location = wp(d.location);
      this.area = d.area;
      this.question = d.question || null;
      this.answer = d.answer || null;
    }
    getLocation() { return this.location; }
    getArea() { return this.area; }
    getAnswer() { return this.answer; }
    getNpcName() { if (this.npc === -1) return null; const d = client.getNpcDefinition ? client.getNpcDefinition(this.npc) : null; return d ? d.getName() : null; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Cipher Clue').build());
      const npc = this.getNpcName();
      if (npc != null) { ch.push(line({ left: 'NPC:' })); ch.push(line({ left: npc, leftColor: TITLED_CONTENT_COLOR })); }
      ch.push(line({ left: 'Location:' }));
      ch.push(line({ left: this.getArea(plugin), leftColor: TITLED_CONTENT_COLOR }));
      if (this.getAnswer() != null) { ch.push(line({ left: 'Answer:' })); ch.push(line({ left: this.getAnswer(), leftColor: TITLED_CONTENT_COLOR })); }
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      if (!this.getLocation(plugin).isInScene(client)) return;
      for (const npc of freshNpcs(plugin)) OverlayUtil.renderActorOverlayImage(graphics, npc, plugin.getClueScrollImage(), Color.ORANGE, IMAGE_Z_OFFSET);
    }
    static forItemId(itemId) { return CipherClue.CLUES.find((c) => c.itemId === itemId) || null; }
    static forText(text) { return CipherClue.CLUES.find((c) => eqIgnoreCase(text, c.text) || eqIgnoreCase(text, c.question)) || null; }
    getNpcs() { return [this.getNpcName()]; }
    getNpcRegions() { return []; }
    getConfigKeys() { return [javaHash(this.text)]; }
  }

  // ---------------------------------------------------------------- clues/CoordinateClue
  class CoordinateClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemId = d.itemId != null ? d.itemId : -1;
      this.directions = d.directions;
      this.enemy = enemy(d.enemy);
      this.location = wp(d.location);
      this.mirrorLocation = this.location; // (WorldPoint.getMirrorPoint: no instances in 2007)
      this.lightSourceVarbitId = d.lightSourceVarbitId == null ? -1 : d.lightSourceVarbitId;
      this.firePitVarbitId = this.lightSourceVarbitId;
      this.requiresLight = this.lightSourceVarbitId !== -1;
      this.requiresSpade = true;
    }
    static forLocation(location) { return CoordinateClue.CLUES.get(`${location.x},${location.y},${location.plane}`) || null; }
    getDirections() { return this.directions; }
    getLocation() { return this.location; }
    getLocations() { return this.mirrorLocation != null && this.mirrorLocation !== this.location ? [this.location, this.mirrorLocation] : [this.location]; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Coordinate Clue').build());
      const solution = CoordinateClue.forLocation(this.location);
      if (solution != null) {
        ch.push(line({ left: solution.getDirections(plugin) }));
        ch.push(line({}));
      }
      ch.push(line({ left: 'Click the clue scroll on your world map to see dig location.' }));
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      for (const worldPoint of this.getLocations(plugin)) {
        const localLocation = LocalPoint.fromWorld(client, worldPoint);
        if (localLocation != null) OverlayUtil.renderTileOverlay(client, graphics, localLocation, plugin.getSpadeImage(), Color.ORANGE);
      }
    }
    static forItemId(itemId) { for (const c of CoordinateClue.CLUES.values()) if (c.itemId === itemId) return c; return null; }
    getConfigKeys() { return [this.location.hashCode()]; }
  }

  // ---------------------------------------------------------------- clues/MapClue
  class MapClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemId = d.itemId; this.location = wp(d.location); this.objectId = d.objectId != null ? d.objectId : -1; this.description = d.description || null;
      this.requiresSpade = this.objectId === -1;
    }
    getLocation() { return this.location; }
    getObjectId() { return this.objectId; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Map Clue').build());
      ch.push(line({ left: 'Click the clue scroll along the edge of your world map to see your destination.' }));
      if (this.objectId !== -1) {
        const objectToClick = client.getObjectDefinition(this.getObjectId());
        const objectName = objectToClick != null ? objectToClick.getName() : 'N/A';
        ch.push(line({ left: `Travel to the destination and click the ${objectName}.` }));
      } else {
        ch.push(line({ left: 'Travel to the destination and dig on the marked tile.' }));
      }
      if (this.description != null) {
        ch.push(line({}));
        ch.push(line({ left: this.description }));
      }
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      const localLocation = LocalPoint.fromWorld(client, this.getLocation());
      if (localLocation == null) return;
      if (this.objectId !== -1) renderObjectsToMark(graphics, plugin);
      else OverlayUtil.renderTileOverlay(client, graphics, localLocation, plugin.getSpadeImage(), Color.ORANGE);
    }
    static forItemId(itemId) { return MapClue.CLUES.find((c) => c.itemId === itemId) || null; }
    getObjectIds() { return [this.objectId]; }
    getConfigKeys() { return [this.location.hashCode()]; }
  }

  // ---------------------------------------------------------------- clues/EmoteClue
  const UNICODE_CHECK_MARK = '✓';
  const UNICODE_BALLOT_X = '✗';
  class EmoteClue extends ClueScroll {
    constructor(d) {
      super();
      this.itemId = d.itemId; this.text = d.text; this.locationName = d.locationName; this.stashUnit = d.stashUnit || null;
      this.location = wp(d.location); this.firstEmote = Emote[d.firstEmote]; this.secondEmote = d.secondEmote ? Emote[d.secondEmote] : null;
      this.itemRequirements = (d.reqs || []).map(req).filter(Boolean);
      this.enemy = enemy(d.enemy);
      if (d.firePitVarbitId != null) { this.requiresLight = true; this.firePitVarbitId = d.firePitVarbitId; }
    }
    getText() { return this.text; }
    getLocationName() { return this.locationName; }
    getStashUnit() { return this.stashUnit; }
    getFirstEmote() { return this.firstEmote; }
    getSecondEmote() { return this.secondEmote; }
    getItemRequirements() { return this.itemRequirements; }
    getLocation() { return this.location; }
    getLocations(plugin) { return [this.getLocation(plugin)]; }
    makeOverlayHint(panelComponent, plugin) {
      const ch = panelComponent.getChildren();
      ch.push(TitleComponent.builder().text('Emote Clue').build());
      ch.push(line({ left: 'Emotes:' }));
      ch.push(line({ left: this.getFirstEmote().getName(), leftColor: TITLED_CONTENT_COLOR }));
      if (this.getSecondEmote() != null) ch.push(line({ left: this.getSecondEmote().getName(), leftColor: TITLED_CONTENT_COLOR }));
      ch.push(line({ left: 'Location:' }));
      ch.push(line({ left: this.getLocationName(), leftColor: TITLED_CONTENT_COLOR }));
      if (this.itemRequirements.length > 0) {
        if (this.stashUnit != null) {
          // (WATSON_STASH_UNIT_CHECK: no STASH units in 2007, so no clue has one)
        }
        ch.push(line({ left: 'Equip:' }));
        const equipment = plugin.getEquippedItems() || [];
        const inventory = plugin.getInventoryItems() || [];
        const combined = equipment.concat(inventory);
        for (const requirement of this.itemRequirements) {
          const equipmentFulfilled = requirement.fulfilledBy(equipment);
          const combinedFulfilled = requirement.fulfilledBy(combined);
          ch.push(line({
            left: requirement.getCollectiveName(client), leftColor: TITLED_CONTENT_COLOR,
            right: combinedFulfilled ? UNICODE_CHECK_MARK : UNICODE_BALLOT_X, rightFont: FontManager.getDefaultFont(),
            rightColor: equipmentFulfilled ? Color.GREEN : (combinedFulfilled ? Color.ORANGE : Color.RED),
          }));
        }
      }
      this.renderOverlayNote(panelComponent, plugin);
    }
    makeWorldOverlayHint(graphics, plugin) {
      const localPoint = LocalPoint.fromWorld(client, this.getLocation());
      if (localPoint != null) OverlayUtil.renderTileOverlay(client, graphics, localPoint, plugin.getEmoteImage(), Color.ORANGE);
      this.makeSTASHOverlay(graphics, plugin);
    }
    getConfigKeys() { return [javaHash(this.text)]; }
    makeSTASHOverlay(graphics, plugin) {
      if (this.stashUnit == null) return;
      for (const worldPoint of this.stashUnit.getWorldPoints()) {
        const lp = LocalPoint.fromWorld(client, worldPoint);
        if (lp == null) continue;
        const poly = Perspective.getCanvasTilePoly(client, lp);
        if (poly != null) OverlayUtil.renderPolygon(graphics, poly, Color.RED);
      }
    }
    static forItemId(itemId) { return EmoteClue.CLUES.find((c) => c.itemId === itemId) || null; }
    static forText(text) { return EmoteClue.CLUES.find((c) => eqIgnoreCase(c.getText(), text)) || null; }
  }

  CrypticClue.CLUES = (DATA.cryptic || []).map((d) => new CrypticClue(d));
  AnagramClue.CLUES = (DATA.anagram || []).map((d) => new AnagramClue(d));
  CipherClue.CLUES = (DATA.cipher || []).map((d) => new CipherClue(d));
  CoordinateClue.CLUES = new Map((DATA.coordinate || []).map((d) => { const c = new CoordinateClue(d); return [`${c.location.x},${c.location.y},${c.location.plane}`, c]; }));
  MapClue.CLUES = (DATA.map || []).map((d) => new MapClue(d));
  EmoteClue.CLUES = (DATA.emote || []).map((d) => new EmoteClue(d));
  // LocationClueScroll / LocationsClueScroll / NpcClueScroll / ObjectClueScroll / NamedObjectClueScroll, by their methods
  const isLocations = (c) => c instanceof CoordinateClue;
  const isLocation = (c) => c && !isLocations(c) && typeof c.getLocation === 'function';
  const isNpcClue = (c) => c instanceof CrypticClue || c instanceof AnagramClue || c instanceof CipherClue;
  const isObjectClue = (c) => c instanceof CrypticClue || c instanceof AnagramClue || c instanceof MapClue;

  // ---------------------------------------------------------------- ClueScrollOverlay
  const HAS_SPADE = any('Spade', item(ItemID.SPADE));
  // (2007's light sources of RuneLite's list: later ones dropped)
  const HAS_LIGHT = any('Light Source', item(594), item(33), item(32), item(4531), item(4534), item(4524), item(4539), item(4550), item(4702), item(9065), item(5013), item(9804), item(9805));
  class ClueScrollOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPriority(OverlayPriority.LOW);
      // (RuneLite's overlay menu: Configure, Reset, Set note; the core's overlays have no right-click menu yet)
      this.addMenuEntry('RUNELITE_OVERLAY', 'Reset', 'Clue Scroll overlay', () => plugin.resetClue(true));
    }
    render(graphics) {
      const clue = this.plugin.getClue();
      if (clue == null) return null;
      const ch = this.panelComponent.getChildren();
      this.panelComponent.setPreferredSize(new Dimension(ComponentConstants.STANDARD_WIDTH, 0));
      clue.makeOverlayHint(this.panelComponent, this.plugin);
      const inventoryItems = this.plugin.getInventoryItems();
      const equippedItems = this.plugin.getEquippedItems();
      if (clue.isRequiresSpade() && inventoryItems != null && !HAS_SPADE.fulfilledBy(inventoryItems)) {
        ch.push(line({ left: '' }));
        ch.push(line({ left: 'Requires Spade!', leftColor: Color.RED }));
      }
      if (clue.isRequiresLight()
        && ((clue.getFirePitVarbitId() === -1 || client.getVarbitValue(clue.getFirePitVarbitId()) !== 1)
          && (inventoryItems == null || !HAS_LIGHT.fulfilledBy(inventoryItems))
          && (equippedItems == null || !HAS_LIGHT.fulfilledBy(equippedItems)))) {
        ch.push(line({ left: '' }));
        ch.push(line({ left: 'Requires Light Source!', leftColor: Color.RED }));
      }
      if (clue.getEnemy() != null) {
        ch.push(line({ left: '' }));
        ch.push(line({ left: clue.getEnemy().getText(), leftColor: Color.YELLOW }));
      }
      return super.render(graphics);
    }
  }

  // ---------------------------------------------------------------- ClueScrollWorldOverlay
  class ClueScrollWorldOverlay extends Overlay {
    constructor(plugin) {
      super();
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_SCENE);
    }
    render(graphics) {
      const clue = this.plugin.getClue();
      if (clue != null) clue.makeWorldOverlayHint(graphics, this.plugin);
      const activeSTASHClue = this.plugin.getActiveSTASHClue();
      if (activeSTASHClue != null && activeSTASHClue !== clue) activeSTASHClue.makeSTASHOverlay(graphics, this.plugin);
      return null;
    }
  }

  // ---------------------------------------------------------------- ClueScrollEmoteOverlay (2007's emote tab, 464)
  class ClueScrollEmoteOverlay extends Overlay {
    constructor(plugin) {
      super();
      this.plugin = plugin;
      this.hasScrolled = false;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
    }
    render(graphics) {
      const clue = this.plugin.getClue();
      if (!(clue instanceof EmoteClue)) { this.hasScrolled = false; return null; }
      if (!clue.getFirstEmote().hasSprite()) return null;
      const emoteWindow = client.getWidget(EMOTE_TAB, 0);
      if (emoteWindow == null || emoteWindow.isHidden()) return null;
      const first = client.getWidget(EMOTE_TAB, clue.getFirstEmote().getComponent());
      const second = clue.getSecondEmote() != null && clue.getSecondEmote().hasSprite() ? client.getWidget(EMOTE_TAB, clue.getSecondEmote().getComponent()) : null;
      if (first && !first.isHidden()) this.plugin.highlightWidget(graphics, first, emoteWindow, null, clue.getSecondEmote() != null ? '1st' : null);
      if (second && !second.isHidden()) this.plugin.highlightWidget(graphics, second, emoteWindow, null, '2nd');
      this.hasScrolled = true; // (2007's emote tab doesn't scroll)
      return null;
    }
  }

  // ---------------------------------------------------------------- ClueScrollWorldMapPoint
  class ClueScrollWorldMapPoint extends WorldMapPoint {
    constructor(worldPoint, plugin) {
      super(worldPoint, null);
      this.plugin = plugin;
      this.setSnapToEdge(true);
      this.setJumpOnClick(true);
      this.setName('Clue Scroll');
      this.setImage(plugin.getMapArrow());
    }
    onEdgeSnap() { this.setImage(this.plugin.getClueScrollImage()); this.setImagePoint(null); }
    onEdgeUnsnap() { this.setImage(this.plugin.getMapArrow()); }
  }

  // ---------------------------------------------------------------- ClueScrollPlugin
  const HIGHLIGHT_BORDER_COLOR = Color.ORANGE;
  const HIGHLIGHT_HOVER_BORDER_COLOR = HIGHLIGHT_BORDER_COLOR.darker();
  const HIGHLIGHT_FILL_COLOR = new Color(0, 255, 0, 20);
  const CLUE_NOTE_KEY_PREFIX = 'note_';
  const GROUP = 'cluescroll';
  const isClueItemName = (n) => /^(Clue scroll|Challenge scroll|Treasure scroll)/.test(n || '');

  class ClueScrollPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.clue = null;
      this.npcsToMark = [];
      this.objectsToMark = [];
      this.namedObjectsToMark = new Set();
      this.equippedItems = null;
      this.inventoryItems = null;
      this.clueItemId = null;
      this.worldMapPointsSet = false;
      this.currentPlane = -1;
      this.namedObjectCheckThisTick = false;
      this.textComponent = new TextComponent();
      this.activeSTASHClue = null;
      this.clickedSTASHClue = null;
      this.pendingClueText = false;
      this.clueScrollOverlay = new ClueScrollOverlay(this);
      this.clueScrollEmoteOverlay = new ClueScrollEmoteOverlay(this);
      this.clueScrollWorldOverlay = new ClueScrollWorldOverlay(this);
    }
    getClient() { return client; }
    getClue() { return this.clue; }
    getNpcsToMark() { return this.npcsToMark; }
    getObjectsToMark() { return this.objectsToMark; }
    getNamedObjectsToMark() { return this.namedObjectsToMark; }
    getEquippedItems() { return this.equippedItems; }
    getInventoryItems() { return this.inventoryItems; }
    getActiveSTASHClue() { return this.activeSTASHClue; }

    startUp() {
      rl.overlayManager.add(this.clueScrollOverlay);
      rl.overlayManager.add(this.clueScrollEmoteOverlay);
      rl.overlayManager.add(this.clueScrollWorldOverlay);
      // (ClueScrollMusicOverlay: no music clues in 2007; the bank tags: no Bank Tags plugin)
    }
    shutDown() {
      rl.overlayManager.remove(this.clueScrollOverlay);
      rl.overlayManager.remove(this.clueScrollEmoteOverlay);
      rl.overlayManager.remove(this.clueScrollWorldOverlay);
      this.npcsToMark.length = 0;
      this.namedObjectsToMark.clear();
      this.inventoryItems = null;
      this.equippedItems = null;
      this.currentPlane = -1;
      this.namedObjectCheckThisTick = false;
      this.resetClue(true);
    }

    onChatMessage(event) {
      const type = event.getType();
      if (type !== 'GAMEMESSAGE' && type !== 'SPAM') return; // (DIALOG: only skill challenge and Falo clues read the chat box)
      const message = event.getMessage();
      if (message.endsWith(' the STASH unit.')) {
        if (this.clue instanceof EmoteClue && this.clickedSTASHClue != null && message === 'You withdraw your items from the STASH unit.') this.activeSTASHClue = this.clickedSTASHClue;
        else if (message === 'You deposit your items into the STASH unit.') this.activeSTASHClue = null;
        this.clickedSTASHClue = null;
      }
    }

    onMenuOptionClicked(event) {
      if (event.getMenuOption() == null) return;
      if (event.getMenuOption() === 'Read') {
        const itemId = event.getItemId ? event.getItemId() : -1;
        const itemComposition = itemManager.getItemComposition(itemId);
        if (itemComposition && isClueItemName(itemComposition.getName())) {
          this.clueItemId = itemComposition.getId();
          this.updateClue(ClueScrollPlugin.findClueScroll(this.clueItemId));
        }
      } else if (event.getMenuOption() === 'Search' && this.clue instanceof EmoteClue) {
        const emoteClue = this.clue;
        if (emoteClue.getStashUnit() != null && emoteClue.getStashUnit().getObjectId() === event.getId()) this.clickedSTASHClue = emoteClue;
      }
    }

    onItemContainerChanged(event) {
      const itemContainer = event.getItemContainer();
      if (!itemContainer) return;
      if (event.getContainerId() === InventoryID.WORN) { this.equippedItems = itemContainer.getItems(); return; }
      if (event.getContainerId() !== InventoryID.INV) return;
      const previousInventory = this.inventoryItems;
      this.inventoryItems = itemContainer.getItems();
      const contains = (id) => this.inventoryItems.some((it) => it && it.getId() === id);
      if (this.clue != null && this.clueItemId != null && !contains(this.clueItemId)) this.resetClue(true);
      // new clue items (Items are compared by id and quantity, as Item.equals)
      const prev = (previousInventory || []).map((it) => `${it.getId()}x${it.getQuantity()}`);
      const newInventoryClues = this.inventoryItems.filter((it) => {
        if (!it || it.getId() < 0) return false;
        const k = `${it.getId()}x${it.getQuantity()}`;
        const i = prev.indexOf(k);
        if (i >= 0) { prev.splice(i, 1); return false; }
        const def = client.getItemDefinition(it.getId());
        return def && isClueItemName(def.getName());
      });
      if (newInventoryClues.length) {
        const newClueId = newInventoryClues[0].getId();
        const identificationMode = this.config.identify();
        if (identificationMode === 'ON_PICKUP' || (identificationMode === 'IF_INACTIVE' && this.clue == null && this.clueItemId == null)) this.setActiveClue(newClueId);
      }
    }

    setActiveClue(itemId) {
      const clueScroll = ClueScrollPlugin.findClueScroll(itemId);
      if (clueScroll != null) { this.clueItemId = itemId; this.updateClue(clueScroll); }
    }

    onNpcSpawned(event) { this.checkClueNPCs(this.clue, [event.getNpc()]); }
    onNpcDespawned(event) {
      const npc = event.getNpc();
      const i = this.npcsToMark.findIndex((n) => n.getIndex() === npc.getIndex());
      if (i < 0) return;
      this.npcsToMark.splice(i, 1);
      if (this.npcsToMark.length === 0) client.clearHintArrow();
      else client.setHintArrow(this.npcsToMark[0]);
    }
    onDecorativeObjectDespawned(e) { this.namedObjectsToMark.delete(e.getDecorativeObject()); }
    onDecorativeObjectSpawned(e) { this.checkClueNamedObject(this.clue, e.getDecorativeObject()); }
    onGameObjectDespawned(e) { this.namedObjectsToMark.delete(e.getGameObject()); }
    onGameObjectSpawned(e) { this.checkClueNamedObject(this.clue, e.getGameObject()); }
    onGroundObjectDespawned(e) { this.namedObjectsToMark.delete(e.getGroundObject()); }
    onGroundObjectSpawned(e) { this.checkClueNamedObject(this.clue, e.getGroundObject()); }
    onWallObjectDespawned(e) { this.namedObjectsToMark.delete(e.getWallObject()); }
    onWallObjectSpawned(e) { this.checkClueNamedObject(this.clue, e.getWallObject()); }

    onConfigChanged(event) {
      if (event.getGroup() === GROUP && !this.config.displayHintArrows()) client.clearHintArrow();
    }

    onGameStateChanged(event) {
      const state = event.getGameState();
      if (state !== GameState.LOGGED_IN) this.namedObjectsToMark.clear();
      if (state === GameState.LOGIN_SCREEN) this.resetClue(true);
      else if (state === GameState.HOPPING) this.namedObjectCheckThisTick = true;
    }

    onGameTick() {
      // (WidgetLoaded's clientThread.invokeLater: the scroll's text arrives with or after the interface)
      if (this.pendingClueText) this.readClueText();
      this.objectsToMark = [];
      const clue = this.clue;
      if (isLocations(clue)) {
        const locations = clue.getLocations(this);
        if (locations.length > 0) this.addMapPoints(...locations);
      }
      if (isLocation(clue)) {
        const location = clue.getLocation(this);
        const locations = location ? [location] : [];
        const hintNpc = client.getHintArrowNpc();
        const npcHintArrowMarked = hintNpc != null && this.npcsToMark.some((n) => n.getIndex() === hintNpc.getIndex());
        if (!npcHintArrowMarked) client.clearHintArrow();
        for (const loc of locations) {
          if (loc.isInScene(client) && this.config.displayHintArrows() && !npcHintArrowMarked) client.setHintArrow(loc);
          this.addMapPoints(loc);
          if (isObjectClue(clue)) {
            const objectIds = clue.getObjectIds();
            if (objectIds.length > 0) this.highlightObjectsForLocation(loc, ...objectIds);
          }
        }
      }
      if (this.currentPlane !== client.getPlane()) {
        this.namedObjectsToMark.clear();
        this.currentPlane = client.getPlane();
        this.namedObjectCheckThisTick = true;
      } else if (this.namedObjectCheckThisTick) {
        this.namedObjectCheckThisTick = false;
        this.checkClueNamedObjects(this.clue);
      }
      // (Objectbox.ITEM's beginner / master clue: neither exists in 2007)
    }

    onWidgetLoaded(event) {
      if (event.getGroupId() === TRAIL_CLUETEXT) { this.pendingClueText = true; this.readClueText(); }
    }

    /** the scroll's text (2007's eight lines) -> findClueScroll, as RuneLite's TRAIL_CLUETEXT WidgetLoaded */
    readClueText() {
      const lines = [];
      for (const c of TRAIL_CLUETEXT_LINES) {
        const w = client.getWidget(TRAIL_CLUETEXT, c);
        if (w && w.getText()) lines.push(w.getText());
      }
      if (!lines.length) return;
      this.pendingClueText = false;
      const clueScroll = this.findClueScrollText(lines.join('<br>'));
      if (clueScroll != null) this.updateClue(clueScroll);
      else this.resetClue(true);
    }

    getClueScrollImage() { return itemManager.getImage(ItemID.TRAIL_CLUE_EASY_SIMPLE001); }
    getEmoteImage() { return this.resources['emote.png'] || null; }
    getSpadeImage() { return itemManager.getImage(ItemID.SPADE); }
    getMapArrow() { return this.resources['clue_arrow.png'] || null; }

    resetClue(withItemId) {
      if (withItemId) this.clueItemId = null;
      this.clue = null;
      worldMapPointManager.removeIf((p) => p instanceof ClueScrollWorldMapPoint);
      this.worldMapPointsSet = false;
      this.npcsToMark.length = 0;
      this.namedObjectsToMark.clear();
      if (this.config.displayHintArrows()) client.clearHintArrow();
      this.updateOverlayMenuEntries();
    }

    findClueScrollText(rawText) {
      const text = Text.sanitizeMultilineText(rawText).toLowerCase();
      if (text.includes('degrees') && text.includes('minutes')) return this.coordinatesToWorldPoint(text);
      const anagramClue = AnagramClue.forText(this, text);
      if (anagramClue != null) return anagramClue;
      const cipherClue = CipherClue.forText(text);
      if (cipherClue != null) return cipherClue;
      const crypticClue = CrypticClue.forText(text);
      if (crypticClue != null) return crypticClue;
      const emoteClue = EmoteClue.forText(text);
      if (emoteClue != null) return emoteClue;
      return null;
    }

    static findClueScroll(itemId) {
      return MapClue.forItemId(itemId) || CoordinateClue.forItemId(itemId) || AnagramClue.forItemId(itemId) || CipherClue.forItemId(itemId)
        || CrypticClue.forItemId(itemId) || EmoteClue.forItemId(itemId) || null;
    }

    /** "00 degrees 00 minutes north 07 degrees 13 minutes west" (some clues use "1 degree" instead of "01 degrees") */
    coordinatesToWorldPoint(text) {
      const splitText = text.split(' ');
      if (splitText.length !== 10) return null;
      if (!splitText[1].startsWith('degree') || !splitText[3].startsWith('minute')) return null;
      let degY = parseInt(splitText[0], 10); let minY = parseInt(splitText[2], 10);
      if (splitText[4] === 'south') { degY *= -1; minY *= -1; }
      let degX = parseInt(splitText[5], 10); let minX = parseInt(splitText[7], 10);
      if (splitText[9] === 'west') { degX *= -1; minX *= -1; }
      return CoordinateClue.forLocation(this.coordinatesToPoint(degX, minX, degY, minY));
    }

    /** https://oldschool.runescape.wiki/w/Treasure_Trails/Guide/Coordinates (Math.round of a double: floor(x + 0.5)) */
    coordinatesToPoint(degX, minX, degY, minY) {
      const x2 = 2440 + degX * 32 + Math.floor(minX / 1.875 + 0.5);
      const y2 = 3161 + degY * 32 + Math.floor(minY / 1.875 + 0.5);
      return new WorldPoint(x2, y2, 0);
    }

    addMapPoints(...points) {
      if (this.worldMapPointsSet) return;
      this.worldMapPointsSet = true;
      worldMapPointManager.removeIf((p) => p instanceof ClueScrollWorldMapPoint);
      for (const point of points) worldMapPointManager.add(new ClueScrollWorldMapPoint(point, this));
    }

    highlightObjectsForLocation(location, ...objectIds) {
      const localLocation = LocalPoint.fromWorld(client, location);
      if (localLocation == null) return;
      const tile = client.getScene().getTiles()[client.getPlane()][localLocation.getSceneX()][localLocation.getSceneY()];
      if (!tile) return;
      const objects = tile.getGameObjects().concat([tile.getDecorativeObject()]).filter(Boolean);
      for (const object of objects) {
        for (const id of objectIds) {
          if (object.getId() === id) { this.objectsToMark.push(object); continue; }
          const comp = client.getObjectDefinition(object.getId());
          const impostor = comp.getImpostorIds() != null ? comp.getImpostor() : comp;
          if (impostor != null && impostor.getId() === id) this.objectsToMark.push(object);
        }
      }
    }

    checkClueNPCs(clue, npcs) {
      if (!isNpcClue(clue)) return;
      const clueNpcs = clue.getNpcs(this);
      const clueNpcRegions = clue.getNpcRegions();
      if (clueNpcs == null || clueNpcs.length === 0) return;
      for (const npc of npcs) {
        if (npc == null || npc.getName() == null) continue;
        if (clueNpcRegions.length && !clueNpcRegions.includes(npc.getWorldLocation().getRegionID())) continue;
        for (const npcName of clueNpcs) {
          if (npc.getName() !== npcName) continue;
          if (!this.npcsToMark.some((n) => n.getIndex() === npc.getIndex())) this.npcsToMark.push(npc);
        }
      }
      if (this.npcsToMark.length && this.config.displayHintArrows()) client.setHintArrow(this.npcsToMark[0]);
    }

    // (NamedObjectClueScroll: only RuneLite's later clues name objects; kept for the code path)
    checkClueNamedObjects(clue) {
      if (!clue || typeof clue.getObjectNames !== 'function') return;
      const tiles = client.getScene().getTiles()[client.getPlane()];
      for (const row of tiles) for (const tile of row) { if (!tile) continue; for (const object of tile.getGameObjects()) if (object) this.checkClueNamedObject(clue, object); }
    }
    checkClueNamedObject(clue, object) {
      if (!clue || typeof clue.getObjectNames !== 'function') return;
      const objectNames = clue.getObjectNames(); const regionIds = clue.getObjectRegions();
      if (!objectNames || !objectNames.length || (regionIds && !regionIds.includes(object.getWorldLocation().getRegionID()))) return;
      const comp = client.getObjectDefinition(object.getId());
      const impostor = comp.getImpostorIds() != null ? comp.getImpostor() : comp;
      for (const name of objectNames) if (comp.getName() === name || impostor.getName() === name) this.namedObjectsToMark.add(object);
    }

    updateClue(clue) {
      if (clue == null || clue === this.clue) return;
      this.resetClue(false);
      this.checkClueNPCs(clue, client.getTopLevelWorldView().npcs());
      this.checkClueNamedObjects(clue);
      this.clue = clue;
      this.updateOverlayMenuEntries();
    }

    highlightWidget(graphics, toHighlight, container, padding, text) {
      padding = padding || new Rectangle();
      const canvasLocation = toHighlight.getCanvasLocation();
      if (canvasLocation == null) return;
      const windowLocation = container.getCanvasLocation();
      if (windowLocation.getY() > canvasLocation.getY() + toHighlight.getHeight() || windowLocation.getY() + container.getHeight() < canvasLocation.getY()) return;
      const widgetArea = new Rectangle(
        canvasLocation.getX() - padding.x,
        Math.max(canvasLocation.getY(), windowLocation.getY()) - padding.y,
        toHighlight.getWidth() + padding.x + padding.width,
        Math.min(
          Math.min(windowLocation.getY() + container.getHeight() - canvasLocation.getY(), toHighlight.getHeight()),
          Math.min(canvasLocation.getY() + toHighlight.getHeight() - windowLocation.getY(), toHighlight.getHeight())) + padding.y + padding.height);
      OverlayUtil.renderHoverableArea(graphics, widgetArea, client.getMouseCanvasPosition(), HIGHLIGHT_FILL_COLOR, HIGHLIGHT_BORDER_COLOR, HIGHLIGHT_HOVER_BORDER_COLOR);
      if (text == null) return;
      const fontMetrics = graphics.getFontMetrics();
      this.textComponent.setPosition(new Point(canvasLocation.getX() + Math.trunc(toHighlight.getWidth() / 2) - Math.trunc(fontMetrics.stringWidth(text) / 2), canvasLocation.getY() + fontMetrics.getHeight()));
      this.textComponent.setText(text);
      this.textComponent.render(graphics);
    }

    updateOverlayMenuEntries() {
      const o = this.clueScrollOverlay;
      if (typeof o.removeMenuEntry === 'function') for (const n of ['Set note', 'Set note 1', 'Set note 2', 'Set note 3']) o.removeMenuEntry('RUNELITE_OVERLAY', n, 'Clue Scroll overlay');
      if (this.clue == null) return;
      const keys = this.clue.getConfigKeys();
      if (keys == null) return;
      if (keys.length === 1) o.addMenuEntry('RUNELITE_OVERLAY', 'Set note', 'Clue Scroll overlay', this.setNoteConsumer(keys[0]));
      else for (let i = 0; i < Math.min(keys.length, 3); ++i) o.addMenuEntry('RUNELITE_OVERLAY', `Set note ${i + 1}`, 'Clue Scroll overlay', this.setNoteConsumer(keys[i]));
    }
    setNoteConsumer(key) {
      return () => rl.chatboxPanelManager.openTextInput('Enter note')
        .value(this.getClueNote(key) || '')
        .onDone((s) => { if (!s) this.unsetClueNote(key); else this.setClueNote(key, s); })
        .build();
    }
    setClueNote(key, note) { rl.configManager.setConfiguration(GROUP, CLUE_NOTE_KEY_PREFIX + key, note); }
    unsetClueNote(key) { rl.configManager.unsetConfiguration(GROUP, CLUE_NOTE_KEY_PREFIX + key); }
    getClueNote(key) { return rl.configManager.getConfiguration(GROUP, CLUE_NOTE_KEY_PREFIX + key); }
  }

  const plugin = new ClueScrollPlugin();
  // for tests
  ll.cluescrolls = { plugin, ClueScrollPlugin, CrypticClue, AnagramClue, CipherClue, CoordinateClue, MapClue, EmoteClue, javaHash };
  rl.registerPlugin('cluescrolls', plugin);
})();
