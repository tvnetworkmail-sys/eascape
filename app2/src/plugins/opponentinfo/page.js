// RuneLite's Opponent Information, cloned from net.runelite.client.plugins.opponentinfo (BSD 2-Clause,
// Copyright (c) 2016-2018, Adam <Adam@sigterm.info>, Jordan Atwood and RuneLite contributors):
// OpponentInfoPlugin, OpponentInfoOverlay. The 2007 protocol sends an actor's real hitpoints with each
// hit (health / totalHealth), so the bar's maximum is that total instead of NPCManager's table.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Color, Rectangle, Point, Dimension, OverlayPanel, OverlayPosition, OverlayPriority, TitleComponent, ProgressBarComponent, ComponentConstants, Text, NPC } = rl;
  const WAIT = 5000;
  const HP_GREEN = new Color(0, 146, 54, 230);
  const HP_RED = new Color(102, 15, 16, 230);

  class OpponentInfoOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin; this.config = plugin.config;
      this.lastMaxHealth = null; this.lastRatio = 0; this.lastHealthScale = 0; this.opponentName = null;
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.setPriority(OverlayPriority.HIGH);
      this.panelComponent.setBorder(new Rectangle(2, 2, 2, 2));
      this.panelComponent.setGap(new Point(0, 2));
    }
    render(graphics) {
      const opponent = this.plugin.lastOpponent ? this.plugin.fresh(this.plugin.lastOpponent) : null;
      if (!opponent) { this.opponentName = null; return null; }
      if (opponent.getName() && opponent.getHealthScale() > 0) {
        this.lastRatio = opponent.getHealthRatio();
        this.lastHealthScale = opponent.getHealthScale();
        this.opponentName = Text.removeTags(opponent.getName());
        this.lastMaxHealth = opponent instanceof NPC ? opponent.getHealthScale() : null;
      }
      if (!this.opponentName || !this.config.showOpponentHealthOverlay()) return null;
      const fm = graphics.getFontMetrics();
      const panelWidth = Math.max(ComponentConstants.STANDARD_WIDTH, fm.stringWidth(this.opponentName) + ComponentConstants.STANDARD_BORDER * 2);
      this.panelComponent.setPreferredSize(new Dimension(panelWidth, 0));
      this.panelComponent.getChildren().push(TitleComponent.builder().text(this.opponentName).build());
      if (this.lastRatio >= 0 && this.lastHealthScale > 0) {
        const bar = new ProgressBarComponent();
        bar.setBackgroundColor(HP_RED);
        bar.setForegroundColor(HP_GREEN);
        const style = this.config.hitpointsDisplayStyle();
        if ((style === 'HITPOINTS' || style === 'BOTH') && this.lastMaxHealth !== null) {
          const max = this.lastMaxHealth; const ratio = this.lastRatio; const scale = this.lastHealthScale;
          let health = 0;
          if (ratio > 0) {
            let minHealth = 1; let maxHealth;
            if (scale > 1) {
              if (ratio > 1) minHealth = Math.trunc((max * (ratio - 1) + scale - 2) / (scale - 1));
              maxHealth = Math.trunc((max * ratio - 1) / (scale - 1));
              if (maxHealth > max) maxHealth = max;
            } else maxHealth = max;
            health = Math.trunc((minHealth + maxHealth + 1) / 2);
          }
          bar.setLabelDisplayMode(style === 'BOTH' ? 'BOTH' : 'FULL');
          bar.setMaximum(max);
          bar.setValue(health);
        } else {
          bar.setValue((this.lastRatio / this.lastHealthScale) * 100);
        }
        this.panelComponent.getChildren().push(bar);
      }
      return super.render(graphics);
    }
  }

  class OpponentInfoPlugin {
    constructor() {
      this.configGroup = 'opponentinfo';
      this.config = rl.configProxy('opponentinfo', () => this.configItems);
      this.overlay = new OpponentInfoOverlay(this);
      this.lastOpponent = null; this.lastTime = null;
    }
    startUp() { rl.overlayManager.add(this.overlay); }
    shutDown() { this.lastOpponent = null; this.lastTime = null; rl.overlayManager.remove(this.overlay); }
    /** the same actor as seen this frame (our Actor objects are snapshots) */
    fresh(a) {
      const list = a instanceof NPC ? client.getNpcs() : client.getPlayers();
      return list.find((x) => x.info.typecode === a.info.typecode) || null;
    }
    onInteractingChanged(e) {
      const me = client.getLocalPlayer();
      if (!me || !e.getSource().equals(me)) return;
      const opponent = e.getTarget();
      if (!opponent) { this.lastTime = Date.now(); return; }
      this.lastOpponent = opponent;
    }
    onGameTick() {
      const me = client.getLocalPlayer();
      if (this.lastOpponent && this.lastTime && me && !me.getInteracting() && Date.now() - this.lastTime > WAIT) this.lastOpponent = null;
    }
    // MenuEntryAdded: "*" before the names of NPCs you're fighting, on their Attack option
    onBeforeRender() {
      if (!this.config.showOpponentsInMenu() || client.isMenuOpen()) return;
      const c = ll.client;
      if (!c || !ll.fields.menuCount) return;
      const me = client.getLocalPlayer();
      const arrays = ll.menuArrays(c);
      const n = c[ll.fields.menuCount] | 0;
      const npcs = client.getNpcs();
      for (let i = 0; i < n; i++) {
        const raw = String(arrays[0][i] || '');
        if (!raw.startsWith('Attack ') || raw.includes('*')) continue;
        const npc = npcs.find((x) => x.info.index === arrays[2][i]);
        if (!npc) continue;
        const it = npc.info.interacting;
        if ((it && it.type === 'player' && me && it.index === 2047) || (this.lastOpponent && this.lastOpponent.info.typecode === npc.info.typecode)) {
          arrays[0][i] = raw.replace(/^Attack (@[a-z0-9~]{3}@)?/, (m, tag) => `Attack ${tag || ''}*`);
        }
      }
    }
  }
  rl.registerPlugin('opponentinfo', new OpponentInfoPlugin());
})();
