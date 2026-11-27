// RuneLite's Chat Channels plugin, cloned from net.runelite.client.plugins.chatchannel (BSD 2-Clause, Copyright (c)
// 2017, Devin French <https://github.com/devinfrench> and RuneLite contributors): ChatChannelPlugin, MemberActivity,
// MemberJoinMessage, ActivityType.
// 2007: the clan chat (tab 589) is OSRS's friends chat (FriendsChatManager, FriendsChatMemberJoined / Left and
// FriendsChatSync from the client's clan list, corea.js). Era-trim: no clan chat or guest clan chat (2021).
// - Join/leave lines are 2007 game messages (one colour per line), taken out again after the timeout
//   (client.removeChatMessage: that one line).
// - The channel name (589:0, "Talking in: ...") gets the member count, and ignored members' names in the list (the
//   2007 script's children of 589:5, name / world / rank per member) the ignored colour; both are display only and put
//   back each tick, since the 2007 scripts have no FRIENDS_CHAT_CHANNEL_REBUILD to follow.
// - Recent chats: the channels you were in (the 2007 client has no LAST_FRIENDSCHATJOIN varc, so the channel's name when
//   you join), shown while you're in none: the owner line says "Recent FCs" and the names are drawn over the empty list
//   (the 2007 list's children come from its scripts; RuneLite creates text widgets there).
// Left out (no 2007 way): rank icons (chat icons for the 2007 rank sprites), confirm kicks (the kick is sent from the
// prompt), the transparent chat box colours (no resizable mode).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, GameState, Overlay, OverlayPosition, OverlayLayer, Color } = rl;

  const MAX_CHATS = 10;
  const RECENT_TITLE = 'Recent FCs';
  const MESSAGE_DELAY = 10;
  const CHANNELNAME = (589 << 16) | 0; // InterfaceID.ChatchannelCurrent.CHANNELNAME
  const CHANNELOWNER = (589 << 16) | 1;
  const LIST = (589 << 16) | 5;
  const ActivityType = { JOINED: 'JOINED', LEFT: 'LEFT' };
  const ChatType = { FRIENDS_CHAT: 'FRIENDS_CHAT' };
  class MemberActivity {
    constructor(activityType, chatType, member, tick) { this.activityType = activityType; this.chatType = chatType; this.member = member; this.tick = tick; }
    getActivityType() { return this.activityType; }
    getChatType() { return this.chatType; }
    getMember() { return this.member; }
    getTick() { return this.tick; }
  }
  const sameMember = (a, b) => Text.toJagexName(a.getName()).toLowerCase() === Text.toJagexName(b.getName()).toLowerCase();
  const shown = (packed) => { const w = ll.api && ll.api.com ? ll.api.com(packed) : null; return w && !(ll.api.ifOpen && !ll.api.ifOpen(589)) ? w : null; };

  // the recent chats over the empty 2007 list (RuneLite: text children of ChatchannelCurrent.LIST, font 494, white)
  class RecentChatsOverlay extends Overlay {
    constructor(plugin) { super(plugin); this.plugin = plugin; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    render(graphics) {
      const p = this.plugin;
      if (!p.recentShown || !p.chats || client.getGameState() !== GameState.LOGGED_IN) return null;
      const list = client.getWidget(LIST);
      if (list == null || list.isHidden()) return null;
      const b = list.getBounds();
      graphics.setFont(rl.FontManager.getRunescapeSmallFont ? rl.FontManager.getRunescapeSmallFont() : graphics.getFont());
      let y = 2;
      for (const chat of [...p.chats].reverse()) {
        rl.OverlayUtil.renderTextLocation(graphics, new rl.Point(b.x + 20, b.y + y + 11), chat, Color.WHITE);
        y += 14;
      }
      return null;
    }
  }

  class ChatChannelPlugin {
    constructor() {
      this.configGroup = 'clanchat';
      this.config = rl.configProxy(this.configGroup, () => this.configItems);
      this.chats = null;
      this.joinMessages = []; // MemberJoinMessage { line, tick }
      this.activityBuffer = [];
      this.syncTick = -1;
      this.recentShown = false;
      this.lastChannel = null;
      this.overlay = new RecentChatsOverlay(this);
    }
    startUp() {
      this.chats = Text.fromCSV(this.config.chatsData());
      rl.overlayManager.add(this.overlay);
    }
    shutDown() {
      this.chats = null;
      rl.overlayManager.remove(this.overlay);
      this.restoreWidgets();
    }
    onConfigChanged(e) {
      if (e.getGroup() !== 'clanchat') return;
      if (!this.config.recentChats()) this.restoreWidgets();
      if (!this.config.showIgnores()) this.colorIgnoredPlayers(null);
    }
    onFriendsChatMemberJoined(event) {
      const member = event.getMember();
      if (this.syncTick === client.getTickCount()) return;
      if (!this.config.showFriendsChatJoinLeave() || member.getRank().getValue() < rl.FriendsChatRank[this.config.joinLeaveRank()].getValue()) return;
      this.queueJoin(member, ChatType.FRIENDS_CHAT);
    }
    onFriendsChatMemberLeft(event) {
      const member = event.getMember();
      if (!this.config.showFriendsChatJoinLeave() || member.getRank().getValue() < rl.FriendsChatRank[this.config.joinLeaveRank()].getValue()) return;
      this.queueLeave(member, ChatType.FRIENDS_CHAT);
    }
    queueJoin(member, chatType) { this.queue(ActivityType.JOINED, member, chatType); }
    queueLeave(member, chatType) { this.queue(ActivityType.LEFT, member, chatType); }
    queue(type, member, chatType) {
      // a join and a leave of the same member within the delay cancel out
      const i = this.activityBuffer.findIndex((a) => a.getChatType() === chatType && sameMember(a.getMember(), member));
      if (i >= 0) { this.activityBuffer.splice(i, 1); return; }
      this.activityBuffer.push(new MemberActivity(type, chatType, member, client.getTickCount()));
    }
    onGameTick() {
      if (client.getGameState() !== GameState.LOGGED_IN) return;
      const friendsChatManager = client.getFriendsChatManager();
      // recent chats: the channel you joined, and the list while you're in none
      const name = friendsChatManager && friendsChatManager.getCount() > 0 ? friendsChatManager.getName() : null;
      if (name && name !== this.lastChannel && this.config.recentChats()) this.updateRecentChat(name);
      this.lastChannel = name;
      const owner = shown(CHANNELOWNER);
      if (owner && (friendsChatManager == null || friendsChatManager.getCount() <= 0) && owner.text && this.config.recentChats()) this.loadFriendsChats();
      else if (this.recentShown && (name || !this.config.recentChats())) this.restoreWidgets();
      this.friendsChatChannelRebuilt();
      this.timeoutMessages();
      this.addActivityMessages();
    }
    timeoutMessages() {
      if (this.joinMessages.length === 0) return;
      const joinLeaveTimeout = this.config.joinLeaveTimeout();
      if (joinLeaveTimeout === 0) return;
      while (this.joinMessages.length) {
        const joinMessage = this.joinMessages[0];
        if (client.getTickCount() > joinMessage.tick + joinLeaveTimeout) {
          this.joinMessages.shift();
          client.removeChatMessage('GAMEMESSAGE', joinMessage.line);
        } else break;
      }
    }
    addActivityMessages() {
      while (this.activityBuffer.length) {
        const activity = this.activityBuffer[0];
        if (activity.getTick() >= client.getTickCount() - MESSAGE_DELAY) return;
        this.activityBuffer.shift();
        if (activity.getChatType() === ChatType.FRIENDS_CHAT) this.addActivityMessage(activity.getMember(), activity.getActivityType());
      }
    }
    addActivityMessage(member, activityType) {
      const friendsChatManager = client.getFriendsChatManager();
      if (friendsChatManager == null) return;
      const activityMessage = activityType === ActivityType.JOINED ? ' has joined.' : ' has left.';
      // (RuneLite colours the channel name and the text; a 2007 chat line has one colour)
      const messageString = new rl.ChatMessageBuilder().append('[').append(friendsChatManager.getName()).append('] ')
        .append(member.getName() + activityMessage).build();
      client.addChatMessage('FRIENDSCHATNOTIFICATION', '', messageString, '');
      this.joinMessages.push({ line: Text.removeTags(messageString), tick: client.getTickCount() });
    }
    onGameStateChanged(state) {
      const gameState = state.getGameState();
      if (gameState === GameState.LOGIN_SCREEN || gameState === GameState.CONNECTION_LOST || gameState === GameState.HOPPING) this.joinMessages.length = 0;
    }
    onFriendsChatSync() {
      this.syncTick = client.getTickCount();
      this.activityBuffer.length = 0;
    }
    /** ScriptPostFired FRIENDS_CHAT_CHANNEL_REBUILD's part: ignored members recoloured, the count after the channel's name */
    friendsChatChannelRebuilt() {
      if (this.config.showIgnores()) this.colorIgnoredPlayers(this.config.showIgnoresColor());
      const friendsChatManager = client.getFriendsChatManager();
      const chatTitle = shown(CHANNELNAME);
      if (friendsChatManager != null && friendsChatManager.getCount() > 0 && chatTitle != null) {
        const base = String(chatTitle.text || '').replace(/ \(\d+\/\d+\)$/, '');
        const text = base + ' (' + friendsChatManager.getCount() + '/' + friendsChatManager.getSize() + ')';
        if (chatTitle.text !== text) client.getWidget(CHANNELNAME).setText(text);
      }
    }
    loadFriendsChats() {
      const chatOwner = client.getWidget(CHANNELOWNER);
      if (chatOwner == null) return;
      if (chatOwner.getText() !== RECENT_TITLE) chatOwner.setText(RECENT_TITLE);
      this.recentShown = true;
    }
    restoreWidgets() {
      if (this.recentShown) {
        this.recentShown = false;
        const owner = client.getWidget(CHANNELOWNER);
        if (owner && owner.getText() === RECENT_TITLE) owner.setText('<col=ff9b00>Owner: None');
      }
      const title = shown(CHANNELNAME);
      if (title && / \(\d+\/\d+\)$/.test(title.text || '')) client.getWidget(CHANNELNAME).setText(title.text.replace(/ \(\d+\/\d+\)$/, ''));
      this.colorIgnoredPlayers(null);
    }
    updateRecentChat(s) {
      if (!s) return;
      s = Text.toJagexName(s);
      this.chats = this.chats.filter((c) => c.toLowerCase() !== s.toLowerCase());
      this.chats.push(s);
      while (this.chats.length > MAX_CHATS) this.chats.shift();
      rl.configManager.setConfiguration('clanchat', 'chatsData', Text.toCSV(this.chats));
    }
    /** the list's member names (every third child: name, world, rank) in the ignored colour; null puts white back */
    colorIgnoredPlayers(ignoreColor) {
      const children = rl.widgetChildren(LIST);
      if (children == null) return;
      const ignoreContainer = client.getIgnoreContainer();
      for (let i = 0; i < children.length; i += 3) {
        const listWidget = children[i];
        if (listWidget == null) continue;
        const memberName = Text.removeTags(listWidget.getText());
        if (memberName === '' || ignoreContainer.findByName(memberName) == null) continue;
        const rgb = ignoreColor == null ? 0xffffff : ignoreColor.getRGB() & 0xffffff;
        if ((listWidget.getTextColor() & 0xffffff) !== rgb) listWidget.setTextColor(rgb);
      }
    }
  }

  const plugin = new ChatChannelPlugin();
  ll.__chatchannel = { plugin, MemberActivity, ActivityType };
  rl.registerPlugin('chatchannel', plugin);
})();
