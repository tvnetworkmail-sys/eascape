// RuneLite's Time Tracking plugin, cloned from net.runelite.client.plugins.timetracking (BSD 2-Clause, Copyright (c)
// 2018, Daniel Teo <https://github.com/takuyakanbr>, Abex, Psikoi and RuneLite contributors): TimeTrackingPlugin,
// FarmingTracker, FarmingWorld / FarmingRegion / FarmingPatch, PatchImplementation / Produce / PatchState / CropState
// (data.js, generated), CompostTracker, PaymentTracker, ClockManager / Timer / Stopwatch, and the model of the panel
// (TimeTrackingPanel, OverviewTabPanel / OverviewItemPanel, FarmingTabPanel / TimeablePanel, ClockTabPanel /
// TimerPanel / StopwatchPanel), which ui/panels/timetracking.js draws from what this publishes.
// 2007:
// - Patches: OSRS sends only the patches of the region you're in, on region-relative varbits (FARMING_TRANSMIT_A-N);
//   the 2007 client has every patch on its own global varbit (data.js maps RuneLite's patches to them), so every
//   patch is read on every tick, not only those of the regions around you. Herb and hops values are the 2007
//   cache's (data.js). The growth-tick offset is found as RuneLite finds it (an observed growth tick); the server's
//   own catch-up after you log in (all the growth while you were away, ~3 s in, an hour's worth each 3 s) is not
//   taken as observed ticks: the first 60 game ticks after logging in are treated as a new region.
// - No welcome screen (RuneLite skips the tick after it closes), no leagues worlds, no autoweed (2019): never set.
// - Left out (later than Sept 2007): bird houses (2017), the farming contract and its infobox (2019), the grape,
//   hardwood, redwood, anima, hespori, seaweed, coral, celastrus and crystal patches, the big compost bin and
//   ultracompost, the Falador elite diary's free protection (diaries, 2010), and the "Farming Tick Offset" tab (only in
//   RuneLite's developer mode); "::resetfarmtick" (RuneLite's command; "::" lines go to our server).
// - CompostTracker: any item used (or a spell cast) on a patch starts the pending action (the 2007 client's selected
//   item isn't read); the chat message tells which compost, as in RuneLite. PaymentTracker: the 2007 NPC dialogue is
//   interfaces 241-244 (head 0, name 1, a component per line from 2), so the farmer's lines are joined; the patch
//   choice is the 2007 two-option menu (228).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  const D = ll && ll.timetrackingData;
  if (!rl || !D) return;
  const { client, Text } = rl;
  const { Produce, PatchImplementation } = D;

  const CONFIG_GROUP = 'timetracking';
  const FARM_TICK_OFFSET = 'farmTickOffset';
  const FARM_TICK_OFFSET_PRECISION = 'farmTickOffsetPrecision';
  const AUTOWEED = 'autoweed';
  const TIMERS = 'timers';
  const STOPWATCHES = 'stopwatches';
  const PREFER_SOONEST = 'preferSoonest';
  const NOTIFY = 'notify';
  const COMPOST = 'compost';
  const PROTECTED = 'protected';
  const LOGIN_GRACE_TICKS = 60;

  const nowSec = () => Math.floor(Date.now() / 1000);
  const cm = () => rl.configManager;

  // ColorScheme
  const C = {
    PROGRESS_COMPLETE: [55, 240, 70], PROGRESS_INPROGRESS: [230, 198, 30], PROGRESS_ERROR: [230, 30, 30], MEDIUM_GRAY: [77, 77, 77],
    LIGHT_GRAY: [165, 165, 165], BRAND_ORANGE: [220, 138, 0], GRAY: [128, 128, 128], RED: [255, 0, 0],
  };
  // java.awt.Color.darker / brighter
  const darker = (c) => c.map((v) => Math.floor(v * 0.7));
  const brighter = (c) => c.map((v) => Math.min(255, Math.floor(v / 0.7)));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const CropStateColor = { HARVESTABLE: C.PROGRESS_COMPLETE, GROWING: C.PROGRESS_COMPLETE, DISEASED: C.PROGRESS_INPROGRESS, DEAD: C.PROGRESS_ERROR, EMPTY: C.MEDIUM_GRAY, FILLING: C.PROGRESS_INPROGRESS };

  // Tab (trimmed: no bird houses, grapes, or the developer-mode offset tab). The overview's icon, DS2_CRANDOR_NOTES, is
  // later than the 2007 cache: the Crandor map (1538) stands in.
  const Tab = {
    OVERVIEW: { name: 'Overview', itemID: 1538 },
    CLOCK: { name: 'Timers & Stopwatches', itemID: 2575 },
    ALLOTMENT: { name: 'Allotment Patches', itemID: 1965 },
    FLOWER: { name: 'Flower Patches', itemID: 2462 },
    HERB: { name: 'Herb Patches', itemID: 207 },
    TREE: { name: 'Tree Patches', itemID: 1515 },
    FRUIT_TREE: { name: 'Fruit Tree Patches', itemID: 2114 },
    HOPS: { name: 'Hops Patches', itemID: 6006 },
    BUSH: { name: 'Bush Patches', itemID: 6018 },
    SPECIAL: { name: 'Special Patches', itemID: 6004 },
  };
  for (const [k, v] of Object.entries(Tab)) v.key = k;
  const TAB_ORDER = Object.keys(Tab);
  const FARMING_TABS = ['HERB', 'TREE', 'FRUIT_TREE', 'SPECIAL', 'FLOWER', 'ALLOTMENT', 'BUSH', 'HOPS'];
  const IMPL_ORDER = Object.keys(PatchImplementation); // enum declaration order (data.js keeps it)
  const BASKET_APPLE_5 = 5386;
  const CompostState = { COMPOST: 6032, SUPERCOMPOST: 6034 };

  // PatchState.getStages / getTickRate
  const stagesOf = (s) => (s.cropState === 'HARVESTABLE' || s.cropState === 'FILLING' ? s.produce.harvestStages : s.produce.stages);
  const tickRateOf = (s) => (s.cropState === 'HARVESTABLE' ? s.produce.regrowTickrate : s.cropState === 'GROWING' ? s.produce.tickrate : 0);

  // ---------------------------------------------------------------- FarmingWorld
  const BOUNDS = {
    // Catherby: upstairs sends different varbits
    11062: (loc) => (loc.getX() >= 2816 && loc.getY() < 3456 ? loc.getX() < 2840 && loc.getY() >= 3440 && loc.getPlane() === 0 : true),
    // the fruit tree patch is always sent when upstairs in 11317
    11317: (loc) => loc.getX() >= 2840 || loc.getY() < 3440 || loc.getPlane() === 1,
    // Falador: not on the region boundary due to Port Sarim's spirit tree patch
    12083: (loc) => loc.getY() >= 3272,
    12082: (loc) => loc.getY() < 3272,
  };
  class FarmingWorld {
    constructor() {
      this.regions = new Map(); // region id -> [FarmingRegion]
      this.tabs = {};
      this.all = [];
      for (const r of D.REGIONS) {
        const region = { name: r.name, regionID: r.regionID, definite: r.definite, isInBounds: BOUNDS[r.regionID] || (() => true), toString: () => r.name };
        region.patches = r.patches.map((p) => ({
          region, name: p.name, varbit: p.varbit, implementation: PatchImplementation[p.impl], farmer: p.farmer, patchNumber: p.patchNumber,
          configKey() { return `${region.regionID}.${this.varbit}`; },
          notifyConfigKey() { return `${NOTIFY}.${region.regionID}.${this.varbit}`; },
        }));
        this.all.push(region);
        for (const id of [r.regionID, ...r.extra]) {
          if (!this.regions.has(id)) this.regions.set(id, []);
          this.regions.get(id).push(region);
        }
        for (const p of region.patches) (this.tabs[p.implementation.tab] = this.tabs[p.implementation.tab] || []).push(p);
      }
      // tabSorter: implementation, then region name, then patch name
      const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
      for (const list of Object.values(this.tabs)) {
        list.sort((a, b) => (IMPL_ORDER.indexOf(a.implementation.key) - IMPL_ORDER.indexOf(b.implementation.key)) || cmp(a.region.name, b.region.name) || cmp(a.name, b.name));
      }
    }

    getRegionsForLocation(location) {
      return (this.regions.get(location.getRegionID()) || []).filter((r) => r.isInBounds(location));
    }
  }

  // ---------------------------------------------------------------- CompostTracker
  const COMPOST_ACTION_TIMEOUT = 30;
  const COMPOST_USED_ON_PATCH = /^You treat the .+ with (ultra|super|)compost\.$/;
  const FERTILE_SOIL_CAST = /^The .+ has been treated with (ultra|super|)compost/;
  const ALREADY_TREATED = /^This .+ has already been (?:treated|fertilised) with (ultra|super|)compost(?: - the spell can't make it any more fertile)?\.$/;
  const INSPECT_PATCH = /^This is an? .+\. The soil has been treated with (ultra|super|)compost\..*$/;
  class CompostTracker {
    constructor(farmingWorld) { this.farmingWorld = farmingWorld; this.pendingCompostActions = new Map(); }
    static configKey(fp) { return `${fp.configKey()}.${COMPOST}`; }
    setCompostState(fp, state) {
      if (state == null) cm().unsetRSProfileConfiguration(CONFIG_GROUP, CompostTracker.configKey(fp));
      else cm().setRSProfileConfiguration(CONFIG_GROUP, CompostTracker.configKey(fp), state);
    }
    getCompostState(fp, profile) {
      const v = profile ? cm().getConfiguration(CONFIG_GROUP, profile, CompostTracker.configKey(fp)) : cm().getRSProfileConfiguration(CONFIG_GROUP, CompostTracker.configKey(fp));
      return CompostState[v] ? v : null;
    }
    onMenuOptionClicked(e) {
      if (!this.isCompostAction(e)) return;
      const actionLocation = new rl.WorldPoint(client.getBaseX() + e.getParam0(), client.getBaseY() + e.getParam1(), client.getPlane()); // WorldPoint.fromScene
      const varbit = this.patchVarbitAt(e.getParam0(), e.getParam1());
      if (varbit < 0) return;
      let targetPatch = null;
      for (const fr of this.farmingWorld.getRegionsForLocation(actionLocation)) {
        for (const fp of fr.patches) if (!targetPatch && fp.varbit === varbit && fp.implementation.key !== 'COMPOST') targetPatch = fp;
      }
      if (targetPatch == null) return;
      this.pendingCompostActions.set(targetPatch, { timeout: nowSec() + COMPOST_ACTION_TIMEOUT, patchLocation: actionLocation, farmingPatch: targetPatch, sceneX: e.getParam0(), sceneY: e.getParam1() });
    }
    /** the varbit of the patch loc on that scene tile (ObjectComposition.getVarbitId), or -1 */
    patchVarbitAt(sx, sy) {
      const tiles = client.getScene().getTiles();
      const t = tiles && tiles[client.getPlane()] && tiles[client.getPlane()][sx] ? tiles[client.getPlane()][sx][sy] : null;
      if (!t) return -1;
      for (const go of t.getGameObjects() || []) {
        if (!go) continue;
        const v = client.getObjectDefinition(go.getId()).getVarbitId();
        if (v >= 0) return v;
      }
      return -1;
    }
    isCompostAction(e) {
      switch (e.getMenuAction()) {
        case rl.MenuAction.WIDGET_TARGET_ON_GAME_OBJECT:
        case rl.MenuAction.ITEM_USE_ON_GAME_OBJECT:
          return true;
        case rl.MenuAction.GAME_OBJECT_FIRST_OPTION: case rl.MenuAction.GAME_OBJECT_SECOND_OPTION: case rl.MenuAction.GAME_OBJECT_THIRD_OPTION:
        case rl.MenuAction.GAME_OBJECT_FOURTH_OPTION: case rl.MenuAction.GAME_OBJECT_FIFTH_OPTION:
          return e.getMenuOption() === 'Inspect';
        default:
          return false;
      }
    }
    onChatMessage(e) {
      if (e.getType() !== 'GAMEMESSAGE' && e.getType() !== 'SPAM') return;
      const compostUsed = CompostTracker.determineCompostUsed(e.getMessage());
      if (compostUsed == null) return;
      this.expirePendingActions();
      for (const pc of this.pendingCompostActions.values()) {
        if (this.playerIsBesidePatch(pc)) {
          this.setCompostState(pc.farmingPatch, compostUsed);
          this.pendingCompostActions.delete(pc.farmingPatch);
          break;
        }
      }
    }
    onGameStateChanged(e) {
      if (e.getGameState() === 'LOGGED_IN' || e.getGameState() === 'LOADING') return;
      this.pendingCompostActions.clear();
    }
    playerIsBesidePatch(pc) {
      const me = client.getLocalPlayer();
      if (!me) return false;
      const tiles = client.getScene().getTiles();
      const t = tiles && tiles[client.getPlane()] && tiles[client.getPlane()][pc.sceneX] ? tiles[client.getPlane()][pc.sceneX][pc.sceneY] : null;
      let patchObject = null;
      for (const go of (t && t.getGameObjects()) || []) {
        if (go && client.getObjectDefinition(go.getId()).getVarbitId() === pc.farmingPatch.varbit) { patchObject = go; break; }
      }
      if (!patchObject) return false;
      const p = me.getWorldLocation();
      const minX = pc.patchLocation.getX(); const minY = pc.patchLocation.getY();
      const maxX = minX + patchObject.sizeX - 1; const maxY = minY + patchObject.sizeY - 1;
      return p.getX() >= minX - 1 && p.getX() <= maxX + 1 && p.getY() >= minY - 1 && p.getY() <= maxY + 1;
    }
    expirePendingActions() {
      for (const [k, v] of this.pendingCompostActions) if (nowSec() > v.timeout) this.pendingCompostActions.delete(k);
    }
    static determineCompostUsed(msg) {
      if (!msg.includes('compost')) return null;
      const m = COMPOST_USED_ON_PATCH.exec(msg) || FERTILE_SOIL_CAST.exec(msg) || ALREADY_TREATED.exec(msg) || INSPECT_PATCH.exec(msg);
      if (!m) return null;
      return m[1] === 'super' ? 'SUPERCOMPOST' : m[1] === 'ultra' ? 'ULTRACOMPOST' : 'COMPOST';
    }
  }

  // ---------------------------------------------------------------- PaymentTracker
  const PAYMENT_TEXT = new Set([
    "That'll do nicely, sir. Leave it with me - I'll make sure<br>that patch grows for you.",
    "That'll do nicely, madam. Leave it with me - I'll make<br>sure that patch grows for you.",
    "That'll do nicely. Leave it with me - I'll make sure that<br>patch grows for you.",
    "That'll do nicely, iknami. Leave it with me - I'll make<br>sure that patch grows for you.",
    "Alright, leave it with me. I'll look after that nursery for<br>you.",
  ].map((s) => s.replace(/<br>/g, ' ')));
  const NPC_CHATHEAD = 2;
  const CHATMENU_2007 = 228;
  class PaymentTracker {
    constructor(farmingWorld) { this.farmingWorld = farmingWorld; this.lastSelectedOption = 0; }
    onGameTick() {
      // InterfaceID.ChatLeft: the 2007 npcchat1-4 (241-244)
      for (let g = 241; g <= 244; g++) {
        const head = client.getWidget(g, 0);
        if (!head || head.isHidden()) continue;
        const lines = [];
        for (let c = 2; c < 2 + (g - 240); c++) { const w = client.getWidget(g, c); if (w) lines.push(w.getText()); }
        const text = lines.join(' ').replace(/ +/g, ' ').trim();
        const name = client.getWidget(g, 1);
        if (!PAYMENT_TEXT.has(text) || !name || head.getModelType() !== NPC_CHATHEAD) return;
        const patch = this.findPatchForNpc(head.getModelId());
        if (patch == null || this.getProtectedState(patch)) return;
        this.setProtectedState(patch, true);
        return;
      }
    }
    onMenuOptionClicked(opt) {
      const comp = opt.getParam1();
      if (opt.getMenuOption() === 'Continue' && (comp >>> 16) === CHATMENU_2007) {
        const w = client.getWidget(comp);
        const sub = comp & 0xffff;
        if (w && sub > 0 && PaymentTracker.isPatchOption(w.getText())) this.lastSelectedOption = sub - 1; // 0 is "Select an Option"
      } else if ((opt.getMenuAction() === rl.MenuAction.NPC_THIRD_OPTION || opt.getMenuAction() === rl.MenuAction.NPC_FOURTH_OPTION) && String(opt.getMenuOption()).startsWith('Pay')) {
        this.lastSelectedOption = opt.getMenuAction() === rl.MenuAction.NPC_THIRD_OPTION ? 0 : 1;
      }
    }
    static isPatchOption(name) { return name != null && (name.includes('Patch') || name.includes('allotment')); }
    static configKey(fp) { return `${fp.configKey()}.${PROTECTED}`; }
    setProtectedState(fp, state) {
      if (!state) cm().unsetRSProfileConfiguration(CONFIG_GROUP, PaymentTracker.configKey(fp));
      else cm().setRSProfileConfiguration(CONFIG_GROUP, PaymentTracker.configKey(fp), true);
    }
    getProtectedState(fp) { const v = cm().getRSProfileConfiguration(CONFIG_GROUP, PaymentTracker.configKey(fp)); return v === true || v === 'true'; }
    findPatchForNpc(npcId) {
      let p = null;
      const me = client.getLocalPlayer();
      if (!me) return null;
      for (const region of this.farmingWorld.getRegionsForLocation(me.getWorldLocation())) {
        for (const patch of region.patches) {
          if (patch.farmer === npcId && (patch.patchNumber === -1 || patch.patchNumber === this.lastSelectedOption)) p = patch;
        }
      }
      return p;
    }
  }

  // ---------------------------------------------------------------- FarmingTracker
  const intOf = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v) | 0);
  class FarmingTracker {
    constructor(plugin, farmingWorld, compostTracker, paymentTracker) {
      this.plugin = plugin; this.farmingWorld = farmingWorld; this.compostTracker = compostTracker; this.paymentTracker = paymentTracker;
      this.summaries = {}; this.completionTimes = {};
      this.wasNotified = new Map(); // profile|configKey -> boolean
      this.newRegionLoaded = false; this.lastRegions = null; this.firstNotifyCheck = true;
    }
    get config() { return this.plugin.config; }

    updateData(location, timeSinceModalClose) {
      let changed = false;
      for (const node of client.getComponentTable()) if (node.getModalMode() !== rl.WidgetModalMode.NON_MODAL) return false;
      // (autoweed, FARMING_BLOCKWEEDS: 2019, not in the 2007 cache)
      const newRegions = this.farmingWorld.getRegionsForLocation(location);
      const same = this.lastRegions && newRegions.length === this.lastRegions.length && newRegions.every((r) => this.lastRegions.includes(r));
      if (!same) this.newRegionLoaded = true;
      if (client.getTickCount() - this.plugin.loginTick < LOGIN_GRACE_TICKS) this.newRegionLoaded = true;
      const profile = cm().getRSProfileKey();
      // 2007: every patch (global varbits), not only those of the regions you're in
      for (const region of this.farmingWorld.all) {
        const unixNow = nowSec();
        for (const patch of region.patches) {
          const key = patch.configKey();
          const value = client.getVarbitValue(patch.varbit);
          const strVarbit = String(value);
          const storedValue = cm().getRSProfileConfiguration(CONFIG_GROUP, key);
          const currentPatchState = patch.implementation.forVarbitValue(value);
          if (currentPatchState == null) continue;
          if (storedValue != null) {
            const parts = String(storedValue).split(':');
            if (parts.length === 2) {
              if (parts[0] === strVarbit) {
                const unixTime = Number(parts[1]) || 0;
                if (unixTime + 5 * 60 > unixNow && unixNow + 30 > unixTime) continue;
              } else if (!this.newRegionLoaded && timeSinceModalClose > 1) {
                const previousPatchState = patch.implementation.forVarbitValue(Number(parts[0]) | 0);
                if (previousPatchState == null) continue;
                const patchTickRate = tickRateOf(previousPatchState);
                if (this.isObservedGrowthTick(previousPatchState, currentPatchState)) {
                  const storedOffsetPrecision = intOf(cm().getRSProfileConfiguration(CONFIG_GROUP, FARM_TICK_OFFSET_PRECISION));
                  const storedOffsetMins = intOf(cm().getRSProfileConfiguration(CONFIG_GROUP, FARM_TICK_OFFSET));
                  const offsetMins = Math.abs((Math.floor(nowSec() / 60) % patchTickRate) - patchTickRate);
                  if (storedOffsetMins != null && storedOffsetMins !== 0 && offsetMins !== storedOffsetMins % patchTickRate) {
                    console.warn(`[timetracking] Offset error! Observed new offset of ${offsetMins}, previous observed offset was ${storedOffsetMins} (${storedOffsetMins % patchTickRate})`);
                  }
                  if (storedOffsetPrecision == null || patchTickRate >= storedOffsetPrecision) {
                    cm().setRSProfileConfiguration(CONFIG_GROUP, FARM_TICK_OFFSET_PRECISION, patchTickRate);
                    cm().setRSProfileConfiguration(CONFIG_GROUP, FARM_TICK_OFFSET, offsetMins);
                  }
                }
                if (tickRateOf(currentPatchState) !== 0
                  && !(previousPatchState.cropState === 'GROWING' && currentPatchState.cropState === 'HARVESTABLE' && currentPatchState.produce.patchImplementation.healthCheckRequired)) {
                  this.wasNotified.set(`${profile}|${key}`, false);
                }
              }
            }
          }
          if (currentPatchState.cropState === 'DEAD' || currentPatchState.cropState === 'HARVESTABLE' || currentPatchState.cropState === 'EMPTY') {
            this.compostTracker.setCompostState(patch, null);
            this.paymentTracker.setProtectedState(patch, false);
          }
          cm().setRSProfileConfiguration(CONFIG_GROUP, key, `${strVarbit}:${unixNow}`);
          changed = true;
        }
      }
      this.newRegionLoaded = false;
      this.lastRegions = newRegions;
      if (changed) this.updateCompletionTime();
      return changed;
    }

    isObservedGrowthTick(previous, current) {
      const patchTickRate = tickRateOf(previous);
      const prevCs = previous.cropState; const curCs = current.cropState; const prevP = previous.produce;
      if (prevP === Produce.WEEDS || current.produce === Produce.WEEDS || current.produce !== prevP || patchTickRate <= 0) return false;
      if (prevCs === 'GROWING') {
        if ((curCs === 'GROWING' && current.stage - previous.stage === 1) || curCs === 'DISEASED') return true;
        if (curCs === 'HARVESTABLE' && !prevP.patchImplementation.healthCheckRequired) return true;
      }
      return prevCs === 'DISEASED' && curCs === 'DEAD';
    }

    predictPatch(patch, profile = cm().getRSProfileKey()) {
      if (profile == null) return null;
      const unixNow = nowSec();
      const autoweed = String(1) === String(cm().getConfiguration(CONFIG_GROUP, profile, AUTOWEED)); // Autoweed.ON.ordinal()
      const storedValue = cm().getConfiguration(CONFIG_GROUP, profile, patch.configKey());
      if (storedValue == null) return null;
      let unixTime = 0; let value = 0;
      const parts = String(storedValue).split(':');
      if (parts.length === 2) {
        const v = Number(parts[0]); const t = Number(parts[1]);
        if (Number.isInteger(v) && Number.isFinite(t)) { value = v; unixTime = t; }
      }
      if (unixTime <= 0) return null;
      const state = patch.implementation.forVarbitValue(value);
      if (state == null) return null;
      let stage = state.stage; let stages = stagesOf(state); let tickrate = tickRateOf(state);
      if (autoweed && state.produce === Produce.WEEDS) { stage = 0; stages = 1; tickrate = 0; }
      let doneEstimate = 0;
      if (tickrate > 0) {
        const tickNow = this.getTickTime(tickrate, 0, unixNow, profile);
        const tickTime = this.getTickTime(tickrate, 0, unixTime, profile);
        const delta = Math.trunc((tickNow - tickTime) / (tickrate * 60));
        doneEstimate = this.getTickTime(tickrate, stages - 1 - stage, tickTime, profile);
        stage += delta;
        if (stage >= stages) stage = stages - 1;
      }
      return { produce: state.produce, cropState: state.cropState, doneEstimate, stage, stages };
    }

    getTickTime(tickRate, ticks, requestedTime = nowSec(), profile = cm().getRSProfileKey()) {
      const offsetPrecisionMins = intOf(cm().getConfiguration(CONFIG_GROUP, profile, FARM_TICK_OFFSET_PRECISION));
      const offsetTimeMins = intOf(cm().getConfiguration(CONFIG_GROUP, profile, FARM_TICK_OFFSET));
      let calculatedOffsetTime = 0;
      if (offsetPrecisionMins != null && offsetTimeMins != null && (offsetPrecisionMins >= tickRate || offsetPrecisionMins >= 40)) {
        calculatedOffsetTime = (offsetTimeMins % tickRate) * 60;
      }
      const unixNow = requestedTime + calculatedOffsetTime;
      const timeOfCurrentTick = unixNow - (unixNow % (tickRate * 60));
      const timeOfGoalTick = timeOfCurrentTick + ticks * tickRate * 60;
      return timeOfGoalTick - calculatedOffsetTime;
    }

    loadCompletionTimes() { this.summaries = {}; this.completionTimes = {}; this.lastRegions = null; this.updateCompletionTime(); }
    getSummary(tab) { return this.summaries[tab] || 'UNKNOWN'; }
    getCompletionTime(tab) { const t = this.completionTimes[tab]; return t == null ? -1 : t; }

    updateCompletionTime() {
      for (const [tab, patches] of Object.entries(this.farmingWorld.tabs)) {
        let extremum = this.config.preferSoonest() ? Number.MAX_SAFE_INTEGER : 0;
        let allUnknown = true; let allEmpty = true;
        for (const patch of patches) {
          const prediction = this.predictPatch(patch);
          if (prediction == null || prediction.produce.itemID < 0) continue;
          allUnknown = false;
          if (prediction.produce !== Produce.WEEDS && prediction.produce !== Produce.SCARECROW && prediction.cropState !== 'EMPTY' && prediction.cropState !== 'FILLING') {
            allEmpty = false;
            extremum = this.config.preferSoonest() ? Math.min(extremum, prediction.doneEstimate) : Math.max(extremum, prediction.doneEstimate);
          }
        }
        let state; let completionTime;
        if (allUnknown) { state = 'UNKNOWN'; completionTime = -1; }
        else if (allEmpty) { state = 'EMPTY'; completionTime = -1; }
        else if (extremum <= nowSec()) { state = 'COMPLETED'; completionTime = 0; }
        else { state = 'IN_PROGRESS'; completionTime = extremum; }
        this.summaries[tab] = state; this.completionTimes[tab] = completionTime;
      }
    }

    checkCompletion() {
      const unixNow = nowSec();
      for (const profile of cm().getRSProfiles()) {
        const pk = profile.getKey();
        const offsetPrecisionMins = intOf(cm().getConfiguration(CONFIG_GROUP, pk, FARM_TICK_OFFSET_PRECISION));
        const offsetTimeMins = intOf(cm().getConfiguration(CONFIG_GROUP, pk, FARM_TICK_OFFSET));
        for (const patches of Object.values(this.farmingWorld.tabs)) {
          for (const patch of patches) {
            const id = `${pk}|${patch.configKey()}`;
            const patchNotified = this.wasNotified.get(id) || false;
            const sn = cm().getConfiguration(CONFIG_GROUP, pk, patch.notifyConfigKey());
            const shouldNotify = sn === true || sn === 'true';
            const prediction = this.predictPatch(patch, pk);
            if (prediction == null) continue;
            const tickRate = prediction.produce.tickrate;
            if (offsetPrecisionMins == null || offsetTimeMins == null || (offsetPrecisionMins < tickRate && offsetPrecisionMins < 40) || prediction.produce === Produce.WEEDS
              || unixNow <= prediction.doneEstimate || patchNotified || prediction.cropState === 'FILLING' || prediction.cropState === 'EMPTY') continue;
            this.wasNotified.set(id, true);
            if (!this.firstNotifyCheck && shouldNotify) this.sendNotification(profile, prediction, patch);
          }
        }
      }
      this.firstNotifyCheck = false;
    }

    sendNotification(profile, prediction, patch) {
      let s = '';
      const me = client.getGameState() === 'LOGGED_IN' ? client.getLocalPlayer() : null;
      if (!(me && profile.getDisplayName() === me.getName())) s += `(${profile.getDisplayName()}) `;
      s += `Your ${prediction.produce.name}`;
      switch (prediction.cropState) {
        case 'HARVESTABLE': case 'GROWING':
          s += prediction.produce.name.toLowerCase().includes('compost') ? ' is ready to collect in ' : ' is ready to harvest in ';
          break;
        case 'DISEASED': s += ' has become diseased in '; break;
        case 'DEAD': s += ' has died in '; break;
        default: return;
      }
      s += `${patch.region.definite ? 'the ' : ''}${patch.region.name}.`;
      rl.notifier.notify(s);
    }
  }

  // ---------------------------------------------------------------- clocks: Timer, Stopwatch, ClockManager
  class Timer {
    constructor(o) {
      this.name = o.name; this.lastUpdate = o.lastUpdate == null ? nowSec() : o.lastUpdate; this.active = !!o.active;
      this.duration = o.duration | 0; this.remaining = o.remaining == null ? this.duration : o.remaining | 0; this.loop = !!o.loop; this.warning = false;
    }
    getDisplayTime() { return this.active ? Math.max(0, this.remaining - (nowSec() - this.lastUpdate)) : this.remaining; }
    setDuration(d) { this.duration = d; }
    start() {
      if (!this.active && this.duration > 0) {
        if (this.remaining <= 0) { this.remaining = this.duration; this.warning = false; }
        this.lastUpdate = nowSec(); this.active = true; return true;
      }
      return false;
    }
    pause() {
      if (this.active) { this.active = false; this.remaining = Math.max(0, this.remaining - (nowSec() - this.lastUpdate)); this.lastUpdate = nowSec(); return true; }
      return false;
    }
    reset() { this.active = false; this.remaining = this.duration; this.lastUpdate = nowSec(); }
    isWarning() { return this.warning && this.remaining > 0; }
    toJSON() { return { duration: this.duration, remaining: this.remaining, loop: this.loop, name: this.name, lastUpdate: this.lastUpdate, active: this.active }; }
  }
  class Stopwatch {
    constructor(o) { this.name = o.name; this.lastUpdate = o.lastUpdate == null ? nowSec() : o.lastUpdate; this.active = !!o.active; this.elapsed = o.elapsed | 0; this.laps = Array.isArray(o.laps) ? o.laps.slice() : []; }
    getDisplayTime() { return this.active ? Math.max(0, this.elapsed + (nowSec() - this.lastUpdate)) : this.elapsed; }
    setDuration(d) { this.elapsed = d; }
    start() { if (!this.active) { this.lastUpdate = nowSec(); this.active = true; return true; } return false; }
    pause() {
      if (this.active) { this.active = false; this.elapsed = Math.max(0, this.elapsed + (nowSec() - this.lastUpdate)); this.lastUpdate = nowSec(); return true; }
      return false;
    }
    lap() { this.laps.push(this.getDisplayTime()); }
    reset() { this.active = false; this.elapsed = 0; this.laps = []; this.lastUpdate = nowSec(); }
    toJSON() { return { elapsed: this.elapsed, laps: this.laps, name: this.name, lastUpdate: this.lastUpdate, active: this.active }; }
  }
  class ClockManager {
    constructor(plugin) { this.plugin = plugin; this.timers = []; this.stopwatches = []; }
    get config() { return this.plugin.config; }
    rebuild() { this.plugin.panelDirty = true; }
    addTimer() { this.timers.push(new Timer({ name: `Timer ${this.timers.length + 1}`, duration: this.config.defaultTimerMinutes() * 60 })); this.saveTimers(); this.rebuild(); }
    addStopwatch() { this.stopwatches.push(new Stopwatch({ name: `Stopwatch ${this.stopwatches.length + 1}` })); this.saveStopwatches(); this.rebuild(); }
    removeTimer(t) { this.timers = this.timers.filter((x) => x !== t); this.saveTimers(); this.rebuild(); }
    removeStopwatch(s) { this.stopwatches = this.stopwatches.filter((x) => x !== s); this.saveStopwatches(); this.rebuild(); }
    getActiveTimerCount() { return this.timers.filter((t) => t.active).length; }
    getActiveStopwatchCount() { return this.stopwatches.filter((s) => s.active).length; }
    checkCompletion() {
      let changed = false;
      for (const timer of this.timers) {
        if (timer.active && timer.getDisplayTime() === 0) {
          timer.pause();
          changed = true;
          if (this.config.timerNotification()) rl.notifier.notify(`[${timer.name}] has finished counting down.`);
          if (timer.loop) timer.start();
        }
      }
      if (changed) { this.saveTimers(); this.rebuild(); }
      return changed;
    }
    checkTimerOrder() {
      const sortOrder = this.config.sortOrder();
      if (sortOrder !== 'NONE') {
        const cmp = sortOrder === 'DESC' ? (a, b) => b.getDisplayTime() - a.getDisplayTime() : (a, b) => a.getDisplayTime() - b.getDisplayTime();
        let inOrder = true;
        for (let i = 1; i < this.timers.length; i++) if (cmp(this.timers[i - 1], this.timers[i]) > 0) inOrder = false;
        if (!inOrder) { this.timers.sort(cmp); this.rebuild(); return true; }
      }
      return false;
    }
    checkForWarnings() { for (const t of this.timers) t.warning = t.getDisplayTime() <= this.config.timerWarningThreshold(); }
    parse(json) { try { const v = JSON.parse(json); return Array.isArray(v) ? v : null; } catch { return null; } }
    loadTimers() {
      const json = cm().getConfiguration(CONFIG_GROUP, TIMERS);
      const list = json ? this.parse(json) : null;
      if (list) { this.timers = list.map((o) => new Timer(o)); this.rebuild(); }
    }
    loadStopwatches() {
      const json = cm().getConfiguration(CONFIG_GROUP, STOPWATCHES);
      const list = json ? this.parse(json) : null;
      if (list) { this.stopwatches = list.map((o) => new Stopwatch(o)); this.rebuild(); }
    }
    saveToConfig() { this.saveTimers(); this.saveStopwatches(); }
    saveTimers() { cm().setConfiguration(CONFIG_GROUP, TIMERS, JSON.stringify(this.timers)); }
    saveStopwatches() { cm().setConfiguration(CONFIG_GROUP, STOPWATCHES, JSON.stringify(this.stopwatches)); }
  }

  // ClockPanel.getFormattedDuration / stringToSeconds
  const pad2 = (n) => String(n).padStart(2, '0');
  const getFormattedDuration = (d) => `${pad2(Math.floor(d / 3600))}:${pad2(Math.floor(d / 60) % 60)}:${pad2(d % 60)}`;
  function stringToSeconds(time) {
    if (/[hms]/.test(time)) {
      // Duration.parse("PT" + text): e.g. 1h30m, 90s, 1.5h
      const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i.exec(time.replace(/\s+/g, ''));
      if (!m || !(m[1] || m[2] || m[3])) throw new Error('DateTimeParseException');
      return Math.floor((Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)));
    }
    let duration = 0;
    const parts = time.split(':');
    for (let i = parts.length - 1, mult = 1; i >= 0 && mult <= 3600; i--, mult *= 60) {
      const n = parts[i].trim();
      if (!/^[+-]?\d+$/.test(n)) throw new Error('NumberFormatException');
      duration += parseInt(n, 10) * mult;
    }
    return duration;
  }

  // TabContentPanel.getFormattedEstimate
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function getFormattedEstimate(remainingSeconds, mode) {
    if (mode === 'RELATIVE') {
      let sb = 'in ';
      const duration = Math.floor((remainingSeconds + 59) / 60);
      const minutes = duration % 60; const hours = Math.floor(duration / 60) % 24; const days = Math.floor(duration / 1440);
      if (days > 0) sb += `${days}d `;
      if (hours > 0) sb += `${hours}h `;
      if (minutes > 0) sb += `${minutes}m `;
      return sb;
    }
    const now = new Date();
    const end = new Date(now.getTime() + remainingSeconds * 1000);
    let sb = '';
    if (end.getDay() !== now.getDay()) sb += `${DAYS[end.getDay()]} `;
    sb += 'at ';
    if (mode === 'ABSOLUTE_12H') {
      const h = end.getHours() % 12 || 12;
      sb += `${h}:${pad2(end.getMinutes())} ${end.getHours() < 12 ? 'AM' : 'PM'}`;
    } else sb += `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
    return sb;
  }

  // ---------------------------------------------------------------- 2006RS-2: our farming
  // Our patches aren't RuneLite's: each is a varbit of its own (transmitted) whose values our farming scripts give their
  // own meaning (farming_states.enum: value -> crop * 1000 + kind * 100 + stage), and the growth ticks come from a
  // clock the server keeps per player (farming.rs2). So on this server the farming tabs are fed from our data
  // (farming2006.js, made by tools/farming/app_export.py, the same as the normal app's patches.json) and from the
  // server: after you log in the app asks for your growth clock (::appfarming on, app only: eascape_app.rs2), which
  // the server keeps in transmitted varps (your growth offset + 1, and the clock minute your patches last grew up
  // to). Every growth tick is then the server's own: a tick at every clock minute m where (m - offset) is a multiple
  // of 5 x the type's interval; a growing crop goes up a stage a tick and is grown the tick after its last stage, a
  // diseased one dies at the next tick, weeds come back a stage a tick (as the normal app's farming plugin,
  // app/src/plugins/farming/game.js). Only disease, a random roll at each tick, can't be told in advance. What was
  // last seen of each patch and the clock are kept per account in the profile, so the tabs work while logged out.
  const F06 = !ll.c2007 ? ll.timetrackingFarming2006 : null;
  const TYPE_TAB = { allotment: 'ALLOTMENT', flower: 'FLOWER', herb: 'HERB', hops: 'HOPS', tree: 'TREE', fruit_tree: 'FRUIT_TREE', bush: 'BUSH' };
  const title06 = (n) => String(n).replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  class FarmingWorld2006 {
    constructor() {
      this.regions = new Map(); this.tabs = {}; this.all = [];
      const byPlace = new Map(); const impls = {};
      for (const p of F06.patches) {
        const type = F06.types[p.type];
        let region = byPlace.get(p.place);
        if (!region) {
          region = { name: p.place, regionID: 0, definite: false, patches: [], isInBounds: () => true, toString: () => p.place };
          byPlace.set(p.place, region); this.all.push(region);
        }
        const impl = impls[p.type] || (impls[p.type] = { key: type.key, name: type.title, tab: TYPE_TAB[type.key] || 'SPECIAL' });
        const patch = { region, name: '', varbit: p.varbit, implementation: impl, p06: p,
          configKey() { return `2006.${p.index}`; }, notifyConfigKey() { return `${NOTIFY}.2006.${p.index}`; } };
        region.patches.push(patch);
        (this.tabs[impl.tab] = this.tabs[impl.tab] || []).push(patch);
      }
      for (const list of Object.values(this.tabs)) list.sort((a, b) => (a.p06.type - b.p06.type) || (a.region.name < b.region.name ? -1 : a.region.name > b.region.name ? 1 : 0));
    }
    getRegionsForLocation() { return []; }
  }
  class FarmingTracker2006 {
    constructor(plugin, world) { this.plugin = plugin; this.farmingWorld = world; this.summaries = {}; this.completionTimes = {}; this.told = new Set(); this.lastCheck = Date.now(); }
    get config() { return this.plugin.config; }
    decode(p, varps) {
      const raw = ((varps[p.varp] | 0) >>> p.start) & ((1 << (p.end - p.start + 1)) - 1);
      const packed = (F06.decode[F06.types[p.type].key] || {})[raw];
      if (packed === undefined || packed < 0) return { raw, unknown: true };
      return { raw, crop: Math.floor(packed / 1000), kind: Math.floor(packed / 100) % 10, stage: packed % 100 };
    }
    lastStage(type, crop) {
      let max = 0;
      for (const packed of Object.values(F06.decode[F06.types[type].key] || {})) {
        if (packed < 0 || Math.floor(packed / 1000) !== crop) continue;
        const k = Math.floor(packed / 100) % 10;
        if (k >= 1 && k <= 3) max = Math.max(max, packed % 100);
      }
      return max;
    }
    timing(profile) { try { return JSON.parse(cm().getConfiguration(CONFIG_GROUP, profile, '2006.timing') || 'null'); } catch { return null; } }
    seen(patch, profile) { try { return JSON.parse(cm().getConfiguration(CONFIG_GROUP, profile, patch.configKey()) || 'null'); } catch { return null; } }
    /** the server's clock and every patch, as the client has them now (each game tick) */
    updateData() {
      const varps = client.getVarps();
      const offset = (varps[F06.appVarps.offset] | 0) - 1;
      const clock = varps[F06.appVarps.clock] | 0;
      if (offset < 0 || clock <= 0 || cm().getRSProfileKey() == null) return false;
      const now = Date.now();
      let changed = false;
      const t = this.timing(cm().getRSProfileKey());
      if (!t || t.clock !== clock || t.offset !== offset) {
        // the server's clock less the computer's, to the minute (the clock turns over a few seconds after its minute)
        const skew = t && t.clock === clock ? t.skew : Math.round((clock * 60000 - (now - 2500)) / 60000) * 60000;
        cm().setRSProfileConfiguration(CONFIG_GROUP, '2006.timing', JSON.stringify({ offset, clock, skew }));
        changed = true;
      }
      for (const region of this.farmingWorld.all) for (const patch of region.patches) {
        const state = this.decode(patch.p06, varps);
        const before = this.seen(patch, cm().getRSProfileKey());
        if (!before || before.raw !== state.raw) { cm().setRSProfileConfiguration(CONFIG_GROUP, patch.configKey(), JSON.stringify(state)); changed = true; }
      }
      if (changed) this.updateCompletionTime();
      return changed;
    }
    /** RuneLite's PatchPrediction: { produce, cropState, stage, stages, doneEstimate (unix seconds) } or null */
    predictPatch(patch, profile = cm().getRSProfileKey()) {
      if (profile == null) return null;
      const s = this.seen(patch, profile); const t = this.timing(profile);
      if (!s || s.unknown || !t || !t.clock) return null;
      const p = patch.p06; const { crop, kind, stage } = s;
      const period = F06.types[p.type].ticks * F06.tickMinutes;
      const mod = (n) => ((n % period) + period) % period;
      const first = t.clock + 1 + mod(t.offset - (t.clock + 1));
      const serverNow = Math.floor((Date.now() + (t.skew || 0)) / 60000);
      const passed = serverNow >= first ? Math.floor((serverNow - first) / period) + 1 : 0;
      const at = (n) => Math.floor(((first + (n - 1) * period) * 60000 - (t.skew || 0)) / 1000);
      const seenAt = Math.floor((t.clock * 60000 - (t.skew || 0)) / 1000);
      if (crop === 0) {
        const need = 3 - stage;
        return { produce: Produce.WEEDS, cropState: 'GROWING', stage: Math.min(3, stage + passed), stages: 4, doneEstimate: need > 0 ? at(need) : Math.min(seenAt, nowSec()) };
      }
      // (99: the dead herb every herb turns into, farming.constant ^farming_crop_herb_dead)
      const c = F06.crops[crop] || (crop === 99 ? { name: 'herbs', item: F06.types[p.type].icon } : {});
      const last = this.lastStage(p.type, crop);
      const produce = c.name === 'scarecrow' ? Produce.SCARECROW : { name: title06(c.name || `crop ${crop}`), itemID: c.item || F06.types[p.type].icon, tickrate: period };
      const out = { produce, stage: Math.min(stage, last + 1), stages: last + 2 };
      if (kind === 5 || kind === 6) return Object.assign(out, { cropState: 'HARVESTABLE', stage: out.stages - 1, doneEstimate: Math.min(seenAt, nowSec()) });
      if (kind === 7) return Object.assign(out, { cropState: passed > 0 ? 'HARVESTABLE' : 'GROWING', stage: out.stages - 1, doneEstimate: at(1) });
      if (kind === 4) return Object.assign(out, { cropState: 'DEAD', doneEstimate: seenAt });
      if (kind === 3) return passed > 0 ? Object.assign(out, { cropState: 'DEAD', doneEstimate: at(1) }) : Object.assign(out, { cropState: 'DISEASED', doneEstimate: seenAt });
      const need = last - stage + 1;
      if (passed >= need) return Object.assign(out, { cropState: 'HARVESTABLE', stage: out.stages - 1, doneEstimate: at(need) });
      return Object.assign(out, { cropState: 'GROWING', stage: stage + passed, doneEstimate: at(need) });
    }
    loadCompletionTimes() { this.summaries = {}; this.completionTimes = {}; this.updateCompletionTime(); }
    getSummary(tab) { return this.summaries[tab] || 'UNKNOWN'; }
    getCompletionTime(tab) { const t = this.completionTimes[tab]; return t == null ? -1 : t; }
    updateCompletionTime() {
      for (const tab of FARMING_TABS) {
        let extremum = this.config.preferSoonest() ? Number.MAX_SAFE_INTEGER : 0; let allUnknown = true; let allEmpty = true;
        for (const patch of this.farmingWorld.tabs[tab] || []) {
          const pr = this.predictPatch(patch);
          if (pr == null || pr.produce.itemID < 0) continue;
          allUnknown = false;
          if (pr.produce !== Produce.WEEDS && pr.produce !== Produce.SCARECROW && pr.cropState !== 'EMPTY') {
            allEmpty = false;
            extremum = this.config.preferSoonest() ? Math.min(extremum, pr.doneEstimate) : Math.max(extremum, pr.doneEstimate);
          }
        }
        let state; let time;
        if (allUnknown) { state = 'UNKNOWN'; time = -1; } else if (allEmpty) { state = 'EMPTY'; time = -1; } else if (extremum <= nowSec()) { state = 'COMPLETED'; time = 0; } else { state = 'IN_PROGRESS'; time = extremum; }
        this.summaries[tab] = state; this.completionTimes[tab] = time;
      }
    }
    /** RuneLite's notification: when a patch with its bell on comes done between one check and the next */
    checkCompletion() {
      const now = Date.now();
      for (const profile of cm().getRSProfiles()) {
        const pk = profile.getKey();
        for (const region of this.farmingWorld.all) for (const patch of region.patches) {
          const sn = cm().getConfiguration(CONFIG_GROUP, pk, patch.notifyConfigKey());
          if (!(sn === true || sn === 'true')) continue;
          const pr = this.predictPatch(patch, pk);
          if (!pr || pr.produce === Produce.WEEDS || pr.doneEstimate * 1000 > now || pr.doneEstimate * 1000 <= this.lastCheck) continue;
          const id = `${pk}:${patch.configKey()}:${pr.doneEstimate}`;
          if (this.told.has(id)) continue;
          this.told.add(id);
          if (pr.cropState === 'DEAD' || pr.cropState === 'DISEASED') continue;
          const me = client.getGameState() === 'LOGGED_IN' ? client.getLocalPlayer() : null;
          rl.notifier.notify(`${me && profile.getDisplayName() === me.getName() ? '' : `(${profile.getDisplayName()}) `}Your ${pr.produce.name} is ready to harvest in ${patch.region.name}.`);
        }
      }
      this.lastCheck = now;
      this.updateCompletionTime();
    }
  }

  // ---------------------------------------------------------------- TimeTrackingPlugin
  class TimeTrackingPlugin {
    constructor() {
      this.configGroup = CONFIG_GROUP;
      this.config = rl.configProxy(CONFIG_GROUP, () => this.configItems);
      this.farmingWorld = F06 ? new FarmingWorld2006() : new FarmingWorld();
      this.compostTracker = new CompostTracker(this.farmingWorld);
      this.paymentTracker = new PaymentTracker(this.farmingWorld);
      this.farmingTracker = F06 ? new FarmingTracker2006(this, this.farmingWorld) : new FarmingTracker(this, this.farmingWorld, this.compostTracker, this.paymentTracker);
      this.clockManager = new ClockManager(this);
      this.lastTickLocation = null;
      this.lastModalCloseTick = 0;
      this.loginTick = -LOGIN_GRACE_TICKS;
      this.profileKey = null;
      this.panelDirty = true;
    }

    startUp() {
      this.clockManager.loadTimers();
      this.clockManager.loadStopwatches();
      this.farmingTracker.loadCompletionTimes();
      this.lastUnit = -1;
      this.panelUpdate = setInterval(() => this.updatePanel(), 200);
      this.notifier = setInterval(() => this.checkCompletion(), 10000);
      this.publishIcons();
      this.publish();
    }

    shutDown() {
      this.lastTickLocation = null;
      clearInterval(this.panelUpdate); clearInterval(this.notifier);
      rl.panels.update('timetracking', null);
    }

    onConfigChanged(e) {
      if (e.getGroup() !== CONFIG_GROUP) return;
      if (this.clockManager.timers.length === 0 && e.getKey() === TIMERS) this.clockManager.loadTimers();
      else if (this.clockManager.stopwatches.length === 0 && e.getKey() === STOPWATCHES) this.clockManager.loadStopwatches();
      else if (e.getKey() === PREFER_SOONEST) this.farmingTracker.loadCompletionTimes();
      this.panelDirty = true;
    }

    onGameStateChanged(e) {
      if (e.getGameState() === 'LOGGED_IN') {
        // (logging in, not a scene load: LOADING -> LOGGED_IN)
        if (this.lastGameState !== 'LOADING' && this.lastGameState !== 'LOGGED_IN') this.loginTick = client.getTickCount();
        // RuneScapeProfileChanged
        const pk = cm().getRSProfileKey();
        if (pk !== this.profileKey) { this.profileKey = pk; this.onRuneScapeProfileChanged(); }
        // 2006RS-2: ask the server for the growth clock once each login (it forgets on logout)
        if (F06 && this.lastGameState !== 'LOADING' && this.lastGameState !== 'LOGGED_IN') this.askClock = Date.now() + 1500;
      }
      this.lastGameState = e.getGameState();
      this.compostTracker.onGameStateChanged(e);
    }

    onGameTick() {
      if (F06) {
        if (this.askClock && Date.now() >= this.askClock && ll.api && ll.api.command && ll.api.command('appfarming on')) this.askClock = 0;
        if (this.farmingTracker.updateData()) this.panelDirty = true;
        return;
      }
      this.paymentTracker.onGameTick();
      const loc = this.lastTickLocation;
      const player = client.getLocalPlayer();
      this.lastTickLocation = player == null ? null : player.getWorldLocation();
      if (loc == null || this.lastTickLocation == null || loc.getRegionID() !== this.lastTickLocation.getRegionID()) return;
      if (this.farmingTracker.updateData(loc, client.getTickCount() - this.lastModalCloseTick)) this.panelDirty = true;
    }

    onRuneScapeProfileChanged() { this.farmingTracker.loadCompletionTimes(); this.panelDirty = true; }

    onWidgetClosed(ev) { if (ev.getModalMode() !== rl.WidgetModalMode.NON_MODAL) this.lastModalCloseTick = client.getTickCount(); }
    onMenuOptionClicked(e) { this.compostTracker.onMenuOptionClicked(e); this.paymentTracker.onMenuOptionClicked(e); }
    onChatMessage(e) { this.compostTracker.onChatMessage(e); }

    checkCompletion() { this.farmingTracker.checkCompletion(); }

    activeTab() { const t = this.config.activeTab(); return Tab[t] ? t : 'CLOCK'; }
    getUpdateInterval() { return this.activeTab() === 'CLOCK' ? 1 : 50; }

    updatePanel() {
      const unitTime = Math.floor(Date.now() / 200);
      if (unitTime === this.lastUnit) return;
      this.lastUnit = unitTime;
      let changed = false;
      if (unitTime % 5 === 0) {
        changed = this.clockManager.checkCompletion();
        changed = this.clockManager.checkTimerOrder() || changed;
        this.clockManager.checkForWarnings();
      }
      const clocksRunning = this.activeTab() === 'CLOCK' && (this.clockManager.getActiveTimerCount() + this.clockManager.getActiveStopwatchCount()) > 0;
      if (this.panelDirty || changed || (unitTime % this.getUpdateInterval() === 0 && (this.activeTab() !== 'CLOCK' || clocksRunning))) {
        this.panelDirty = false;
        this.publish();
      }
    }

    // ---- the panel's model
    /** the item icons the panel shows (a data URL each), sent with the next state when new and again now and then
     *  (the panel keeps them) */
    publishIcons() {
      const ids = new Set([BASKET_APPLE_5, ...Object.values(CompostState), ...Object.values(Tab).map((t) => t.itemID), ...Object.values(Produce).map((p) => p.itemID)]);
      if (F06) for (const c of Object.values(F06.crops)) if (c.item) ids.add(c.item);
      this.icons = this.icons || {};
      let missing = false;
      for (const id of ids) {
        if (this.icons[id]) continue;
        const u = ll.itemIconUrl ? ll.itemIconUrl(id, 1) : null;
        if (u) { this.icons[id] = u; this.iconsNew = true; } else missing = true;
      }
      this.iconsMissing = missing;
    }

    overviewStatus(summary, completionTime) {
      switch (summary) {
        case 'COMPLETED': case 'IN_PROGRESS': {
          const duration = completionTime - nowSec();
          return duration <= 0 ? ['Ready', C.PROGRESS_COMPLETE] : [`Ready ${getFormattedEstimate(duration, this.config.timeFormatMode())}`, C.GRAY];
        }
        case 'EMPTY': return ['Empty', C.GRAY];
        default: return ['Unknown', C.GRAY];
      }
    }

    overview() {
      const items = [];
      const timers = this.clockManager.getActiveTimerCount(); const stopwatches = this.clockManager.getActiveStopwatchCount();
      items.push({ tab: 'CLOCK', icon: Tab.CLOCK.itemID, title: 'Timers', status: timers === 0 ? 'No active timers' : `${timers} active timer${timers === 1 ? '' : 's'}`, color: css(timers === 0 ? C.GRAY : C.PROGRESS_COMPLETE) });
      items.push({ tab: 'CLOCK', icon: Tab.CLOCK.itemID, title: 'Stopwatches', status: stopwatches === 0 ? 'No active stopwatches' : `${stopwatches} active stopwatch${stopwatches === 1 ? '' : 'es'}`, color: css(stopwatches === 0 ? C.GRAY : C.PROGRESS_COMPLETE) });
      for (const t of FARMING_TABS) {
        const [status, color] = this.overviewStatus(this.farmingTracker.getSummary(t), this.farmingTracker.getCompletionTime(t));
        items.push({ tab: t, icon: Tab[t].itemID, title: Tab[t].name, status, color: css(color) });
      }
      return items;
    }

    farmingTab(tab) {
      const unixNow = nowSec();
      const out = [];
      let lastImpl = null;
      for (const patch of this.farmingWorld.tabs[tab] || []) {
        if (patch.implementation !== lastImpl && patch.implementation.name) {
          out.push({ group: patch.implementation.name });
          lastImpl = patch.implementation;
        }
        const prediction = this.farmingTracker.predictPatch(patch);
        const prot = F06 ? false : this.paymentTracker.getProtectedState(patch);
        const compostState = F06 ? null : this.compostTracker.getCompostState(patch);
        let tooltip = '';
        if (prot) tooltip = ` protected${compostState != null ? ` and ${compostState.toLowerCase()}ed` : ''}`;
        else if (compostState != null) tooltip = ` with ${compostState.toLowerCase()}`;
        const row = {
          key: patch.configKey(),
          title: patch.region.name + (patch.name ? ` (${patch.name})` : ''),
          overlay: prot ? BASKET_APPLE_5 : compostState != null ? CompostState[compostState] : null,
          notify: (() => { const v = cm().getRSProfileConfiguration(CONFIG_GROUP, patch.notifyConfigKey()); return v === true || v === 'true'; })(),
        };
        if (prediction == null) {
          Object.assign(row, { icon: Produce.WEEDS.itemID, iconTip: `Unknown state${tooltip}`, estimate: 'Unknown', progress: null });
        } else {
          row.icon = prediction.produce.itemID < 0 ? null : prediction.produce.itemID;
          row.iconTip = prediction.produce.itemID < 0 ? `Unknown state${tooltip}` : prediction.produce.name + tooltip;
          switch (prediction.cropState) {
            case 'HARVESTABLE': row.estimate = 'Done'; break;
            case 'GROWING': row.estimate = prediction.doneEstimate < unixNow ? 'Done' : `Done ${getFormattedEstimate(prediction.doneEstimate - unixNow, this.config.timeFormatMode())}`; break;
            case 'DISEASED': row.estimate = 'Diseased'; break;
            case 'DEAD': row.estimate = 'Dead'; break;
            case 'EMPTY': row.estimate = 'Empty'; break;
            case 'FILLING': row.estimate = 'Filling'; break;
            default: row.estimate = '';
          }
          // hide any fully grown weeds' progress bar
          // ThinProgressBar: foreground the crop state's colour .darker(), background that .darker().darker(), (value * 100) / max
          const fg = darker(CropStateColor[prediction.cropState]);
          row.progress = prediction.produce !== Produce.WEEDS || prediction.stage < prediction.stages - 1
            ? { color: css(fg), background: css(darker(darker(fg))), percent: Math.trunc((prediction.stage * 100) / Math.max(1, prediction.stages - 1)) } : null;
        }
        out.push(row);
      }
      return out;
    }

    clocks() {
      const ACTIVE = brighter(C.LIGHT_GRAY); const INACTIVE = darker(C.LIGHT_GRAY);
      const timers = this.clockManager.timers.map((t, i) => {
        const base = t.active ? ACTIVE : INACTIVE;
        let color = t.isWarning() ? (t.active ? C.BRAND_ORANGE : darker(C.BRAND_ORANGE)) : base;
        if (t.getDisplayTime() === 0 && !t.active) color = darker(C.PROGRESS_ERROR);
        return { i, name: t.name, display: getFormattedDuration(t.getDisplayTime()), active: t.active, loop: t.loop, color: css(color), editable: !t.active };
      });
      const stopwatches = this.clockManager.stopwatches.map((s, i) => {
        let prev = 0;
        const laps = s.laps.map((lap, n) => { const r = [String(n + 1), getFormattedDuration(lap - prev), getFormattedDuration(lap)]; prev = lap; return r; });
        return { i, name: s.name, display: getFormattedDuration(s.getDisplayTime()), active: s.active, color: css(s.active ? ACTIVE : INACTIVE), laps };
      });
      return { timers, stopwatches };
    }

    publish() {
      if (this.iconsMissing) this.publishIcons();
      const tab = this.activeTab();
      const state = { tabs: TAB_ORDER.map((k) => ({ key: k, name: Tab[k].name, icon: Tab[k].itemID })), active: tab };
      this.publishes = (this.publishes || 0) + 1;
      if (this.iconsNew || this.publishes % 50 === 1) { state.icons = this.icons; this.iconsNew = false; }
      if (tab === 'OVERVIEW') state.overview = this.overview();
      else if (tab === 'CLOCK') state.clocks = this.clocks();
      else state.patches = this.farmingTab(tab);
      rl.panels.update('timetracking', state);
    }

    onPanelAction(a) {
      const cmgr = this.clockManager;
      const clock = a.kind === 'stopwatch' ? cmgr.stopwatches[a.i] : cmgr.timers[a.i];
      switch (a.action) {
        case 'tab': if (Tab[a.tab]) { this.config.setActiveTab ? this.config.setActiveTab(a.tab) : cm().setConfiguration(CONFIG_GROUP, 'activeTab', a.tab); } break;
        case 'notify': {
          const patch = this.farmingWorld.all.flatMap((r) => r.patches).find((p) => p.configKey() === a.key);
          if (patch && cm().getRSProfileKey() != null) cm().setRSProfileConfiguration(CONFIG_GROUP, patch.notifyConfigKey(), !!a.on);
          break;
        }
        case 'addTimer': cmgr.addTimer(); break;
        case 'addStopwatch': cmgr.addStopwatch(); break;
        case 'name': if (clock) { clock.name = String(a.value); cmgr.saveToConfig(); } break;
        case 'duration': if (clock) {
          let duration = 0;
          try { duration = stringToSeconds(String(a.value)); } catch { /* ignored */ }
          clock.setDuration(Math.max(0, duration)); clock.reset(); cmgr.checkForWarnings(); cmgr.saveTimers();
        } break;
        case 'startPause': if (clock) { if (clock.active) clock.pause(); else if (!clock.start()) break; cmgr.saveToConfig(); } break;
        case 'reset': if (clock) { clock.reset(); cmgr.checkForWarnings(); cmgr.saveToConfig(); } break;
        case 'loop': if (clock && a.kind === 'timer') clock.loop = !clock.loop; break;
        case 'lap': if (clock && a.kind === 'stopwatch') { clock.lap(); cmgr.saveStopwatches(); } break;
        case 'delete': if (clock) { if (a.kind === 'stopwatch') cmgr.removeStopwatch(clock); else cmgr.removeTimer(clock); } break;
        default: return;
      }
      this.panelDirty = true;
      this.publish();
      this.panelDirty = false;
    }
  }

  const plugin = new TimeTrackingPlugin();
  plugin._test = { FarmingWorld, FarmingTracker, CompostTracker, PaymentTracker, Timer, Stopwatch, ClockManager, getFormattedDuration, stringToSeconds, getFormattedEstimate, tickRateOf, stagesOf };
  ll.timetrackingTest = Object.assign({ plugin }, plugin._test);
  rl.registerPlugin('timetracking', plugin);
})();
