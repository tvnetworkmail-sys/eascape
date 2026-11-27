// RuneLite's Barbarian Assault plugin, cloned from net.runelite.client.plugins.barbarianassault (BSD 2-Clause,
// Copyright (c) 2018, Cameron <https://github.com/noremac201> and RuneLite contributors): BarbarianAssaultPlugin,
// GameTimer, Round, Role, TimerOverlay, HealerOverlay.
// Our server doesn't have Barbarian Assault yet (released 4 Jan 2007), and the 2007 cache has none of its interfaces or
// its BARBASSAULT_AREAEXIT_PENDING varbit. Their ids are the IF / VARBIT table below, null until the content is built:
// fill them in from content/pack/interface.pack / varbit.pack then. Until then the plugin does nothing.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Overlay, OverlayPosition, OverlayLayer, ChatMessageBuilder, ChatColorType, QueuedMessage } = rl;

  const GAME_TICK = 600;
  // InterfaceID.* (groups) and the components the plugin reads, for the 2007 client: null = not in the cache yet
  const IF = {
    BARBASSAULT_WAVECOMPLETE: null, BARBASSAULT_COMPL_QUEENREWARDS: null,
    BARBASSAULT_OVER_ATT: null, BARBASSAULT_OVER_DEF: null, BARBASSAULT_OVER_HEAL: null, BARBASSAULT_OVER_COL: null,
    BARBASSAULT_ATTACKER_HORN_TEXT: null, BARBASSAULT_ATTACKER_HORN: null,
    BARBASSAULT_DEFENDER_HORN_TEXT: null, BARBASSAULT_DEFENDER_HORN: null,
    BARBASSAULT_COLLECTOR_HORN_TEXT: null, BARBASSAULT_COLLECTOR_HORN: null,
    BARBASSAULT_HEALER_HORN_TEXT: null, BARBASSAULT_HEALER_HORN: null,
    BARBASSAULT_HEALER_PLAYER1_HP: null, BARBASSAULT_HEALER_PLAYER2_HP: null, BARBASSAULT_HEALER_PLAYER3_HP: null, BARBASSAULT_HEALER_PLAYER4_HP: null,
  };
  const VARBIT = { BARBASSAULT_AREAEXIT_PENDING: null };
  const widget = (id) => (id == null ? null : client.getWidget(id));

  class Role {
    constructor(name, roleText, roleSprite) { this.name = name; this.roleText = roleText; this.roleSprite = roleSprite; }
    getRoleText() { return IF[this.roleText]; }
    getRoleSprite() { return IF[this.roleSprite]; }
    toString() { return this.name; }
  }
  Role.ATTACKER = new Role('ATTACKER', 'BARBASSAULT_ATTACKER_HORN_TEXT', 'BARBASSAULT_ATTACKER_HORN');
  Role.DEFENDER = new Role('DEFENDER', 'BARBASSAULT_DEFENDER_HORN_TEXT', 'BARBASSAULT_DEFENDER_HORN');
  Role.COLLECTOR = new Role('COLLECTOR', 'BARBASSAULT_COLLECTOR_HORN_TEXT', 'BARBASSAULT_COLLECTOR_HORN');
  Role.HEALER = new Role('HEALER', 'BARBASSAULT_HEALER_HORN_TEXT', 'BARBASSAULT_HEALER_HORN');

  class Round {
    constructor(role) {
      this.roundRole = role;
      this.roundStartTime = Date.now() + 2 * GAME_TICK;
      this.runnersKilled = false; this.rangersKilled = false; this.healersKilled = false; this.fightersKilled = false;
    }
    getRoundRole() { return this.roundRole; }
    getTimeToChange() {
      // 30 + (int) Duration.between(now, roundStartTime).getSeconds() % 30 (Java truncates towards zero)
      return 30 + (Math.trunc((this.roundStartTime - Date.now()) / 1000) % 30);
    }
  }

  const pad = (n) => String(n).padStart(2, '0');
  class GameTimer {
    constructor() { this.startTime = Date.now(); this.prevWave = this.startTime; }
    getTime(waveTime) {
      const now = Date.now();
      const elapsed = waveTime ? now - this.prevWave : now - this.startTime - GAME_TICK;
      return GameTimer.formatTime(Math.max(0, Math.trunc(elapsed / 1000)) % 86400);
    }
    setWaveStartTime() { this.prevWave = Date.now(); }
    static formatTime(sec) {
      const h = Math.trunc(sec / 3600); const m = Math.trunc((sec % 3600) / 60); const s = sec % 60;
      if (h > 0) return pad(h) + ':' + pad(m); // HH:mm
      if (m > 9) return pad(m) + ':' + pad(s); // mm:ss
      return m + ':' + pad(s); // m:ss
    }
  }

  class TimerOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.plugin = plugin; this.config = config;
    }
    render(graphics) {
      const round = this.plugin.getCurrentRound();
      if (round == null) return null;
      const role = round.getRoundRole();
      const roleText = widget(role.getRoleText());
      const roleSprite = widget(role.getRoleSprite());
      if (this.config.showTimer() && roleText != null && roleSprite != null) {
        roleText.setText('00:' + pad(round.getTimeToChange()));
        const spriteBounds = roleSprite.getBounds();
        roleSprite.setHidden(true);
        if (this.plugin.getClockImage()) graphics.drawImage(this.plugin.getClockImage(), spriteBounds.x, spriteBounds.y, null);
      }
      return null;
    }
  }

  const HP_HIGH = new Color(10, 146, 5, 125);
  const HP_MID = new Color(146, 146, 0, 230);
  const HP_LOW = new Color(225, 35, 0, 125);
  // HealerTeam: teammate component, offsetX, offsetY, width
  const HEALER_TEAM = [
    ['BARBASSAULT_HEALER_PLAYER1_HP', 28, 2, 115], ['BARBASSAULT_HEALER_PLAYER2_HP', 26, 2, 115],
    ['BARBASSAULT_HEALER_PLAYER3_HP', 26, 2, 115], ['BARBASSAULT_HEALER_PLAYER4_HP', 25, 2, 115],
  ];
  class HealerOverlay extends Overlay {
    constructor(plugin, config) {
      super(plugin);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setLayer(OverlayLayer.UNDER_WIDGETS);
      this.plugin = plugin; this.config = config;
    }
    render(graphics) {
      const round = this.plugin.getCurrentRound();
      if (round == null) return null;
      const role = round.getRoundRole();
      if (this.config.showHealerBars() && role === Role.HEALER) {
        for (const [key, offsetX, offsetY, width] of HEALER_TEAM) {
          const w = widget(IF[key]);
          if (w == null) continue;
          const teammateHealth = w.getText().split(' / ');
          const curHealth = parseInt(teammateHealth[0], 10);
          const maxHealth = parseInt(teammateHealth[1], 10);
          const hpRatio = curHealth / maxHealth;
          const filledWidth = HealerOverlay.getBarWidth(hpRatio, width);
          const barColor = HealerOverlay.getBarColor(hpRatio);
          const x = w.getCanvasLocation().getX() - offsetX;
          const y = w.getCanvasLocation().getY() - offsetY;
          graphics.setColor(barColor);
          graphics.fillRect(x, y, filledWidth, 20);
        }
      }
      return null;
    }
    static getBarWidth(ratio, size) { return ratio >= 1 ? size : Math.round(ratio * size); }
    static getBarColor(ratio) { return ratio <= 0.33 ? HP_LOW : ratio <= 0.66 ? HP_MID : HP_HIGH; }
  }

  const BA_WAVE_NUM_INDEX = 2;
  const START_WAVE = '1';
  const ENDGAME_REWARD_NEEDLE_TEXT = '<br>5';

  class BarbarianAssaultPlugin {
    constructor() {
      this.configGroup = 'barbarianAssault';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.clockImage = null;
      this.currentWave = START_WAVE;
      this.gameTime = null;
      this.currentRound = null;
      this.timerOverlay = new TimerOverlay(this, this.config);
      this.healerOverlay = new HealerOverlay(this, this.config);
    }
    getClockImage() { return this.clockImage; }
    getCurrentRound() { return this.currentRound; }
    startUp() {
      rl.overlayManager.add(this.timerOverlay);
      rl.overlayManager.add(this.healerOverlay);
      this.clockImage = this.resources['clock.png'] || null;
    }
    shutDown() {
      rl.overlayManager.remove(this.timerOverlay);
      rl.overlayManager.remove(this.healerOverlay);
      this.gameTime = null;
      this.currentWave = START_WAVE;
      this.clockImage = null;
    }
    onWidgetLoaded(event) {
      const g = event.getGroupId();
      if (g == null) return;
      if (g === IF.BARBASSAULT_WAVECOMPLETE) {
        const rewardWidget = widget(IF.BARBASSAULT_COMPL_QUEENREWARDS);
        if (this.config.waveTimes() && rewardWidget != null && rewardWidget.getText().includes(ENDGAME_REWARD_NEEDLE_TEXT) && this.gameTime != null) {
          this.announceTime('Game finished, duration: ', this.gameTime.getTime(false));
          this.gameTime = null;
        }
      } else if (g === IF.BARBASSAULT_OVER_ATT) this.setRound(Role.ATTACKER);
      else if (g === IF.BARBASSAULT_OVER_DEF) this.setRound(Role.DEFENDER);
      else if (g === IF.BARBASSAULT_OVER_HEAL) this.setRound(Role.HEALER);
      else if (g === IF.BARBASSAULT_OVER_COL) this.setRound(Role.COLLECTOR);
    }
    onVarbitChanged(event) {
      if (VARBIT.BARBASSAULT_AREAEXIT_PENDING != null && event.getVarbitId() === VARBIT.BARBASSAULT_AREAEXIT_PENDING && event.getValue() === 0) {
        this.currentRound = null;
        // Use an instance check to determine if this is exiting a game or a tutorial
        // After exiting tutorials there is a small delay before changing IN_GAME_BA back to
        // 0 whereas when in a real wave it changes while still in the instance.
        if (this.config.waveTimes() && this.gameTime != null && client.isInInstancedRegion()) {
          this.announceTime('Wave ' + this.currentWave + ' duration: ', this.gameTime.getTime(true));
        }
      }
    }
    onChatMessage(event) {
      if (event.getType() === 'GAMEMESSAGE' && event.getMessage().startsWith('---- Wave:')) {
        const message = event.getMessage().split(' ');
        this.currentWave = message[BA_WAVE_NUM_INDEX];
        if (this.currentWave === START_WAVE) this.gameTime = new GameTimer();
        else if (this.gameTime != null) this.gameTime.setWaveStartTime();
      }
    }
    setRound(role) {
      // Prevent changing rounds when a round is already set, as widgets can be
      // loaded multiple times in game from eg. opening and closing the horn
      // of glory.
      if (this.currentRound == null) this.currentRound = new Round(role);
    }
    announceTime(preText, time) {
      const chatMessage = new ChatMessageBuilder().append(ChatColorType.NORMAL).append(preText).append(ChatColorType.HIGHLIGHT).append(time).build();
      rl.chatMessageManager.queue(QueuedMessage.builder().type('CONSOLE').runeLiteFormattedMessage(chatMessage).build());
    }
  }

  const plugin = new BarbarianAssaultPlugin();
  ll.__barbarianassault = { plugin, IF, VARBIT, Role, Round, GameTimer };
  rl.registerPlugin('barbarianassault', plugin);
})();
