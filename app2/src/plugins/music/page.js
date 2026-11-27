// RuneLite's Music plugin, cloned from net.runelite.client.plugins.music (BSD 2-Clause, Copyright (c) 2019, Anthony
// Chen <https://github.com/achencoms> and RuneLite contributors): MusicPlugin.
// 2007: the music tab is if1 interface 239: the tracks are text lines in scroll layer 239:0 (15 px apart, red = locked,
// green = unlocked, under the "Click the tune to play." / "Green=Unlocked" lines), with no musicTrackFilter callback or
// music dbtable, so the filter is applied with the core's display-only writes (lines that don't pass are hidden and the
// rest close up, as Quest List does; everything goes back when the filter is off). The 2007 client has no "hide tracks"
// setting (SETTINGS_MUSIC_PLAYER_HIDE_TRACKS), so the default state is All. The search and filter buttons (OSRS:
// createChild GRAPHICs in the now-playing header) are drawn by an overlay at the header's bottom right with their ops
// through the core's widgetButtons; the filter button's orb filler sprites (not in the 2007 cache) are drawn as filled
// circles in their colours. Sounds: the core's AreaSoundEffectPlayed / SoundEffectPlayed (the 2007 client's seq and
// area sounds and the server's sound effects; consumed ones aren't played). The prayer sound ids are RuneLite's (our
// server sends OSRS's sound ids; checked: Thick Skin 2690, cancel 2663), minus the later prayers. Ambient sounds: the
// 2007 client's loc ambient sounds (BgSound) stop while muted (client hook ambientMute; OSRS reloads the scene).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, Rectangle, Color, VarClientID } = rl;

  const MUSIC = 239;
  const INNER = (MUSIC << 16) | 0; // the track list's scroll layer
  const NOW_PLAYING = (MUSIC << 16) | 177; // "Playing:"
  const LOCKED_COLOUR = 0xff0000; const UNLOCKED_COLOUR = 0x00ff00;
  const FIRST_TRACK_Y = 38; // under the two header lines
  const SoundEffectID = { TELEPORT_ALL: 200, INTERFACE_SELECT1: 2266 };
  const SOURCELESS_PLAYER_SOUNDS = new Set([SoundEffectID.TELEPORT_ALL]);
  // THICK_SKIN, STRENGTH_BURST, CLARITY, SHARP_EYE, MYSTIC_WILL, ROCK_SKIN, SUPERHUMAN_STRENGTH, IMPROVED_REFLEXES,
  // RAPID_RESTORE, RAPID_HEAL, PROTECT_ITEMS, HAWK_EYE, MYSTIC_LORE, STEEL_SKIN, ULTIMATE_STRENGTH, INCREDIBLE_REFLEXES,
  // PROTECT_FROM_MAGIC, PROTECT_FROM_MISSILES, PROTECT_FROM_MELEE, EAGLE_EYE, MYSTIC_MIGHT, RETRIBUTION, REDEMPTION,
  // SMITE, CANCEL_PRAYER (our server sends OSRS's sound ids; the later Deadeye / Vigour / Chivalry / Piety / Zeal dropped)
  const PRAYER_SOUNDS = new Set([2690, 2688, 2664, 2685, 2670, 2684, 2689, 2662, 2679, 2678, 1982, 2666, 2668, 2687, 2691, 2667, 2675, 2677, 2676, 2665, 2669, 2682, 2680, 2686, 2663]);

  const MusicState = [
    { name: 'All', color: new Color(56, 174, 220) }, // SpriteID.OrbFiller.PRAYER
    { name: 'Unlocked', color: new Color(0, 160, 0) }, // OrbFiller.HITPOINTS_POISON
    { name: 'Locked', color: new Color(200, 0, 0) }, // OrbFiller.HITPOINTS
  ];
  const ALL = 0; const UNLOCKED = 1; const LOCKED = 2;

  class MusicButtonsOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render(g) {
      const p = this.plugin;
      const sb = p.buttonBounds(5, 18, 17);
      if (!sb) return null;
      const img = rl.spriteManager.getAsset ? rl.spriteManager.getAsset('bank/search.png') : null;
      if (img) g.drawImage(img, sb.x, sb.y, sb.width, sb.height);
      if (p.isChatboxOpen()) { g.setColor(new Color(120, 0, 0, 110)); g.fillRect(sb.x, sb.y, sb.width, sb.height); }
      const fb = p.buttonBounds(25, 15, 15);
      const state = MusicState[p.filterState()];
      g.setColor(new Color(0, 0, 0)); g.fillOval(fb.x, fb.y, fb.width, fb.height);
      g.setColor(state.color); g.fillOval(fb.x + 1, fb.y + 1, fb.width - 2, fb.height - 2);
      return null;
    }
  }

  class MusicPlugin {
    constructor() {
      this.configGroup = 'music';
      this.musicConfig = rl.configProxy('music', () => this.configItems);
      this.searchInput = null;
      this.musicSearchButton = null;
      this.musicFilterButton = null;
      this.search = '';
      this.currentMusicFilter = null;
      this.saved = null;
    }
    startUp() {
      this.overlay = new MusicButtonsOverlay(this);
      rl.overlayManager.add(this.overlay);
      this.addMusicButtons();
      if (client.getGameState() === 'LOGGED_IN' && this.musicConfig.muteAmbientSounds()) client.setAmbientSound(null);
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      if (this.musicSearchButton) rl.widgetButtons.remove(this.musicSearchButton);
      if (this.musicFilterButton) rl.widgetButtons.remove(this.musicFilterButton);
      this.musicSearchButton = this.musicFilterButton = null;
      if (this.isChatboxOpen()) rl.chatboxPanelManager.close();
      this.currentMusicFilter = null;
      this.search = '';
      this.restoreList();
      if (this.musicConfig.muteAmbientSounds()) client.restoreAmbientSound();
    }
    onGameStateChanged(e) {
      const gameState = e.getGameState();
      if (gameState === 'LOGIN_SCREEN') {
        // Reset music filter on logout
        this.currentMusicFilter = null;
        this.saved = null;
      } else if (gameState === 'LOGGED_IN' && this.musicConfig.muteAmbientSounds()) {
        client.setAmbientSound(null);
      }
    }
    onWidgetLoaded(e) {
      if (e.getGroupId() === MUSIC) {
        // Reset filter state as the widget has been reloaded.
        this.currentMusicFilter = null;
        this.saved = null;
      }
    }
    /** the header's bottom right (OSRS: setPos(x, 6, ABSOLUTE_RIGHT, ABSOLUTE_BOTTOM) in Music.NOW_PLAYING) */
    buttonBounds(right, w, h) {
      const header = client.getWidget(NOW_PLAYING); const list = client.getWidget(INNER);
      if (header == null || list == null || header.isHidden()) return null;
      const lb = list.getBounds(); const hp = header.getCanvasLocation();
      const left = hp.getX() - header.getOriginalX();
      return new Rectangle(left + 190 - right - w, lb.y - 6 - h, w, h);
    }
    addMusicButtons() {
      const self = this;
      this.musicSearchButton = rl.widgetButtons.add({
        action: 'Open', listener: () => self.openSearch(),
        visible: () => self.buttonBounds(5, 18, 17) != null, bounds: () => self.buttonBounds(5, 18, 17),
        option() { return this.action; }, target: () => 'Search', onClick() { this.listener(); },
      });
      this.musicFilterButton = rl.widgetButtons.add({
        visible: () => self.buttonBounds(25, 15, 15) != null, bounds: () => self.buttonBounds(25, 15, 15),
        option: () => 'Toggle', target: () => MusicState[self.filterState()].name, onClick: () => self.toggleStatus(),
      });
    }
    filterState() { return this.currentMusicFilter == null ? ALL : this.currentMusicFilter; }
    onClientTick() {
      // (OSRS: onVarClientIntChanged) the search closes when the music tab isn't open
      if (this.isChatboxOpen() && !this.isOnMusicTab()) rl.chatboxPanelManager.close();
    }
    onConfigChanged(e) {
      if (e.getGroup() !== 'music') return;
      if (client.getGameState() !== 'LOGGED_IN') return;
      if (this.musicConfig.muteAmbientSounds()) client.setAmbientSound(null);
      else client.restoreAmbientSound();
    }
    isOnMusicTab() { return client.getVarcIntValue(VarClientID.TOPLEVEL_PANEL) === 13; }
    isChatboxOpen() { return this.searchInput != null && rl.chatboxPanelManager.getCurrentInput() === this.searchInput; }
    toggleStatus() {
      if (this.currentMusicFilter == null) this.currentMusicFilter = ALL; // (no hide tracks varbit in 2007)
      this.currentMusicFilter = (this.currentMusicFilter + 1) % MusicState.length;
      client.playSoundEffect(SoundEffectID.INTERFACE_SELECT1);
      this.redrawList();
    }
    /** musicTrackFilter for each track line, then the list closes up */
    redrawList() {
      const filter = this.currentMusicFilter;
      if ((filter == null || filter === ALL) && !this.search) { this.restoreList(); return; }
      const tracks = this.trackLines();
      if (!tracks.length) return;
      if (!this.saved) this.saved = tracks.map((w) => ({ w, x: w.getOriginalX(), y: w.getOriginalY() })).sort((a, b) => a.y - b.y);
      let y = this.saved[0].y;
      const step = this.saved.length > 1 ? this.saved[1].y - this.saved[0].y : 15;
      for (const { w, x } of this.saved) {
        const unlocked = (w.getTextColor() & 0xffffff) === UNLOCKED_COLOUR;
        let override = -1;
        if (filter != null) {
          if (filter === ALL) override = 1;
          else if (filter === LOCKED) override = unlocked ? 0 : 1;
          else if (filter === UNLOCKED) override = unlocked ? 1 : 0;
        }
        if (this.search && !w.getText().toLowerCase().includes(this.search)) override = 0;
        const show = override !== 0;
        w.setHidden(!show);
        if (show) { w.setOriginalX(x).setOriginalY(y).revalidate(); y += step; }
      }
    }
    restoreList() {
      if (!this.saved) return;
      for (const { w, x, y } of this.saved) { w.setHidden(false); w.setOriginalX(x).setOriginalY(y).revalidate(); }
      this.saved = null;
    }
    trackLines() {
      const ws = [];
      for (let i = 1; i < 700; i++) {
        const c = ll.api.com((MUSIC << 16) | i);
        if (!c) break;
        if (c.type !== 4 || (c.layer & 0xffff) !== 0 || c.layer >>> 16 !== MUSIC || c.y < FIRST_TRACK_Y) continue;
        if (c.colour !== LOCKED_COLOUR && c.colour !== UNLOCKED_COLOUR) continue;
        ws.push(client.getWidget(MUSIC, i));
      }
      return ws.filter(Boolean);
    }
    openSearch() {
      this.updateFilter('');
      client.playSoundEffect(SoundEffectID.INTERFACE_SELECT1);
      const btn = this.musicSearchButton;
      btn.action = 'Close';
      btn.listener = () => this.closeSearch();
      this.searchInput = rl.chatboxPanelManager.openTextInput('Search music list')
        .onChanged((s) => this.updateFilter(String(s).trim()))
        .onDone(() => false)
        .onClose(() => {
          this.updateFilter('');
          btn.listener = () => this.openSearch();
          btn.action = 'Open';
        })
        .build();
    }
    closeSearch() {
      this.updateFilter('');
      rl.chatboxPanelManager.close();
      client.playSoundEffect(SoundEffectID.INTERFACE_SELECT1);
    }
    updateFilter(input) {
      this.search = input.toLowerCase();
      this.redrawList();
    }
    onAreaSoundEffectPlayed(ev) {
      const kind = ev.getSourceKind(); // 'local' / 'player' / 'npc' / null (our actors are snapshots)
      const soundId = ev.getSoundId();
      const c = this.musicConfig;
      if (kind === 'local' && c.muteOwnAreaSounds()) ev.consume();
      else if (kind !== 'local' && (kind === 'player' || (kind == null && SOURCELESS_PLAYER_SOUNDS.has(soundId))) && c.muteOtherAreaSounds()) ev.consume();
      else if (kind === 'npc' && c.muteNpcAreaSounds()) ev.consume();
      else if (kind == null && !SOURCELESS_PLAYER_SOUNDS.has(soundId) && c.muteEnvironmentAreaSounds()) ev.consume();
    }
    onSoundEffectPlayed(ev) {
      if (this.musicConfig.mutePrayerSounds() && PRAYER_SOUNDS.has(ev.getSoundId())) ev.consume();
    }
  }

  const plugin = new MusicPlugin();
  ll.__music = { plugin, PRAYER_SOUNDS };
  rl.registerPlugin('music', plugin);
})();
