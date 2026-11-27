// RuneLite's Team plugin, cloned from net.runelite.client.plugins.team (BSD 2-Clause, Copyright (c) 2017, Devin French
// <https://github.com/devinfrench> and RuneLite contributors): TeamPlugin, TeamConfig, TeamCapesOverlay, MembersIndicator.
// Era-trim: no clan chat counter (OSRS clans, 2021); the team capes are 2007's Team-1..50 (wilderness_cape_1 4315, in
// twos; the later Team cape zero / x / i are 2018). 2007's clan chat is OSRS's friends chat: members from the client's
// channel list, joins and leaves from the core's FriendsChatMemberJoined / Left. Players here are snapshots, so teams are kept by player index, and the core
// posts no PlayerChanged: each player's team is checked on every game tick instead.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, OverlayPanel, OverlayPosition, OverlayPriority, ComponentOrientation, ImageComponent, Counter, GameState, Text } = rl;
  const GROUP = 'teamCapes';
  const WILDERNESS_CAPE_1 = 4315;
  const FRIENDS_CHAT_ICON = -1; // SpriteID.SideIcons.FRIENDS_CHAT: not mapped to a 2007 sprite yet (the counter shows without an icon)

  class MembersIndicator extends Counter {
    constructor(image, plugin) { super(image, plugin, 0); }
  }

  class TeamCapesOverlay extends OverlayPanel {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.setPriority(OverlayPriority.LOW);
      this.panelComponent.setWrap(true);
      this.panelComponent.setOrientation(ComponentOrientation.HORIZONTAL);
      this.addMenuEntry('RUNELITE_OVERLAY_CONFIG', 'Configure', 'Teamcapes overlay');
    }
    render(graphics) {
      const teams = this.plugin.getTeams();
      if (teams.size === 0 || !this.plugin.config.teamCapesOverlay()) return null;
      for (const [team, count] of teams) {
        if (count < this.plugin.config.getMinimumCapeCount()) continue;
        const teamcapeNumber = team - 1;
        if (teamcapeNumber >= 50) continue; // (Team cape zero / x / i: 2018)
        const itemID = 2 * teamcapeNumber + WILDERNESS_CAPE_1;
        this.panelComponent.getChildren().push(new ImageComponent(rl.itemManager.getImage(itemID, count, true)));
      }
      return super.render(graphics);
    }
  }

  class TeamPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.teams = new Map(); this.playerTeam = new Map(); this.players = new Map();
      this.friendsChatCount = 0; this.friendsChatIndicator = null;
    }
    getTeams() { return this.teams; }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlay = new TeamCapesOverlay(this);
      rl.overlayManager.add(this.overlay);
      client.getPlayers().forEach((p) => this.updateTeam(p));
    }
    shutDown() {
      rl.overlayManager.remove(this.overlay);
      this.teams.clear(); this.playerTeam.clear(); this.players.clear();
      this.removeFriendsChatCounter();
      this.friendsChatCount = 0;
    }
    onConfigChanged(e) {
      if (e.getGroup() !== GROUP) return;
      if (this.config.friendsChatMemberCounter()) this.addFriendsChatCounter(); else this.removeFriendsChatCounter();
    }
    onGameStateChanged(state) {
      const gs = state.getGameState();
      if (gs === GameState.LOGIN_SCREEN || gs === GameState.CONNECTION_LOST || gs === GameState.HOPPING) {
        this.players.clear();
        this.removeFriendsChatCounter();
      }
    }
    onPlayerSpawned(event) {
      const local = client.getLocalPlayer();
      const player = event.getPlayer();
      if (!local || player.getIndex() !== local.getIndex()) this.players.set(Text.removeTags(player.getName()), player.getIndex());
      if (player.isFriendsChatMember()) { ++this.friendsChatCount; this.addFriendsChatCounter(); }
      this.updateTeam(player);
    }
    onPlayerDespawned(event) {
      const player = event.getPlayer();
      const team = this.playerTeam.get(player.getIndex());
      this.playerTeam.delete(player.getIndex());
      if (team != null) { this.decTeam(team); this.sortTeams(); }
      for (const [n, i] of this.players) if (i === player.getIndex()) this.players.delete(n);
      if (player.isFriendsChatMember() && this.friendsChatCount > 0 && --this.friendsChatCount === 0) this.removeFriendsChatCounter();
    }
    onFriendsChatMemberJoined(event) {
      const member = event.getMember();
      if (member.getWorld() === client.getWorld()) {
        const idx = this.players.get(Text.toJagexName ? Text.toJagexName(member.getName()) : member.getName());
        if (idx != null) { ++this.friendsChatCount; this.addFriendsChatCounter(); }
      }
    }
    onFriendsChatMemberLeft(event) {
      const member = event.getMember();
      if (member.getWorld() === client.getWorld()) {
        const idx = this.players.get(Text.toJagexName ? Text.toJagexName(member.getName()) : member.getName());
        if (idx != null && this.friendsChatCount > 0 && --this.friendsChatCount === 0) this.removeFriendsChatCounter();
      }
    }
    onFriendsChatSync(event) { if (!event.isSync()) { this.removeFriendsChatCounter(); this.friendsChatCount = 0; } }
    // (onPlayerChanged: see the header)
    onGameTick() { for (const p of client.getPlayers()) this.updateTeam(p); }
    decTeam(team) { const v = this.teams.get(team); if (v == null) return; if (v > 1) this.teams.set(team, v - 1); else this.teams.delete(team); }
    updateTeam(player) {
      const oldTeam = this.playerTeam.get(player.getIndex()) || 0;
      if (oldTeam === player.getTeam()) return;
      if (oldTeam > 0) { this.decTeam(oldTeam); this.playerTeam.delete(player.getIndex()); }
      if (player.getTeam() > 0) {
        this.teams.set(player.getTeam(), (this.teams.get(player.getTeam()) || 0) + 1);
        this.playerTeam.set(player.getIndex(), player.getTeam());
      }
      this.sortTeams();
    }
    sortTeams() {
      this.teams = new Map([...this.teams.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0])));
    }
    addFriendsChatCounter() {
      if (!this.config.friendsChatMemberCounter() || this.friendsChatIndicator != null || this.friendsChatCount === 0) return;
      const image = rl.spriteManager.getSprite(FRIENDS_CHAT_ICON, 0);
      const plugin = this;
      this.friendsChatIndicator = new (class extends MembersIndicator {
        getText() { return String(plugin.friendsChatCount); }
        getTooltip() { return plugin.friendsChatCount + ' friends chat member(s) near you'; }
      })(image, this);
      rl.infoBoxManager.addInfoBox(this.friendsChatIndicator);
    }
    removeFriendsChatCounter() {
      rl.infoBoxManager.removeInfoBox(this.friendsChatIndicator);
      this.friendsChatIndicator = null;
    }
  }

  const plugin = new TeamPlugin();
  ll.__team = { plugin };
  rl.registerPlugin('team', plugin);
})();
