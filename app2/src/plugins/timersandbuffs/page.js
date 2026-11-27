// RuneLite's Timers & Buffs plugin, cloned from net.runelite.client.plugins.timersandbuffs (BSD 2-Clause,
// Copyright (c) 2017, Seth <Sethtroll3@gmail.com> and RuneLite contributors): TimersAndBuffsPlugin, GameTimer,
// TimerTimer, ElapsedTimer.
// Trimmed for Sept 2007 to the timers of 2007 content. Where the 2007 server sends no varbit for a timer, the
// same timer starts from what it does send (adapted):
// - Antifire: "You drink some of your dragon potion." (600 ticks; the server's %dragonresist isn't sent).
// - Teleblock: "You have been teleblocked." (500 ticks), "Your teleblock has worn off." (TELEBLOCK_CYCLES isn't
//   sent).
// - Ice spells: the impact graphic alone (the 2007 server sends no "You have been frozen!").
// - Home teleport: the 30 minutes start when the home teleport lands (its last graphic, 758, then the jump), and
//   "You need to wait another N minutes to cast this spell." sets the minutes left (the server's
//   %home_teleport_minute isn't sent).
// - God wars altar: "You recharge your Prayer points." in the God Wars Dungeon (1000 ticks; no
//   GODWARS_ALTAR_DELAY varbit).
// - Fight Cave: "You are now on wave N." (2007's message); the cave has no pause message.
// - Cannon: "Your cannon has decayed!" (2007) removes it, as "Your cannon has been destroyed!" does.
// - Death (ActorDeath) is the local player's hitpoints reaching 0.
// As RuneLite: antipoison from varp 102 (no venom in 2007, so every negative value is antipoison), Charge from
// varp 272, Bind / Snare / Entangle from their graphics, the pickpocket stun from its message.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, InfoBox, Timer, Color } = rl;

  const GAME_TICK = 600;
  const SECONDS = 1000;
  const MINUTES = 60000;
  const ITEM = 'ITEM';
  const SPRITE = 'SPRITE';
  const CANNON_BASE_MESSAGE = 'You place the cannon base on the ground.';
  const CANNON_STAND_MESSAGE = 'You add the stand.';
  const CANNON_BARRELS_MESSAGE = 'You add the barrels.';
  const CANNON_FURNACE_MESSAGE = 'You add the furnace.';
  const CANNON_PICKUP_MESSAGE = "You pick up the cannon. It's really heavy.";
  const CANNON_REPAIR_MESSAGE = 'You repair your cannon, restoring it to working order.';
  const CANNON_DESTROYED_MESSAGE = 'Your cannon has been destroyed!';
  const CANNON_DECAYED_MESSAGE = 'Your cannon has decayed!'; // 2007
  const CANNON_BROKEN_MESSAGE = '<col=ef1020>Your cannon has broken!';
  const PICKPOCKET_FAILURE_MESSAGE = 'You fail to pick ';
  const ANTIFIRE_MESSAGE = 'You drink some of your dragon potion.'; // 2007's antifire message
  const TELEBLOCK_MESSAGE = 'You have been teleblocked.';
  const TELEBLOCK_WORN_OFF_MESSAGE = 'Your teleblock has worn off.';
  const HOME_TELEPORT_WAIT = /^You need to wait another (\d+|minute)(?: minutes)? to cast this spell\./;
  const GOD_WARS_ALTAR_MESSAGE = 'You recharge your Prayer points.';
  const TZHAAR_WAVE_MESSAGE = /(?:Wave: |on wave (?:@[a-z]{3}@|<col=[0-9a-f]+>)?)(\d+)/;
  const POISON_TICK_LENGTH = 30;
  const FIGHT_CAVES_REGION_ID = 9551;
  const HOME_TELEPORT_GRAPHIC = 758; // the last stage of the 2007 home teleport (spot07_804)
  const POISON = 102; // VarPlayerID.POISON
  const MAGEARENA_CHARGE = 272; // VarPlayerID.MAGEARENA_CHARGE

  // GameTimer (2007 timers): image id, image type, description, graphic, duration (ms), removedOnDeath
  const T = (name, imageId, imageType, description, durationMs, removedOnDeath = false, graphicId = null) => ({ name: () => name, imageId, imageType, description, duration: durationMs, removedOnDeath, graphicId });
  const GameTimer = {
    ANTIFIRE: T('ANTIFIRE', 2452, ITEM, 'Antifire', 600 * GAME_TICK), // (adapted: from its message)
    CANNON: T('CANNON', 10, ITEM, 'Cannon', 25 * MINUTES),
    CANNON_REPAIR: T('CANNON_REPAIR', 1, ITEM, 'Broken Cannon', 10 * MINUTES),
    BIND: T('BIND', 319, SPRITE, 'Bind', 8 * GAME_TICK, true, 181),
    SNARE: T('SNARE', 320, SPRITE, 'Snare', 16 * GAME_TICK, true, 180),
    ENTANGLE: T('ENTANGLE', 321, SPRITE, 'Entangle', 24 * GAME_TICK, true, 179),
    ICERUSH: T('ICERUSH', 325, SPRITE, 'Ice rush', 8 * GAME_TICK, true, 361),
    ICEBURST: T('ICEBURST', 326, SPRITE, 'Ice burst', 16 * GAME_TICK, true, 363),
    ICEBLITZ: T('ICEBLITZ', 327, SPRITE, 'Ice blitz', 24 * GAME_TICK, true, 367),
    ICEBARRAGE: T('ICEBARRAGE', 328, SPRITE, 'Ice barrage', 32 * GAME_TICK, true, 369),
    GOD_WARS_ALTAR: T('GOD_WARS_ALTAR', 201, SPRITE, 'God wars altar', 1000 * GAME_TICK), // (adapted)
    CHARGE: T('CHARGE', 322, SPRITE, 'Charge', null),
    HOME_TELEPORT: T('HOME_TELEPORT', 356, SPRITE, 'Home Teleport', 30 * MINUTES),
    ANTIPOISON: T('ANTIPOISON', 2446, ITEM, 'Antipoison', null),
    TELEBLOCK: T('TELEBLOCK', 352, SPRITE, 'Teleblock', 500 * GAME_TICK), // (adapted)
    PICKPOCKET_STUN: T('PICKPOCKET_STUN', 206, SPRITE, 'Stunned', null, true),
  };
  const ICE = [GameTimer.ICERUSH, GameTimer.ICEBURST, GameTimer.ICEBLITZ, GameTimer.ICEBARRAGE];

  class TimerTimer extends Timer {
    constructor(timer, durationMs, plugin) {
      super(durationMs, null, plugin);
      this.timer = timer;
      this.ticks = 0;
      this.setPriority('MED');
    }
    getTimer() { return this.timer; }
    getName() { return this.timer.name(); }
    // spriteManager.getSpriteAsync / itemManager's AsyncBufferedImage: the image once the client has drawn it
    getImage() {
      if (!this.image) this.image = (this.timer.imageType === SPRITE ? rl.spriteManager.getSprite(this.timer.imageId) : rl.itemManager.getImage(this.timer.imageId)) || null;
      return this.image;
    }
  }

  const pad = (n) => String(n).padStart(2, '0');
  class ElapsedTimer extends InfoBox {
    // Creates a timer that counts up if lastTime is null, or a paused timer if lastTime is defined
    constructor(image, plugin, startTime, lastTime) {
      super(image, plugin);
      this.startTime = startTime;
      this.lastTime = lastTime;
    }
    getImage() { if (!this.image) this.image = rl.itemManager.getImage(6570) || null; return this.image; }
    elapsed() { return (this.lastTime == null ? Date.now() : this.lastTime) - this.startTime; }
    getText() {
      if (this.startTime == null) return null;
      const s = Math.floor(this.elapsed() / 1000); // DurationFormatUtils "mm:ss": minutes not wrapped
      return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    }
    getTextColor() { return Color.WHITE; }
    getTooltip() {
      if (this.startTime == null) return null;
      const s = Math.floor(this.elapsed() / 1000);
      return 'Elapsed time: ' + `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }
  }

  class TimersAndBuffsPlugin {
    constructor() {
      this.configGroup = 'timers';
      this.config = rl.configProxy('timers', () => this.configItems);
      this.tzhaarTimer = null;
      this.freezeTimer = null;
      this.freezeTime = -1; // time frozen, in game ticks
      this.lastPoint = null;
      this.varTimers = new Map();
      this.nextPoisonTick = 0;
      this.homeTeleportTick = -1; // (adapted) the tick the home teleport's last graphic showed
    }
    startUp() {}
    shutDown() {
      rl.infoBoxManager.removeIf((t) => t instanceof TimerTimer);
      this.lastPoint = null;
      this.nextPoisonTick = 0;
      this.removeTzhaarTimer();
      this.varTimers.clear();
    }

    // config.tzhaarStartTime / tzhaarLastTime (Instant, kept as epoch millis)
    getInstant(key) { const v = rl.configManager.getConfiguration('timers', key); return v === undefined || v === null || v === '' ? null : Number(v); }
    setInstant(key, v) { rl.configManager.setConfiguration('timers', key, v == null ? '' : String(v)); }

    onVarbitChanged(event) {
      if (event.getVarpId() === POISON && this.config.showAntiPoison()) {
        const poisonVarp = event.getValue();
        const tickCount = client.getTickCount();
        if (poisonVarp === 0) this.nextPoisonTick = -1;
        else if (this.nextPoisonTick - tickCount <= 0) this.nextPoisonTick = tickCount + POISON_TICK_LENGTH;
        // (no venom in 2007: RuneLite's -38 venom cutoff and ANTIVENOM left out)
        this.updateVarTimer(GameTimer.ANTIPOISON, poisonVarp, (i) => i >= 0,
          (i) => this.nextPoisonTick - tickCount + Math.abs((i + 1) * POISON_TICK_LENGTH));
      }
      if (event.getVarpId() === MAGEARENA_CHARGE && this.config.showCharge()) {
        this.updateVarTimer(GameTimer.CHARGE, event.getValue(), (i) => i === 0, (i) => i * 2);
      }
    }

    onConfigChanged(event) {
      if (event.getGroup() !== 'timers') return;
      const c = this.config;
      if (!c.showHomeMinigameTeleports()) this.removeGameTimer(GameTimer.HOME_TELEPORT);
      if (!c.showAntiFire()) this.removeVarTimer(GameTimer.ANTIFIRE);
      if (!c.showCannon()) { this.removeGameTimer(GameTimer.CANNON); this.removeGameTimer(GameTimer.CANNON_REPAIR); }
      if (!c.showCharge()) this.removeGameTimer(GameTimer.CHARGE);
      if (!c.showTeleblock()) this.removeGameTimer(GameTimer.TELEBLOCK);
      if (!c.showFreezes()) for (const t of [GameTimer.BIND, GameTimer.SNARE, GameTimer.ENTANGLE, ...ICE]) this.removeGameTimer(t);
      if (!c.showAntiPoison()) this.removeGameTimer(GameTimer.ANTIPOISON);
      if (!c.showTzhaarTimers()) this.removeTzhaarTimer();
      else this.createTzhaarTimer();
      if (!c.showGodWarsAltar()) this.removeVarTimer(GameTimer.GOD_WARS_ALTAR);
      if (!c.showPickpocketStun()) this.removeGameTimer(GameTimer.PICKPOCKET_STUN);
    }

    onChatMessage(event) {
      const message = event.getMessage();
      if (event.getType() !== 'SPAM' && event.getType() !== 'GAMEMESSAGE') return;
      const c = this.config;
      if (message.includes(PICKPOCKET_FAILURE_MESSAGE) && c.showPickpocketStun() && message.includes('pocket')) {
        if (message.includes('hero') || message.includes('elf')) this.createGameTimer(GameTimer.PICKPOCKET_STUN, 6 * SECONDS);
        else this.createGameTimer(GameTimer.PICKPOCKET_STUN, 5 * SECONDS);
      }
      if (message === CANNON_BASE_MESSAGE || message === CANNON_STAND_MESSAGE || message === CANNON_BARRELS_MESSAGE
        || message === CANNON_FURNACE_MESSAGE || message.includes(CANNON_REPAIR_MESSAGE)) {
        this.removeGameTimer(GameTimer.CANNON_REPAIR);
        if (c.showCannon()) {
          const cannonTimer = this.createGameTimer(GameTimer.CANNON);
          cannonTimer.setTooltip(cannonTimer.getTooltip() + ' - World ' + client.getWorld());
        }
      } else if (message === CANNON_BROKEN_MESSAGE) {
        this.removeGameTimer(GameTimer.CANNON);
        if (c.showCannon()) {
          const cannonTimer = this.createGameTimer(GameTimer.CANNON_REPAIR);
          cannonTimer.setTooltip(cannonTimer.getTooltip() + ' - World ' + client.getWorld());
        }
      } else if (message === CANNON_PICKUP_MESSAGE || message.startsWith('You pick up the cannon') || message === CANNON_DESTROYED_MESSAGE || message === CANNON_DECAYED_MESSAGE) {
        this.removeGameTimer(GameTimer.CANNON);
        this.removeGameTimer(GameTimer.CANNON_REPAIR);
      }
      // (adapted) antifire, teleblock, home teleport and god wars altar from their 2007 messages
      if (message === ANTIFIRE_MESSAGE && c.showAntiFire()) this.createGameTimer(GameTimer.ANTIFIRE);
      if (message === TELEBLOCK_MESSAGE && c.showTeleblock()) this.createGameTimer(GameTimer.TELEBLOCK);
      if (message === TELEBLOCK_WORN_OFF_MESSAGE) this.removeGameTimer(GameTimer.TELEBLOCK);
      const wait = HOME_TELEPORT_WAIT.exec(message);
      if (wait && c.showHomeMinigameTeleports()) this.createGameTimer(GameTimer.HOME_TELEPORT, (wait[1] === 'minute' ? 1 : Number(wait[1])) * MINUTES);
      if (message === GOD_WARS_ALTAR_MESSAGE && c.showGodWarsAltar() && this.isInGodWars()) this.createGameTimer(GameTimer.GOD_WARS_ALTAR);

      const matcher = TZHAAR_WAVE_MESSAGE.exec(message);
      if (matcher) {
        const wave = parseInt(matcher[1], 10);
        if (wave === 1) {
          this.setInstant('tzhaarStartTime', Date.now());
          this.setInstant('tzhaarLastTime', null);
          if (c.showTzhaarTimers()) this.createTzhaarTimer();
        } else if (this.getInstant('tzhaarStartTime') != null && this.getInstant('tzhaarLastTime') != null) {
          // Advance start time by how long it has been paused
          this.setInstant('tzhaarStartTime', this.getInstant('tzhaarStartTime') + (Date.now() - this.getInstant('tzhaarLastTime')));
          this.setInstant('tzhaarLastTime', null);
          if (c.showTzhaarTimers()) this.createTzhaarTimer();
        }
      }
    }

    isInGodWars() {
      const me = client.getLocalPlayer();
      if (!me) return false;
      const p = me.getWorldLocation();
      return p.getX() >= 2816 && p.getX() < 2944 && p.getY() >= 5248 && p.getY() < 5376;
    }
    isInFightCaves() { const r = client.getMapRegions(); return r != null && r.includes(FIGHT_CAVES_REGION_ID); }

    createTzhaarTimer() {
      this.removeTzhaarTimer();
      const imageItem = this.isInFightCaves() ? 6570 : -1; // ItemID.TZHAAR_CAPE_FIRE (no Inferno in 2007)
      if (imageItem === -1) return;
      this.tzhaarTimer = new ElapsedTimer(rl.itemManager.getImage(imageItem), this, this.getInstant('tzhaarStartTime'), this.getInstant('tzhaarLastTime'));
      rl.infoBoxManager.addInfoBox(this.tzhaarTimer);
    }
    removeTzhaarTimer() {
      if (this.tzhaarTimer != null) {
        rl.infoBoxManager.removeInfoBox(this.tzhaarTimer);
        this.tzhaarTimer = null;
      }
    }

    onGameTick() {
      const player = client.getLocalPlayer();
      if (player == null) return;
      const currentWorldPoint = player.getWorldLocation();
      if (this.freezeTimer != null) {
        // assume movement means unfrozen
        if (this.freezeTime !== client.getTickCount() && !currentWorldPoint.equals(this.lastPoint)) {
          this.removeGameTimer(this.freezeTimer.getTimer());
          this.freezeTimer = null;
        }
      }
      // (adapted) the home teleport landed: a jump within 8 ticks of its last graphic
      if (this.homeTeleportTick >= 0 && this.lastPoint) {
        if (client.getTickCount() - this.homeTeleportTick > 8) this.homeTeleportTick = -1;
        else if (currentWorldPoint.distanceTo(this.lastPoint) > 10) {
          this.homeTeleportTick = -1;
          if (this.config.showHomeMinigameTeleports()) this.createGameTimer(GameTimer.HOME_TELEPORT);
        }
      }
      this.lastPoint = currentWorldPoint;
    }

    onGameStateChanged(gameStateChanged) {
      switch (gameStateChanged.getGameState()) {
        case 'LOADING':
          if (this.tzhaarTimer != null && !this.isInFightCaves()) {
            this.removeTzhaarTimer();
            this.setInstant('tzhaarStartTime', null);
            this.setInstant('tzhaarLastTime', null);
          }
          break;
        case 'LOGIN_SCREEN':
          // pause tzhaar timer if logged out without pausing
          if (this.getInstant('tzhaarStartTime') != null && this.getInstant('tzhaarLastTime') == null) this.setInstant('tzhaarLastTime', Date.now());
          this.removeTzhaarTimer(); // will be readded by the wave message
          this.removeGameTimer(GameTimer.TELEBLOCK);
          break;
        default:
      }
    }

    onGraphicChanged(event) {
      const actor = event.getActor();
      if (!actor.equals(client.getLocalPlayer())) return;
      const g = actor.getGraphic();
      const c = this.config;
      for (const t of [GameTimer.BIND, GameTimer.SNARE, GameTimer.ENTANGLE]) {
        if (g === t.graphicId && c.showFreezes()) {
          this.freezeTimer = this.createGameTimer(t);
          this.freezeTime = client.getTickCount();
        }
      }
      // (adapted) the ice spells from their graphic alone: no "You have been frozen!" in 2007
      for (const t of ICE) {
        if (g === t.graphicId && c.showFreezes()) {
          for (const o of ICE) this.removeGameTimer(o);
          this.freezeTimer = this.createGameTimer(t);
          this.freezeTime = client.getTickCount();
        }
      }
      if (g === HOME_TELEPORT_GRAPHIC) this.homeTeleportTick = client.getTickCount();
    }

    onActorDeath(actorDeath) {
      if (actorDeath.getActor().equals(client.getLocalPlayer())) {
        rl.infoBoxManager.removeIf((t) => t instanceof TimerTimer && t.getTimer().removedOnDeath);
        this.removeGameTimer(GameTimer.TELEBLOCK); // (adapted: the server clears a teleblock on death)
      }
    }

    createGameTimer(timer, durationMs = timer.duration) {
      if (durationMs == null) throw new Error('Timer with no duration');
      this.removeGameTimer(timer);
      const t = new TimerTimer(timer, durationMs, this);
      if (timer.imageType === ITEM) t.setImage(rl.itemManager.getImage(timer.imageId));
      t.setTooltip(timer.description);
      rl.infoBoxManager.addInfoBox(t);
      return t;
    }
    removeGameTimer(timer) {
      rl.infoBoxManager.removeIf((t) => t instanceof TimerTimer && t.getTimer() === timer);
    }
    updateVarTimer(gameTimer, varValue, removeTimerCheck, tickDuration) {
      let timer = this.varTimers.get(gameTimer);
      const ticks = tickDuration(varValue);
      const duration = ticks * GAME_TICK;
      if (removeTimerCheck(varValue)) {
        this.removeVarTimer(gameTimer);
      } else if (timer == null || ticks > timer.ticks) {
        // Reset the timer when its duration increases in order to allow it to turn red at the correct time even when refreshed early
        timer = this.createGameTimer(gameTimer, duration);
        timer.ticks = ticks;
        this.varTimers.set(gameTimer, timer);
      } else {
        timer.ticks = ticks;
        timer.updateDuration(duration);
      }
    }
    removeVarTimer(gameTimer) {
      this.removeGameTimer(gameTimer);
      this.varTimers.delete(gameTimer);
    }
  }

  rl.registerPlugin('timersandbuffs', new TimersAndBuffsPlugin());
})();
