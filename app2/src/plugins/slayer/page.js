// RuneLite's Slayer plugin, cloned from net.runelite.client.plugins.slayer (BSD 2-Clause, Copyright (c)
// 2017, Tyler <https://github.com/tylerthardy>, Shaun Dreclin and RuneLite contributors): SlayerPlugin,
// SlayerOverlay, TargetWeaknessOverlay, TaskCounter, Task (data.js, trimmed to our server's tasks).
// 2007: the task is varps 394 (SLAYER_COUNT) and 395 (SLAYER_TARGET, OSRS's task ids); the SlayerTask DB
// table RuneLite reads the name from is data.js's (the server's names). Not in 2007, so left out: task
// areas (Konar), bosses, the original count and its modifier varbits, slayer points and streaks (2008+),
// superior foes, the slayer helmet / ring / eternal gem, and the "!task" command (RuneLite's chat server).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, ColorUtil, Overlay, OverlayPosition, OverlayLayer, OverlayUtil, Perspective, Counter, HighlightedNpc, WidgetItemOverlay, TextComponent, FontManager, Point } = rl;
  const data = ll.slayerData || { tasks: [], slayerTask: [] };

  const SLAYER_COUNT = 394; // VarPlayerID.SLAYER_COUNT
  const SLAYER_TARGET = 395; // VarPlayerID.SLAYER_TARGET
  const SLAYER_GEM = 4155; // ItemID.SLAYER_GEM
  const GROUP_NAME = 'slayer';
  const AMOUNT_KEY = 'amount'; const INIT_AMOUNT_KEY = 'initialAmount'; const TASK_NAME_KEY = 'taskName'; const TASK_LOC_KEY = 'taskLocation';

  class Task {
    constructor(t) { Object.assign(this, t); }
    getName() { return this.name; }
    getItemSpriteId() { return this.itemSpriteId; }
    getTargetNames() { return this.targetNames; }
    getWeaknessThreshold() { return this.weaknessThreshold; }
    getWeaknessItem() { return this.weaknessItem; }
    static getTask(taskName) { return taskName == null ? null : TASKS.get(taskName.toLowerCase()) || null; }
  }
  const TASKS = new Map(data.tasks.map((t) => [t.name.toLowerCase(), new Task(t)]));

  class TaskCounter extends Counter {
    constructor(itemId, plugin, amount) { super(null, plugin, amount); this.itemId = itemId; }
    // (ItemManager.getImage: an AsyncBufferedImage, there once the client has drawn the icon)
    getImage() { if (!this.image) this.image = rl.itemManager.getImage(this.itemId) || null; return this.image; }
  }

  class SlayerOverlay extends WidgetItemOverlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.showOnInventory();
      this.showOnEquipment();
    }
    renderItemOverlay(graphics, itemId, widgetItem) {
      if (itemId !== SLAYER_GEM) return; // ALL_SLAYER_ITEMS: the 2007 enchanted gem (no helm, ring or eternal gem)
      if (!this.config.showItemOverlay()) return;
      const amount = this.plugin.getAmount();
      if (amount <= 0) return;
      graphics.setFont(FontManager.getRunescapeSmallFont());
      const bounds = widgetItem.getCanvasBounds();
      const textComponent = new TextComponent();
      textComponent.setText(String(amount));
      textComponent.setPosition(new Point(bounds.x - 1, bounds.y - 1 + graphics.getFontMetrics().getHeight()));
      textComponent.render(graphics);
    }
  }

  class TargetWeaknessOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.plugin = plugin; this.config = config;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.UNDER_WIDGETS);
    }
    render(graphics) {
      const targets = this.plugin.getTargets();
      if (!targets.length || !this.config.weaknessPrompt()) return null;
      const curTask = Task.getTask(this.plugin.getTaskName());
      if (!curTask || curTask.getWeaknessThreshold() < 0 || curTask.getWeaknessItem() < 0) return null;
      const threshold = curTask.getWeaknessThreshold();
      const image = rl.itemManager.getImage(curTask.getWeaknessItem());
      if (!image) return null;
      for (const t of targets) {
        const target = client.getTopLevelWorldView().npcs().byIndex(t.getIndex()); // (our NPCs are snapshots: this frame's)
        const currentHealth = this.calculateHealth(target);
        if (currentHealth >= 0 && currentHealth <= threshold) this.renderTargetItem(graphics, target, image);
      }
      return null;
    }
    calculateHealth(target) {
      if (!target || target.getName() == null) return -1;
      const healthScale = target.getHealthScale();
      const healthRatio = target.getHealthRatio();
      // (NPCManager.getHealth: the 2007 protocol sends the NPC's hitpoints with each hit, so the scale is its maximum)
      const maxHealth = healthScale > 0 ? healthScale : null;
      if (healthRatio < 0 || healthScale <= 0 || maxHealth == null) return -1;
      return Math.trunc((maxHealth * healthRatio) / healthScale + 0.5);
    }
    renderTargetItem(graphics, actor, image) {
      const actorPosition = actor.getLocalLocation();
      const offset = actor.getLogicalHeight() + 40;
      if (!actorPosition || !image) return;
      const imageLoc = Perspective.getCanvasImageLocation(client, actorPosition, image, offset);
      if (imageLoc) OverlayUtil.renderImageLocation(graphics, imageLoc, image);
    }
  }

  const targetNamePattern = (targetName) => new RegExp('(?:\\s|^)' + targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)', 'i');
  const capsString = (str) => str.substring(0, 1).toUpperCase() + str.substring(1);

  class SlayerPlugin {
    constructor() {
      this.configGroup = GROUP_NAME;
      this.config = rl.configProxy(GROUP_NAME, () => this.configItems);
      this.targets = [];
      this.amount = 0; this.initialAmount = 0; this.taskLocation = null; this.taskName = null;
      this.counter = null; this.infoTimer = null; this.loginFlag = false;
      this.targetNames = [];
      this.overlay = new SlayerOverlay(this, this.config);
      this.targetWeaknessOverlay = new TargetWeaknessOverlay(this, this.config);
      this.isTarget = (n) => {
        const config = this.config;
        if ((config.highlightHull() || config.highlightTile() || config.highlightOutline()) && this.targets.some((t) => t.getIndex() === n.getIndex())) {
          const color = config.getTargetColor();
          return HighlightedNpc.builder().npc(n).highlightColor(color).fillColor(ColorUtil.colorWithAlpha(color, Math.trunc(color.getAlpha() / 12)))
            .hull(config.highlightHull()).tile(config.highlightTile()).outline(config.highlightOutline()).build();
        }
        return null;
      };
    }
    getTargets() { return this.targets; }
    getAmount() { return this.amount; }
    getInitialAmount() { return this.initialAmount; }
    getTaskName() { return this.taskName; }
    getTaskLocation() { return this.taskLocation; }
    startUp() {
      rl.npcOverlayService.registerHighlighter(this.isTarget);
      rl.overlayManager.add(this.overlay);
      rl.overlayManager.add(this.targetWeaknessOverlay);
      if (client.getGameState() === rl.GameState.LOGGED_IN) {
        this.loginFlag = true;
        this.updateTask();
      }
    }
    shutDown() {
      rl.npcOverlayService.unregisterHighlighter(this.isTarget);
      rl.overlayManager.remove(this.overlay);
      rl.overlayManager.remove(this.targetWeaknessOverlay);
      this.removeCounter();
      this.targets.length = 0;
    }
    onGameStateChanged(event) {
      switch (event.getGameState()) {
        case rl.GameState.HOPPING: case rl.GameState.LOGGING_IN: case rl.GameState.CONNECTION_LOST:
          this.loginFlag = true; // to avoid re-adding the infobox
          this.targets.length = 0;
          break;
        default:
      }
    }
    setProfileConfig(key, value) {
      if (value != null) rl.configManager.setRSProfileConfiguration(GROUP_NAME, key, value);
      else rl.configManager.unsetRSProfileConfiguration(GROUP_NAME, key);
    }
    save() {
      this.setProfileConfig(AMOUNT_KEY, this.amount);
      this.setProfileConfig(INIT_AMOUNT_KEY, this.initialAmount);
      this.setProfileConfig(TASK_NAME_KEY, this.taskName);
      this.setProfileConfig(TASK_LOC_KEY, this.taskLocation);
    }
    onNpcSpawned(e) { const npc = e.getNpc(); if (this.isTargetNpc(npc)) this.targets.push(npc); }
    onNpcDespawned(e) { const i = e.getNpc().getIndex(); this.targets = this.targets.filter((t) => t.getIndex() !== i); }
    onVarbitChanged(e) {
      const varpId = e.getVarpId();
      if (varpId === SLAYER_COUNT || varpId === SLAYER_TARGET) Promise.resolve().then(() => this.updateTask()); // (clientThread.invokeLater)
    }
    updateTask() {
      const amount = client.getVarpValue(SLAYER_COUNT);
      if (amount > 0) {
        const taskId = client.getVarpValue(SLAYER_TARGET);
        // client.getDBRowsByValue(DBTableID.SlayerTask.ID, COL_ID, 0, taskId) -> COL_NAME_UPPERCASE
        const taskRow = data.slayerTask.find((r) => r.id === taskId);
        if (!taskRow) return;
        const taskName = taskRow.name;
        const taskLocation = null; // (no task areas in 2007)
        const initialAmount = 0; // (no SLAYER_COUNT_ORIGINAL varp in 2007)
        if (this.loginFlag) {
          this.setTask(taskName, amount, initialAmount, taskLocation, false);
        } else if (taskName !== this.taskName || taskLocation !== this.taskLocation) {
          this.setTask(taskName, amount, initialAmount, taskLocation, true);
        } else if (amount !== this.amount) {
          this.amount = amount;
          this.setProfileConfig(AMOUNT_KEY, amount);
          if (this.config.showInfobox()) {
            this.addCounter();
            this.counter.setCount(amount);
            this.infoTimer = Date.now();
          }
        }
      } else if (this.amount > 0) {
        this.setTask('', 0, 0);
      }
    }
    onGameTick() {
      if (this.infoTimer != null && this.config.statTimeout() !== 0) {
        if (Date.now() - this.infoTimer >= this.config.statTimeout() * 60000) this.removeCounter();
      }
      this.loginFlag = false;
    }
    onConfigChanged(event) {
      if (event.getGroup() !== GROUP_NAME) return;
      if (event.getKey() === 'infobox') {
        if (this.config.showInfobox()) this.addCounter(); else this.removeCounter();
      } else {
        rl.npcOverlayService.rebuild();
      }
    }
    onMenuOptionClicked(e) {
      // the enchanted gem's "Check" (2007: an inventory item op, not a CC_OP)
      if (e.getMenuOption() === 'Check' && (e.getItemId() === SLAYER_GEM)) {
        this.infoTimer = Date.now();
        this.addCounter();
      }
    }
    isTargetNpc(npc) {
      if (!this.targetNames.length) return false;
      const composition = npc.getTransformedComposition();
      if (!composition) return false;
      const name = String(composition.getName()).replace(/ /g, ' ').toLowerCase();
      const actions = composition.getActions() || [];
      for (const target of this.targetNames) {
        if (target.test(name) && (actions.includes('Attack') || actions.includes('Pick'))) return true;
      }
      return false;
    }
    rebuildTargetNames(task) {
      this.targetNames = [];
      if (task) {
        for (const n of task.getTargetNames()) this.targetNames.push(targetNamePattern(n));
        this.targetNames.push(targetNamePattern(this.taskName.replace(/s$/, '')));
      }
    }
    rebuildTargetList() {
      this.targets = client.getNpcs().filter((npc) => this.isTargetNpc(npc));
    }
    setTask(name, amt, initAmt, location = null, addCounter = true) {
      this.taskName = name; this.amount = amt; this.initialAmount = initAmt; this.taskLocation = location;
      this.save();
      this.removeCounter();
      if (addCounter) { this.infoTimer = Date.now(); this.addCounter(); }
      const task = Task.getTask(name);
      this.rebuildTargetNames(task);
      this.rebuildTargetList();
      rl.npcOverlayService.rebuild();
    }
    addCounter() {
      if (!this.config.showInfobox() || this.counter || !this.taskName) return;
      const task = Task.getTask(this.taskName);
      const itemSpriteId = task ? task.getItemSpriteId() : SLAYER_GEM;
      let taskTooltip = ColorUtil.wrapWithColorTag(capsString(this.taskName), new Color(255, 119, 0)) + '</br>';
      if (this.taskLocation) taskTooltip += this.taskLocation + '</br>';
      // (Pts / Streak: no slayer points or streaks in 2007)
      if (this.initialAmount > 0) taskTooltip += ColorUtil.wrapWithColorTag('Start:', Color.YELLOW) + ' ' + this.initialAmount;
      this.counter = new TaskCounter(itemSpriteId, this, this.amount);
      this.counter.setTooltip(taskTooltip.replace(/<\/br>$/, ''));
      rl.infoBoxManager.addInfoBox(this.counter);
    }
    removeCounter() {
      if (!this.counter) return;
      rl.infoBoxManager.removeInfoBox(this.counter);
      this.counter = null;
    }
  }

  const plugin = new SlayerPlugin();
  rl.registerPlugin('slayer', plugin);
  ll.slayerTest = { plugin, Task };
})();
