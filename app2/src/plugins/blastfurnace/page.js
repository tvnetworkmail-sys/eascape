// RuneLite's Blast Furnace plugin, cloned from net.runelite.client.plugins.blastfurnace (BSD 2-Clause, Copyright (c) 2018,
// Seth <Sethtroll3@gmail.com> and RuneLite contributors): BlastFurnacePlugin, BarsOres, ForemanTimer, BlastFurnaceOverlay,
// BlastFurnaceCofferOverlay, BlastFurnaceClickBoxOverlay.
// The 2007 cache has the conveyor belt, bar dispenser and the ore / bar varbits at OSRS's ids (936-959). It has no coffer
// varbit (BLAST_FURNACE_COFFER) or BlastFurnaceHud interface yet (null below), so the coffer overlay waits for those.
// InterfaceID.ChatLeft.TEXT is the 2007 NPC dialogue (rl.npcChatText).
// Trimmed for Sept 2007: no lead / nickel ores, cupronickel bars (2025) or smiths' uniform ice gloves (2021).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Skill, Color, Overlay, OverlayPanel, OverlayPosition, Timer, ImageComponent, LineComponent, ComponentOrientation, QuantityFormatter, Text, InventoryID } = rl;

  const ObjectID = { BLAST_FURNACE_DISPENSER: 9092, BLAST_FURNACE_CONVEYER_BELT_CLICKABLE: 9100 };
  const VarbitID = { BLAST_FURNACE_BARS_HOT: 936, BLAST_FURNACE_COFFER: null };
  const BLAST_FURNACE_HUD_DISPLAY = null; // InterfaceID.BlastFurnaceHud.DISPLAY (not in the 2007 cache yet)
  const ItemID = { ICE_GLOVES: 1580, CERT_ARRAVSHIELD1: 764 };

  // BarsOres: varbit, item
  const BarsOres = [
    ['COPPER_ORE', 959, 436], ['TIN_ORE', 950, 438], ['IRON_ORE', 951, 440], ['COAL', 949, 453], ['MITHRIL_ORE', 952, 447],
    ['ADAMANTITE_ORE', 953, 449], ['RUNITE_ORE', 954, 451], ['SILVER_ORE', 956, 442], ['GOLD_ORE', 955, 444],
    ['BRONZE_BAR', 941, 2349], ['IRON_BAR', 942, 2351], ['STEEL_BAR', 943, 2353], ['MITHRIL_BAR', 944, 2359],
    ['ADAMANTITE_BAR', 945, 2361], ['RUNITE_BAR', 946, 2363], ['SILVER_BAR', 948, 2355], ['GOLD_BAR', 947, 2357],
  ].map(([name, varbit, itemID]) => ({ name, getVarbit: () => varbit, getItemID: () => itemID }));

  class ForemanTimer extends Timer {
    constructor(plugin) {
      super(10 * 60 * 1000, rl.itemManager.getImage(ItemID.CERT_ARRAVSHIELD1), plugin);
      this.setTooltip('Foreman Fee');
    }
    getEndTime() { return this.end; }
  }

  class BlastFurnaceOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.panelComponent.setOrientation(ComponentOrientation.HORIZONTAL);
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Blast furnace overlay');
    }
    render(graphics) {
      if (this.plugin.getConveyorBelt() == null) return null;
      for (const varbit of BarsOres) {
        const amount = client.getVarbitValue(varbit.getVarbit());
        if (amount === 0) continue;
        this.panelComponent.getChildren().push(new ImageComponent(rl.itemManager.getImage(varbit.getItemID(), amount, true)));
      }
      return super.render(graphics);
    }
  }

  const COST_PER_HOUR = 72000.0;
  // DurationFormatUtils.formatDuration(millis, "H'h' m'm' s's'", true)
  const formatDuration = (ms) => { const s = Math.trunc(ms / 1000); return `${Math.trunc(s / 3600)}h ${Math.trunc((s % 3600) / 60)}m ${s % 60}s`; };
  class BlastFurnaceCofferOverlay extends OverlayPanel {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.plugin = plugin; this.config = config;
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Coffer overlay');
    }
    render(graphics) {
      if (this.plugin.getConveyorBelt() == null) return null;
      const sack = BLAST_FURNACE_HUD_DISPLAY == null ? null : client.getWidget(BLAST_FURNACE_HUD_DISPLAY);
      if (sack != null) {
        const coffer = VarbitID.BLAST_FURNACE_COFFER == null ? 0 : client.getVarbitValue(VarbitID.BLAST_FURNACE_COFFER);
        sack.setHidden(true);
        this.panelComponent.getChildren().push(LineComponent.builder().left('Coffer:').right(QuantityFormatter.quantityToStackSize(coffer) + ' gp').build());
        if (this.config.showCofferTime()) {
          const millis = Math.trunc(coffer / COST_PER_HOUR * 60 * 60 * 1000);
          this.panelComponent.getChildren().push(LineComponent.builder().left('Time:').right(formatDuration(millis)).build());
        }
      }
      return super.render(graphics);
    }
  }

  const MAX_DISTANCE = 2350;
  class BlastFurnaceClickBoxOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.plugin = plugin; this.config = config;
    }
    render(graphics) {
      const dispenserState = client.getVarbitValue(VarbitID.BLAST_FURNACE_BARS_HOT);
      if (this.config.showConveyorBelt() && this.plugin.getConveyorBelt() != null) {
        const color = dispenserState === 1 ? Color.RED : Color.GREEN;
        this.renderObject(this.plugin.getConveyorBelt(), graphics, color);
      }
      if (this.config.showBarDispenser() && this.plugin.getBarDispenser() != null) {
        const hasIceGloves = this.hasIceGloves();
        const color = dispenserState === 2 && hasIceGloves ? Color.GREEN : (dispenserState === 3 ? Color.GREEN : Color.RED);
        this.renderObject(this.plugin.getBarDispenser(), graphics, color);
      }
      return null;
    }
    hasIceGloves() {
      const equipmentContainer = client.getItemContainer(InventoryID.WORN);
      if (equipmentContainer == null) return false;
      return equipmentContainer.getItems().some((i) => i && i.getId() === ItemID.ICE_GLOVES); // (no smiths' uniform in 2007)
    }
    renderObject(object, graphics, color) {
      const localLocation = client.getLocalPlayer().getLocalLocation();
      const mousePosition = client.getMouseCanvasPosition();
      const location = object.getLocalLocation();
      if (localLocation.distanceTo(location) <= MAX_DISTANCE) {
        const objectClickbox = object.getClickbox();
        if (objectClickbox != null) {
          if (mousePosition && objectClickbox.contains(mousePosition.getX(), mousePosition.getY())) graphics.setColor(color.darker());
          else graphics.setColor(color);
          graphics.draw(objectClickbox);
          graphics.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), 20));
          graphics.fill(objectClickbox);
        }
      }
    }
  }

  const BAR_DISPENSER = ObjectID.BLAST_FURNACE_DISPENSER;
  const FOREMAN_PERMISSION_TEXT = 'Okay, you can use the furnace for ten minutes. Remember, you only need half as much coal as with a regular furnace.';

  class BlastFurnacePlugin {
    constructor() {
      this.configGroup = 'blastfurnace';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.conveyorBelt = null;
      this.barDispenser = null;
      this.foremanTimer = null;
      this.overlay = new BlastFurnaceOverlay(this);
      this.cofferOverlay = new BlastFurnaceCofferOverlay(this, this.config);
      this.clickBoxOverlay = new BlastFurnaceClickBoxOverlay(this, this.config);
    }
    getConveyorBelt() { return this.conveyorBelt; }
    getBarDispenser() { return this.barDispenser; }
    startUp() {
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.cofferOverlay);
      rl.overlayManager.add(this.clickBoxOverlay);
    }
    shutDown() {
      rl.infoBoxManager.removeIf((b) => b instanceof ForemanTimer);
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.cofferOverlay);
      rl.overlayManager.remove(this.clickBoxOverlay);
      this.conveyorBelt = null;
      this.barDispenser = null;
      this.foremanTimer = null;
    }
    onGameObjectSpawned(event) {
      const gameObject = event.getGameObject();
      switch (gameObject.getId()) {
        case ObjectID.BLAST_FURNACE_CONVEYER_BELT_CLICKABLE: this.conveyorBelt = gameObject; break;
        case BAR_DISPENSER: this.barDispenser = gameObject; break;
        default: break;
      }
    }
    onGameObjectDespawned(event) {
      const gameObject = event.getGameObject();
      switch (gameObject.getId()) {
        case ObjectID.BLAST_FURNACE_CONVEYER_BELT_CLICKABLE: this.conveyorBelt = null; break;
        case BAR_DISPENSER: this.barDispenser = null; break;
        default: break;
      }
    }
    onGameStateChanged(event) {
      if (event.getGameState() === rl.GameState.LOADING) {
        this.conveyorBelt = null;
        this.barDispenser = null;
      }
    }
    onGameTick() {
      const npcDialog = rl.npcChatText();
      if (npcDialog == null) return;
      // blocking dialog check until 5 minutes needed to avoid re-adding while dialog message still displayed
      const shouldCheckForemanFee = client.getRealSkillLevel(Skill.SMITHING) < 60
        && (this.foremanTimer == null || Math.trunc((this.foremanTimer.getEndTime() - Date.now()) / 60000) <= 5);
      if (shouldCheckForemanFee) {
        const npcText = Text.sanitizeMultilineText(npcDialog);
        if (npcText === FOREMAN_PERMISSION_TEXT) {
          rl.infoBoxManager.removeIf((b) => b instanceof ForemanTimer);
          this.foremanTimer = new ForemanTimer(this);
          rl.infoBoxManager.addInfoBox(this.foremanTimer);
        }
      }
    }
  }

  const plugin = new BlastFurnacePlugin();
  ll.__blastfurnace = { plugin, ForemanTimer, BarsOres };
  rl.registerPlugin('blastfurnace', plugin);
})();
