// RuneLite's Player Indicators plugin, cloned from net.runelite.client.plugins.playerindicators (BSD 2-Clause, Copyright
// (c) 2018, Tomas Slusny <slusnucky@gmail.com> and RuneLite contributors): PlayerIndicatorsPlugin, PlayerIndicatorsConfig,
// PlayerIndicatorsService, PlayerIndicatorsOverlay, PlayerIndicatorsTileOverlay, PlayerIndicatorsMinimapOverlay,
// PlayerNameLocation. Era-trim: no clan members / clan titles (OSRS clans, 2021) and no party members (RuneLite's party
// service). 2007's clan chat (Aug 2007) is OSRS's friends chat: members and ranks from the client's channel list
// (client.getFriendsChatManager); the rank icons aren't drawn yet (no ChatIconManager for the 2007 rank sprites). Team is the 2007 client's player team (the worn cape). PvP: the Wilderness (OSRS's
// INSIDE_WILDERNESS varbit; our world has no PvP areas). The trade window's title is 2007's "Trading With: " (335:16),
// coloured from rl.viewDrawnHooks while it's open (RuneLite: TRADE_MAIN_INIT). The old config migration is left out
// (no old keys here).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Overlay, OverlayPosition, OverlayLayer, OverlayPriority, OverlayUtil, Point, Text, ColorUtil, MenuAction } = rl;
  const GROUP = 'playerindicators';
  const PRIORITY_MED = OverlayPriority.MED !== undefined ? OverlayPriority.MED : 50;
  const PRIORITY_HIGH = OverlayPriority.HIGH !== undefined ? OverlayPriority.HIGH : 100;
  const TRADE_TITLE = (335 << 16) | 16; // InterfaceID.Trademain.TITLE
  const TRADING_WITH_TEXT = 'Trading With: ';

  // ---- PlayerIndicatorsService
  class Decorations {
    constructor(friendsChatRank, color) { this.friendsChatRank = friendsChatRank; this.color = color; }
    getFriendsChatRank() { return this.friendsChatRank; }
    getColor() { return this.color; }
  }
  const inWilderness = () => !!(ll.api && ll.api.ifOpen && ll.api.ifOpen(381));
  class PlayerIndicatorsService {
    constructor(plugin) { this.plugin = plugin; }
    forEachPlayer(consumer) {
      const wv = client.getTopLevelWorldView();
      for (const player of wv.players()) {
        const lp = player.getLocalLocation();
        if (!lp) continue;
        const decorations = this.getDecorations(player);
        if (decorations != null && decorations.getColor() != null) consumer(player, decorations);
      }
    }
    getDecorations(player) {
      if (player.getName() == null) return null;
      const config = this.plugin.config;
      const isEnabled = (hs) => hs === 'ENABLED' || (hs === 'PVP' && inWilderness());
      let color = null;
      const local = client.getLocalPlayer();
      if (local && player.getIndex() === local.getIndex() && player.getName() === local.getName()) {
        if (isEnabled(config.highlightOwnPlayer())) color = config.getOwnPlayerColor();
      } else if (player.isFriend() && isEnabled(config.highlightFriends())) {
        color = config.getFriendColor();
      } else if (player.isFriendsChatMember() && isEnabled(config.highlightFriendsChat())) {
        color = config.getFriendsChatMemberColor();
      } else if (player.getTeam() > 0 && local && local.getTeam() === player.getTeam() && isEnabled(config.highlightTeamMembers())) {
        color = config.getTeamMemberColor();
      } else if (!player.isFriendsChatMember() && !player.isClanMember() && isEnabled(config.highlightOthers())) {
        color = config.getOthersColor();
      }
      let rank = null;
      if (player.isFriendsChatMember() && config.showFriendsChatRanks()) rank = this.getFriendsChatRank(player);
      if (color == null && rank == null) return null;
      return new Decorations(rank, color);
    }
  }

  PlayerIndicatorsService.prototype.getFriendsChatRank = function getFriendsChatRank(player) {
    const friendsChatManager = client.getFriendsChatManager();
    if (friendsChatManager == null) return rl.FriendsChatRank.UNRANKED;
    const friendsChatMember = friendsChatManager.findByName(Text.removeTags(player.getName()));
    return friendsChatMember != null ? friendsChatMember.getRank() : rl.FriendsChatRank.UNRANKED;
  };

  // ---- PlayerIndicatorsOverlay
  const ACTOR_OVERHEAD_TEXT_MARGIN = 40;
  const ACTOR_HORIZONTAL_TEXT_MARGIN = 10;
  class PlayerIndicatorsOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(PRIORITY_MED);
    }
    render(graphics) {
      this.plugin.service.forEachPlayer((player, decorations) => this.renderPlayerOverlay(graphics, player, decorations));
      return null;
    }
    renderPlayerOverlay(graphics, actor, decorations) {
      const drawPlayerNamesConfig = this.plugin.config.playerNamePosition();
      if (drawPlayerNamesConfig === 'DISABLED') return;
      const zOffset = drawPlayerNamesConfig === 'MODEL_CENTER' || drawPlayerNamesConfig === 'MODEL_RIGHT'
        ? Math.trunc(actor.getLogicalHeight() / 2) : actor.getLogicalHeight() + ACTOR_OVERHEAD_TEXT_MARGIN;
      const name = Text.sanitize(actor.getName());
      let textLocation = actor.getCanvasTextLocation(graphics, name, zOffset);
      if (drawPlayerNamesConfig === 'MODEL_RIGHT') {
        textLocation = actor.getCanvasTextLocation(graphics, '', zOffset);
        if (textLocation == null) return;
        textLocation = new Point(textLocation.getX() + ACTOR_HORIZONTAL_TEXT_MARGIN, textLocation.getY());
      }
      if (textLocation == null) return;
      // (rank images: see the header)
      OverlayUtil.renderTextLocation(graphics, textLocation, name, decorations.getColor());
    }
  }

  class PlayerIndicatorsTileOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setLayer(OverlayLayer.ABOVE_SCENE);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(PRIORITY_MED);
    }
    render(graphics) {
      if (!this.plugin.config.drawTiles()) return null;
      this.plugin.service.forEachPlayer((player, decorations) => {
        const poly = player.getCanvasTilePoly();
        if (poly != null) OverlayUtil.renderPolygon(graphics, poly, decorations.getColor());
      });
      return null;
    }
  }

  class PlayerIndicatorsMinimapOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.plugin = plugin;
      this.setLayer(OverlayLayer.ABOVE_WIDGETS);
      this.setPosition(OverlayPosition.DYNAMIC);
      this.setPriority(PRIORITY_HIGH);
    }
    render(graphics) {
      this.plugin.service.forEachPlayer((player, decorations) => {
        const name = player.getName().replace(/ /g, ' ');
        if (this.plugin.config.drawMinimapNames()) {
          const minimapLocation = player.getMinimapLocation();
          if (minimapLocation != null) OverlayUtil.renderTextLocation(graphics, minimapLocation, name, decorations.getColor());
        }
      });
      return null;
    }
  }

  // ---- PlayerIndicatorsPlugin
  const MENU_TYPES = new Set([MenuAction.WALK, MenuAction.WIDGET_TARGET_ON_PLAYER, MenuAction.ITEM_USE_ON_PLAYER, MenuAction.PLAYER_FIRST_OPTION,
    MenuAction.PLAYER_SECOND_OPTION, MenuAction.PLAYER_THIRD_OPTION, MenuAction.PLAYER_FOURTH_OPTION, MenuAction.PLAYER_FIFTH_OPTION,
    MenuAction.PLAYER_SIXTH_OPTION, MenuAction.PLAYER_SEVENTH_OPTION, MenuAction.PLAYER_EIGHTH_OPTION]);
  class PlayerIndicatorsPlugin {
    constructor() {
      this.configGroup = GROUP;
      this.service = new PlayerIndicatorsService(this);
      this.tradeHook = () => this.colorTradeTitle();
    }
    startUp() {
      this.config = rl.configProxy(GROUP, () => this.configItems);
      this.overlays = [new PlayerIndicatorsOverlay(this), new PlayerIndicatorsTileOverlay(this), new PlayerIndicatorsMinimapOverlay(this)];
      for (const o of this.overlays) rl.overlayManager.add(o);
      rl.viewDrawnHooks.push(this.tradeHook);
    }
    shutDown() {
      for (const o of this.overlays || []) rl.overlayManager.remove(o);
      const i = rl.viewDrawnHooks.indexOf(this.tradeHook);
      if (i >= 0) rl.viewDrawnHooks.splice(i, 1);
    }
    onClientTick() {
      if (client.isMenuOpen()) return;
      for (const entry of client.getMenuEntries()) {
        const type = entry.getType() >= 2000 ? entry.getType() - 2000 : entry.getType();
        if (!MENU_TYPES.has(type)) continue;
        const player = entry.getPlayer();
        if (player == null) continue;
        const decorations = this.service.getDecorations(player);
        if (decorations == null) continue;
        const oldTarget = entry.getTarget();
        const newTarget = this.decorateTarget(oldTarget, decorations);
        if (newTarget !== oldTarget) entry.setTarget(newTarget);
      }
    }
    decorateTarget(oldTarget, decorations) {
      let newTarget = oldTarget;
      if (decorations.getColor() != null && this.config.colorPlayerMenu()) {
        let prefix = '';
        let idx = oldTarget.indexOf('->');
        if (idx !== -1) {
          prefix = oldTarget.substring(0, idx + 3); // <col=ff9040>Earth rune</col><col=ff> ->
          oldTarget = oldTarget.substring(idx + 3);
        }
        idx = oldTarget.indexOf('>');
        oldTarget = oldTarget.substring(idx + 1);
        newTarget = prefix + ColorUtil.prependColorTag(oldTarget, decorations.getColor());
      }
      // (friends chat rank icons: see the header)
      return newTarget;
    }
    /** onScriptPostFired(TRADE_MAIN_INIT): the trade window title in the player's colour */
    colorTradeTitle() {
      if (!(ll.api && ll.api.ifOpen && ll.api.ifOpen(TRADE_TITLE >>> 16))) return;
      const tradeTitle = client.getWidget(TRADE_TITLE);
      if (tradeTitle == null) return;
      const header = tradeTitle.getText();
      if (!header.startsWith(TRADING_WITH_TEXT) || header.includes('<col=')) return;
      const playerName = header.substring(TRADING_WITH_TEXT.length);
      const targetPlayer = this.findPlayer(playerName);
      if (targetPlayer == null) return;
      const decorations = this.service.getDecorations(targetPlayer);
      if (decorations != null && decorations.getColor() != null) tradeTitle.setText(TRADING_WITH_TEXT + ColorUtil.wrapWithColorTag(playerName, decorations.getColor()));
    }
    findPlayer(name) {
      for (const player of client.getPlayers()) if (player.getName() === name) return player;
      return null;
    }
  }

  const plugin = new PlayerIndicatorsPlugin();
  ll.__playerindicators = { plugin, Decorations };
  rl.registerPlugin(GROUP, plugin);
})();
