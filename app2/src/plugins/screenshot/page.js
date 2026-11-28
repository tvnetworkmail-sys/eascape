// RuneLite's Screenshot plugin, cloned from net.runelite.client.plugins.screenshot (BSD 2-Clause, Copyright (c) 2018,
// Lotto <https://github.com/devLotto> and RuneLite contributors): ScreenshotPlugin, ScreenshotConfig; saving is
// ImageCapture's (the app side: main.js 'screenshot-save', <userData>/screenshots/<player>/<subDir>/<name> <date>.png).
// The frame captured is the game canvas with everything drawn over it (the overlay canvases, our orbs), at its size on
// screen; RuneLite's "Include client frame" is left out (ours is the app's own title bar). The title bar button "Take
// screenshot" (right-click: "Open screenshot folder...") is in the app's toolbar (ui/chrome.js).
// 2007 interfaces (OSRS-style groups in the 2007 cache): the quest complete scrolls are 276 / 277 (OSRS QUESTSCROLL), the
// clue and Barrows reward chest share 364 (TRAIL_REWARDSCREEN / BARROWS_REWARD, told apart by the chat message before),
// the Miscellania collection 392 (MISC_COLLECTION). 2007's level-up and object boxes are chat dialogues of many groups,
// so the tick after one opens its texts are read (LevelupDisplay.TEXT2 / Objectbox.TEXT). The report button is the
// text component 548:26 (OSRS Chatbox.REPORTABUSE_TEXT1).
// Era-trim: pets, valuable / untradeable drops (no prices), collection log, combat achievements, league tasks, the
// wilderness loot chest, raids / Gauntlet / Moons / Colosseum / Doom, clan (not friends chat) deaths, friends chat
// kicks (no kick confirm script in 2007) and the level-up chat message option are left out.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, GameState, Player, Text, HotkeyListener } = rl;
  const GROUP = 'screenshot';
  const InterfaceID = { QUESTSCROLL: [276, 277], TRAIL_REWARDSCREEN: 364, BARROWS_REWARD: 364, MISC_COLLECTION: 392, REPORTABUSE_TEXT1: (548 << 16) | 26 };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = (n) => String(n).padStart(2, '0');
  const DATE_FORMAT = (d) => `${MONTHS[d.getMonth()]}. ${p2(d.getDate())}, ${d.getFullYear()}`; // "MMM. dd, yyyy"
  const TIME_FORMAT = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
  const LOCAL_DATE = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const NUMBER_PATTERN = /([,0-9]+)/;
  const LEVEL_UP_PATTERN = /^.*Your ([a-zA-Z]+) (?:level is|are)? now (\d+)\.$/;
  const BOSSKILL_MESSAGE_PATTERN = /Your (.+) (?:kill|success) count is: ?<col=[0-9a-f]{6}>([0-9,]+)<\/col>/;
  const DUEL_END_PATTERN = /You have now (won|lost) ([0-9,]+) duels?\./;
  const QUEST_PATTERN_1 = /^.+?ve\.*? (?<verb>been|rebuilt|.+?ed)? ?(?:the )?'?(?<quest>.+?)'?(?: [Qq]uest)?[!.]?$/;
  const QUEST_PATTERN_2 = /^'?(?<quest>.+?)'?(?: [Qq]uest)? (?<verb>[a-z]\w+?ed)?(?: f.*?)?[!.]?$/;
  const RFD_TAGS = ['Another Cook', 'freed', 'defeated', 'saved'];
  const WORD_QUEST_IN_NAME_TAGS = ['Another Cook', 'Doric', 'Heroes', 'Legends', 'Observatory', 'Olaf', 'Waterfall'];
  const BA_HIGH_GAMBLE_REWARD_PATTERN = /(?<reward>.+)!<br>High level gamble count: <col=7f0000>(?<gambleCount>.+)<\/col>/;
  const SD_KINGDOM_REWARDS = 'Kingdom Rewards';
  const SD_BOSS_KILLS = 'Boss Kills';
  const SD_CLUE_SCROLL_REWARDS = 'Clue Scroll Rewards';
  const SD_DUELS = 'Duels';
  const SD_PVP_KILLS = 'PvP Kills';
  const SD_DEATHS = 'Deaths';
  const SD_LEVELS = 'Levels';
  const KillType = { BARROWS: 'BARROWS' };
  const groupTexts = (g) => (ll.api && ll.api.comsOf ? ll.api.comsOf(g) || [] : []).map((c) => c && client.getWidget(c.id)).filter((w) => w).map((w) => w.getText()).filter((t) => t);

  /** the game canvas with every canvas drawn over it, at its size on screen (RuneLite's DrawManager frame) */
  function captureFrame() {
    const game = document.getElementById('canvas');
    if (!game) return null;
    const r = game.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const out = document.createElement('canvas');
    out.width = Math.round(r.width * dpr); out.height = Math.round(r.height * dpr);
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = false;
    const z = (el) => { const v = parseInt(getComputedStyle(el).zIndex, 10); return Number.isFinite(v) ? v : 0; };
    const layers = [...document.querySelectorAll('canvas')].filter((c) => c !== out && c.width && c.height && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden');
    // (in stacking order: the 3D view's canvas is under the game canvas, the overlays over it)
    layers.forEach((c, i) => { c.__order = i; });
    layers.sort((a, b) => z(a) - z(b) || a.__order - b.__order);
    for (const c of layers) {
      const cr = c.getBoundingClientRect();
      if (cr.right <= r.left || cr.left >= r.right || cr.bottom <= r.top || cr.top >= r.bottom) continue;
      try { g.drawImage(c, (cr.left - r.left) * dpr, (cr.top - r.top) * dpr, cr.width * dpr, cr.height * dpr); } catch { /* a tainted canvas */ }
    }
    return out.toDataURL('image/png');
  }
  // drawManager.requestNextFrameListener: the frame after the next one the client draws (the 2007 client draws its
  // interfaces after rl.viewDrawnHooks run), once the browser has shown it; a second's wait if no frame comes
  function requestNextFrameListener(fn) {
    let n = 0; let done = false;
    const finish = () => { if (done) return; done = true; const i = rl.viewDrawnHooks.indexOf(hook); if (i >= 0) rl.viewDrawnHooks.splice(i, 1); requestAnimationFrame(() => { const png = captureFrame(); if (png) fn(png); }); };
    const hook = () => { if (++n >= 3) finish(); };
    rl.viewDrawnHooks.push(hook);
    setTimeout(finish, 1500);
  }

  class ScreenshotPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.clueType = null; this.clueNumber = null;
      this.killType = null; this.killCountNumber = null;
      this.shouldTakeScreenshot = false;
      this.loadedGroup = -1;
      this.reportButtonText = null;
      this.consumers = [];
    }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      const self = this;
      this.hotkeyListener = this.hotkeyListener || new (class extends HotkeyListener { hotkeyPressed() { self.manualScreenshot(); } })(() => this.config.hotkey());
      rl.keyManager.registerKeyListener(this.hotkeyListener);
    }
    shutDown() {
      rl.keyManager.unregisterKeyListener(this.hotkeyListener);
      this.consumers.length = 0;
    }
    // the title bar button (ui/chrome.js)
    onPanelAction(a) {
      if (a.action === 'take') this.manualScreenshot();
      else if (a.action === 'openFolder') ll.post('rl-screenshot-folder', null);
    }
    onGameTick() {
      this.onFrame();
      // 2006RS-2: the tier of the last clue item in the pack (for our clue reward, onWidgetLoaded)
      if (!ll.c2007 && ll.clueTiers2006) {
        const inv = client.getItemContainer(rl.InventoryID.INV);
        for (const it of inv ? inv.getItems() : []) {
          const id = it.getId();
          const t = id > 0 && Object.keys(ll.clueTiers2006).find((k) => ll.clueTiers2006[k].some(([a, b]) => id >= a && id <= b));
          if (t) { this.lastClueTier = t; break; }
        }
      }
      if (!this.shouldTakeScreenshot) return;
      this.shouldTakeScreenshot = false;
      let screenshotSubDir = null;
      let fileName = null;
      const texts = groupTexts(this.loadedGroup);
      const levelText = texts.find((t) => LEVEL_UP_PATTERN.test(Text.removeTags(t).replace(/\s+/g, ' ')));
      const gambleText = texts.find((t) => Text.removeTags(t).includes('High level gamble'));
      if (InterfaceID.QUESTSCROLL.includes(this.loadedGroup)) {
        const text = texts.find((t) => /complete/i.test(t));
        if (text && this.config.screenshotRewards()) { fileName = ScreenshotPlugin.parseQuestCompletedWidget(Text.removeTags(text).replace(/\s+/g, ' ')); screenshotSubDir = 'Quests'; }
      } else if (gambleText) {
        if (this.config.screenshotHighGamble()) { fileName = ScreenshotPlugin.parseBAHighGambleWidget(gambleText); screenshotSubDir = 'BA High Gambles'; }
      } else if (levelText && this.config.screenshotLevels()) {
        fileName = this.parseLevelUpWidget(levelText);
        screenshotSubDir = SD_LEVELS;
      }
      if (fileName != null) this.takeScreenshot(fileName, screenshotSubDir);
    }
    onActorDeath(actorDeath) {
      const actor = actorDeath.getActor();
      if (!(actor instanceof Player)) return;
      const me = client.getLocalPlayer();
      const isMe = !!me && actor.getName() === me.getName();
      if (isMe && this.config.screenshotPlayerDeath()) this.takeScreenshot('Death', SD_DEATHS);
      else if (!isMe && actor.getCanvasTilePoly() != null && (actor.isFriendsChatMember() || actor.isFriend()) && this.config.screenshotFriendDeath()) {
        this.takeScreenshot('Death ' + actor.getName(), SD_DEATHS);
      }
    }
    onPlayerLootReceived(playerLootReceived) {
      if (this.config.screenshotKills()) this.takeScreenshot('Kill ' + playerLootReceived.getPlayer().getName(), SD_PVP_KILLS);
    }
    onChatMessage(event) {
      const type = event.getType();
      if (type !== 'GAMEMESSAGE' && type !== 'SPAM' && type !== 'TRADE' && type !== 'FRIENDSCHATNOTIFICATION') return;
      const chatMessage = rl.toRuneLiteTags ? rl.toRuneLiteTags(event.getMessage()) : event.getMessage();
      const plain = Text.removeTags(chatMessage);
      if (chatMessage.includes('You have completed') && chatMessage.includes('Treasure')) {
        const m = NUMBER_PATTERN.exec(plain);
        if (m) {
          this.clueNumber = parseInt(m[0].replace(/,/g, ''), 10);
          this.clueType = chatMessage.substring(chatMessage.lastIndexOf(m[0]) + m[0].length + 1, chatMessage.indexOf('Treasure') - 1);
          return;
        }
      }
      if (plain.startsWith('Your Barrows chest count is')) {
        const m = NUMBER_PATTERN.exec(plain);
        if (m) { this.killType = KillType.BARROWS; this.killCountNumber = parseInt(m[0].replace(/,/g, ''), 10); return; }
      }
      if (this.config.screenshotBossKills()) {
        const m = BOSSKILL_MESSAGE_PATTERN.exec(chatMessage);
        if (m) { this.takeScreenshot(m[1] + '(' + m[2].replace(/,/g, '') + ')', SD_BOSS_KILLS); }
      }
      if (this.config.screenshotDuels()) {
        const m = DUEL_END_PATTERN.exec(chatMessage);
        if (m) this.takeScreenshot('Duel ' + m[1] + ' (' + m[2].replace(/,/g, '') + ')', SD_DUELS);
      }
    }
    onWidgetLoaded(event) {
      let fileName; let screenshotSubDir;
      const groupId = event.getGroupId();
      if (InterfaceID.QUESTSCROLL.includes(groupId) || groupId === InterfaceID.TRAIL_REWARDSCREEN) {
        if (!this.config.screenshotRewards()) return;
      } else if (groupId === InterfaceID.MISC_COLLECTION) {
        if (!this.config.screenshotKingdom()) return;
      }
      if (groupId === InterfaceID.MISC_COLLECTION) {
        fileName = 'Kingdom ' + LOCAL_DATE(new Date());
        screenshotSubDir = SD_KINGDOM_REWARDS;
      } else if (groupId === InterfaceID.BARROWS_REWARD && this.killType === KillType.BARROWS) {
        fileName = 'Barrows(' + this.killCountNumber + ')';
        screenshotSubDir = SD_BOSS_KILLS;
        this.killType = null; this.killCountNumber = 0;
      } else if (groupId === InterfaceID.TRAIL_REWARDSCREEN && !ll.c2007 && ll.api && ll.api.ifOpen && ll.api.ifOpen(6960)) {
        // 2006RS-2: our clue reward (trail_reward) comes with no "You have completed N <tier> Treasure Trails." line
        // (trail_clue_helper.rs2), so it's named by the last clue item's tier (loottracker/cluetiers2006.js: every plugin's page scripts are loaded), with no count
        if (!this.lastClueTier) return;
        fileName = this.lastClueTier.charAt(0).toUpperCase() + this.lastClueTier.substring(1);
        screenshotSubDir = SD_CLUE_SCROLL_REWARDS;
      } else if (groupId === InterfaceID.TRAIL_REWARDSCREEN) {
        if (this.clueType == null || this.clueNumber == null) return;
        fileName = this.clueType.charAt(0).toUpperCase() + this.clueType.substring(1) + '(' + this.clueNumber + ')';
        screenshotSubDir = SD_CLUE_SCROLL_REWARDS;
        this.clueType = null; this.clueNumber = null;
      } else {
        // level up widget gets loaded prior to the text being set, so wait until the next tick
        // (2007: any chat dialogue or quest scroll; its texts are read then)
        this.loadedGroup = groupId;
        this.shouldTakeScreenshot = true;
        return;
      }
      this.takeScreenshot(fileName, screenshotSubDir);
    }
    manualScreenshot() { this.takeScreenshot('', null); }
    parseLevelUpWidget(text) {
      const m = LEVEL_UP_PATTERN.exec(Text.removeTags(text).replace(/\s+/g, ' '));
      if (!m) return null;
      return m[1] + '(' + m[2] + ')';
    }
    static parseQuestCompletedWidget(text) {
      // "You have completed The Corsair Curse!" / "'One Small Favour' completed!"
      const m1 = QUEST_PATTERN_1.exec(text);
      const m = m1 || QUEST_PATTERN_2.exec(text);
      if (!m) return 'Quest(quest not found)';
      let quest = m.groups.quest;
      const verb = m.groups.verb != null ? m.groups.verb : '';
      if (verb.includes('kind of')) quest += ' partial completion';
      else if (verb.includes('completely')) quest += ' II';
      if (RFD_TAGS.some((t) => (quest + verb).includes(t))) quest = 'Recipe for Disaster - ' + quest;
      if (WORD_QUEST_IN_NAME_TAGS.some((t) => quest.includes(t))) quest += ' Quest';
      return 'Quest(' + quest + ')';
    }
    static parseBAHighGambleWidget(text) {
      const m = BA_HIGH_GAMBLE_REWARD_PATTERN.exec(text);
      return m ? `High Gamble(${m.groups.gambleCount})` : 'High Gamble(count not found)';
    }
    takeScreenshot(fileName, subDir) {
      if (client.getGameState() === GameState.LOGIN_SCREEN) return; // Prevent the screenshot from being captured
      const imageCallback = (png) => {
        this.saveScreenshot(fileName, subDir, png);
        if (this.reportButtonText != null) {
          const w = client.getWidget(InterfaceID.REPORTABUSE_TEXT1);
          if (w) w.setText(this.reportButtonText);
          this.reportButtonText = null;
        }
      };
      if (this.config.displayDate()) { this.queueForTimestamp(imageCallback); this.onFrame(); } else requestNextFrameListener(imageCallback);
    }
    queueForTimestamp(screenshotConsumer) { this.consumers.push(screenshotConsumer); }
    // onPostClientTick (every 20 ms client tick in RuneLite): while screenshots wait, the report button shows the date
    // (re-set every few ms here, since the Report Button plugin rewrites it every 200 ms), and they're taken from the
    // next frames
    onFrame() {
      if (!this.consumers.length) return;
      const setDate = () => {
        const reportButtonTextWidget = client.getWidget(InterfaceID.REPORTABUSE_TEXT1);
        if (reportButtonTextWidget == null) return;
        if (this.reportButtonText == null) this.reportButtonText = reportButtonTextWidget.getText();
        reportButtonTextWidget.setText(DATE_FORMAT(new Date()));
      };
      setDate();
      if (!this.dateTimer) this.dateTimer = setInterval(() => { if (this.consumers.length) setDate(); else { clearInterval(this.dateTimer); this.dateTimer = null; } }, 5);
      for (const c of this.consumers) {
        if (c.__queued) continue;
        c.__queued = true;
        requestNextFrameListener((png) => { this.consumers.splice(this.consumers.indexOf(c), 1); c(png); });
      }
    }
    saveScreenshot(fileName, subDir, png) {
      const me = client.getLocalPlayer();
      const name = (fileName || '') + (fileName ? ' ' : '') + TIME_FORMAT(new Date());
      ll.post('rl-screenshot', { png, player: me && me.getName() ? me.getName() : null, subDir: subDir || '', fileName: name, notify: this.config.notifyWhenTaken(), clipboard: this.config.copyToClipboard() });
    }
  }

  const plugin = new ScreenshotPlugin();
  ll.__screenshot = { plugin, ScreenshotPlugin, captureFrame };
  rl.registerPlugin('screenshot', plugin);
})();
