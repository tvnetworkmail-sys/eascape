// RuneLite's Chat History plugin, cloned from net.runelite.client.plugins.chathistory (BSD 2-Clause, Copyright (c) 2018,
// TheStonedTurtle and RuneLite contributors): ChatHistoryPlugin, ChatboxTab.
// 2007: the welcome message is the game message "Welcome to 2007RS." (OSRS: WELCOME "Welcome to Old School
// RuneScape"); the client clears its 100 chat lines at log out, as OSRS. Lines go back with the core's
// client.addChatMessage(..., false) (no ChatMessage). The chat box tabs are the 2007 frame's filter buttons (548:3 All,
// 6 Game, 9 Public, 13 Private, 17 Clan, 21 Trade; if1 button ops, type 43, where OSRS has CC_OP); none of them has a
// vanilla "Clear history" in 2007, so each gets one under its "View" option, and the removal is the core's
// client.removeChatMessages (ChatLineBuffer.removeMessageNode). The chat line option is 2007's "Report abuse" (OSRS:
// "Report") on the chat lines (137:2..), and the line holds "sender: <col=..>message", so the message is the part after
// the sender. PM target cycling: 2007's PM prompt (MESLAYERMODE 6) keeps its target in varc string 23 and draws it in
// the prompt's title (548:93); the next target goes there (OSRS: OPEN_PRIVATE_MESSAGE_INTERFACE, which the 2007
// client refuses while its prompt is up). The created entry runs its own click (our core posts no MenuOptionClicked for
// RuneLite entries).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, VarClientID, InputType } = rl;

  const WELCOME_MESSAGE = 'Welcome to 2006RS';
  const CLEAR_HISTORY = 'Clear history';
  const COPY_TO_CLIPBOARD = 'Copy to clipboard';
  const REPORT = 'Report abuse';
  const CYCLE_HOTKEY = 9; // KeyEvent.VK_TAB
  const FRIENDS_MAX_SIZE = 5;
  const IF_BUTTON = 43; // the 2007 client's if1 button op (OSRS: CC_OP / CC_OP_LOW_PRIORITY)
  const CHATBOX = 137;
  const PROMPT_TITLE = (548 << 16) | 93;

  const ALL_TYPES = ['GAMEMESSAGE', 'MODCHAT', 'PUBLICCHAT', 'PRIVATECHAT', 'TRADEREQ', 'LOGINLOGOUTNOTIFICATION', 'PRIVATECHATOUT', 'MODPRIVATECHAT', 'CHALREQ_TRADE', 'FRIENDSCHAT', 'FRIENDSCHATNOTIFICATION', 'CONSOLE'];
  const tab = (name, after, widgetId, types) => ({ name, after, widgetId, messageTypes: types });
  const ChatboxTab = {
    ALL: tab('ALL', 'View All', (548 << 16) | 3, ALL_TYPES),
    PRIVATE: tab('PRIVATE', 'View Private', (548 << 16) | 13, ['PRIVATECHAT', 'PRIVATECHATOUT', 'MODPRIVATECHAT', 'LOGINLOGOUTNOTIFICATION']),
    PUBLIC: tab('PUBLIC', 'View Public', (548 << 16) | 9, ['PUBLICCHAT', 'AUTOTYPER', 'MODCHAT', 'MODAUTOTYPER']),
    GAME: tab('GAME', 'View Game', (548 << 16) | 6, ['GAMEMESSAGE', 'ENGINE', 'BROADCAST', 'SNAPSHOTFEEDBACK', 'ITEM_EXAMINE', 'NPC_EXAMINE', 'OBJECT_EXAMINE', 'FRIENDNOTIFICATION',
      'IGNORENOTIFICATION', 'CONSOLE', 'SPAM', 'PLAYERRELATED', 'TENSECTIMEOUT', 'WELCOME', 'UNKNOWN']),
    CHANNEL: tab('CHANNEL', 'View Clan', (548 << 16) | 17, ['FRIENDSCHATNOTIFICATION', 'FRIENDSCHAT', 'CHALREQ_FRIENDSCHAT']),
    TRADE_GROUP: tab('TRADE_GROUP', 'View Trade', (548 << 16) | 21, ['TRADE_SENT', 'TRADEREQ', 'TRADE', 'CHALREQ_TRADE']),
  };
  ChatboxTab.of = (widgetId) => Object.values(ChatboxTab).find((t) => t && t.widgetId === widgetId) || null;

  class EvictingQueue {
    constructor(max) { this.max = max; this.items = []; }
    offer(x) { this.items.push(x); if (this.items.length > this.max) this.items.shift(); }
    clear() { this.items = []; }
    removeIf(fn) { this.items = this.items.filter((x) => !fn(x)); }
    [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  }

  class ChatHistoryPlugin {
    constructor() {
      this.configGroup = 'chathistory';
      this.config = rl.configProxy('chathistory', () => this.configItems);
      this.messageQueue = null;
      this.friends = null;
    }
    startUp() {
      // The client reuses MessageNodes after 100 chat messages of the same type, so this must be 100
      this.messageQueue = new EvictingQueue(100);
      this.friends = [];
      rl.keyManager.registerKeyListener(this);
    }
    shutDown() {
      this.messageQueue.clear();
      this.messageQueue = null;
      this.friends = null;
      rl.keyManager.unregisterKeyListener(this);
    }
    onChatMessage(chatMessage) {
      // Start sending old messages right after the welcome message, as that is most reliable source
      // of information that chat history was reset
      const chatMessageType = chatMessage.getType();
      if (chatMessageType === 'GAMEMESSAGE' && chatMessage.getMessage().toLowerCase().startsWith(WELCOME_MESSAGE.toLowerCase())) {
        if (!this.config.retainChatHistory()) return;
        // (after the client has added the welcome line itself, as OSRS posts ChatMessage once the line is in)
        const queued = [...this.messageQueue];
        queueMicrotask(() => {
          for (const queuedMessage of queued) {
            const t = queuedMessage.getType();
            const crown = queuedMessage.getCrown ? queuedMessage.getCrown() : 0;
            const name = (t === 'MODCHAT' || t === 'MODPRIVATECHAT' ? `<img=${crown}>` : '') + queuedMessage.getName();
            client.addChatMessage(t, name, queuedMessage.getValue(), queuedMessage.getSender(), false);
          }
        });
        return;
      }
      switch (chatMessageType) {
        case 'PRIVATECHATOUT':
        case 'PRIVATECHAT':
        case 'MODPRIVATECHAT': {
          const name = Text.removeTags(chatMessage.getName());
          // Remove to ensure uniqueness & its place in history
          const i = this.friends.indexOf(name);
          if (i >= 0) this.friends.splice(i, 1);
          // If the friend didn't previously exist ensure deque capacity doesn't increase by adding them
          else if (this.friends.length >= FRIENDS_MAX_SIZE) this.friends.shift();
          this.friends.push(name);
        }
        // intentional fall-through
        // falls through
        case 'PUBLICCHAT':
        case 'MODCHAT':
        case 'FRIENDSCHAT':
        case 'CONSOLE':
          this.messageQueue.offer(chatMessage.getMessageNode());
          break;
        default:
      }
    }
    onMenuOptionClicked(event) {
      const menuOption = event.getMenuOption();
      if (menuOption.endsWith(CLEAR_HISTORY)) this.clearChatboxHistory(ChatboxTab.of(event.getParam1()));
    }
    onMenuEntryAdded(entry) {
      if (!ll.c2007 && this.onMenuEntryAdded2006(entry)) return;
      if (entry.getType() !== IF_BUTTON) {
        this.reportEntry(entry);
        return;
      }
      const tab = ChatboxTab.of(entry.getActionParam1());
      if (tab != null && tab.after != null && this.config.clearHistory() && entry.getOption().endsWith(tab.after)) {
        const clearEntry = client.createMenuEntry(-2).setType(rl.MenuAction.RUNELITE_HIGH_PRIORITY || 1501);
        clearEntry.setParam1(entry.getActionParam1());
        let option = '';
        if (tab !== ChatboxTab.ALL) {
          // Pull tab name from menu since Trade/Group is variable
          const o = entry.getOption();
          const idx = o.indexOf(':');
          if (idx !== -1) option += o.slice(0, idx) + ':</col> ';
        }
        option += CLEAR_HISTORY;
        clearEntry.setOption(option);
        clearEntry.onClick(() => this.clearChatboxHistory(tab));
        return;
      }
      this.reportEntry(entry);
    }
    // 2006RS-2: the 2006 chat box has no tabs with View options: right-clicking the chat box gives "Clear history" (on
    // the menu's Cancel). Its chat lines carry their line in the entry's param0 (Client addChatOptions), so "Copy to
    // clipboard" goes on each line's "Add ignore" (the 2006 chat line has "Report abuse" for staff only).
    onMenuEntryAdded2006(entry) {
      const opt = Text.removeTags(entry.getOption() || '');
      if (opt === 'Cancel') {
        // (the client opens no menu over its chat buttons, so the entry is on the chat box itself where no line has options, below Cancel so a left
        // click there never clears; the 2006 chat box has one view, so it clears everything, as RuneLite's All tab)
        if (!this.config.clearHistory()) return true;
        const m = client.getMouseCanvasPosition();
        const x = m ? m.getX() : -1; const y = m ? m.getY() : -1;
        const c = ll.client;
        const cx = c ? c.frameChatX | 0 : 17; const cy = c ? c.frameChatY | 0 : 357;
        if (x < cx || x >= cx + 479 || y < cy || y >= cy + 96) return true;
        if (c && (c.menuNumEntries | 0) > 1) return true; // (only where no chat line has options)
        client.createMenuEntry(-2).setType(rl.MenuAction.RUNELITE_HIGH_PRIORITY || 1501).setParam1(ChatboxTab.ALL.widgetId)
          .setOption(CLEAR_HISTORY)
          .onClick(() => this.clearChatboxHistory(ChatboxTab.ALL));
        return true;
      }
      if (/^Add ignore\b/.test(opt)) {
        if (!this.config.copyToClipboard()) return true;
        const c = ll.client; const i = entry.getActionParam0();
        const raw = c && c.chatText && i >= 0 && i < 100 ? c.chatText[i] : null;
        if (raw == null) return true;
        const currentMessage = String(raw);
        client.createMenuEntry(1)
          .setOption(COPY_TO_CLIPBOARD)
          .setTarget(entry.getTarget())
          .setType(rl.MenuAction.RUNELITE)
          .onClick(() => {
            const text = Text.removeTags(currentMessage).replace(/@[a-z0-9]{3}@/g, '');
            try { navigator.clipboard.writeText(text); } catch { /* no clipboard */ }
            this.lastCopied = text;
          });
        return true;
      }
      return false;
    }
    reportEntry(entry) {
      if (entry.getOption() !== REPORT || !this.config.copyToClipboard()) return;
      const param1 = entry.getActionParam1();
      if (param1 >>> 16 !== CHATBOX) return;
      const line = ll.api.com(param1);
      if (!line || !line.text) return;
      // Extract and store message contents when menu is opened, the line can change while the menu is open
      const full = String(line.text);
      const at = full.indexOf(': <col=');
      const currentMessage = at >= 0 ? full.slice(at + 2) : full;
      client.createMenuEntry(1)
        .setOption(COPY_TO_CLIPBOARD)
        .setTarget(entry.getTarget())
        .setType(rl.MenuAction.RUNELITE)
        .onClick(() => {
          const text = Text.removeTags(currentMessage);
          try { navigator.clipboard.writeText(text); } catch { /* no clipboard */ }
          this.lastCopied = text;
        });
    }
    clearMessageQueue(tab) {
      if (tab === ChatboxTab.ALL || tab === ChatboxTab.PRIVATE) this.friends.length = 0;
      this.messageQueue.removeIf((e) => tab.messageTypes.includes(e.getType()));
    }
    clearChatboxHistory(tab) {
      if (tab == null) return;
      this.clearMessageQueue(tab);
      if (tab.after == null) return; // (a vanilla Clear option: none in 2007)
      // removes the lines from the chat box (and the split PM lines, which are the same lines in 2007)
      client.removeChatMessages(tab.messageTypes);
    }
    keyPressed(e) {
      if (e.keyCode !== CYCLE_HOTKEY || !this.config.pmTargetCycling()) return;
      if (client.getVarcIntValue(VarClientID.MESLAYERMODE) !== InputType.PRIVATE_MESSAGE) return;
      e.preventDefault();
      const target = this.findPreviousFriend();
      if (target == null) return;
      // (OSRS: OPEN_PRIVATE_MESSAGE_INTERFACE with the target, then the typed text put back and the input rebuilt)
      const currentMessage = client.getVarcStrValue(VarClientID.MESLAYERINPUT);
      client.setVarcStrValue(VarClientID.FRIENDTOMESSAGE, target);
      const title = client.getWidget(PROMPT_TITLE);
      if (title) title.setText('Enter message to send to ' + target);
      client.setVarcStrValue(VarClientID.MESLAYERINPUT, currentMessage);
    }
    keyTyped() {}
    keyReleased() {}
    findPreviousFriend() {
      const currentTarget = client.getVarcStrValue(VarClientID.FRIENDTOMESSAGE);
      if (currentTarget == null || !this.friends.length) return null;
      for (let i = this.friends.length - 1; i >= 0; i--) {
        if (this.friends[i] === currentTarget) return i > 0 ? this.friends[i - 1] : this.friends[this.friends.length - 1];
      }
      return this.friends[this.friends.length - 1];
    }
  }

  const plugin = new ChatHistoryPlugin();
  ll.__chathistory = { plugin, ChatboxTab };
  rl.registerPlugin('chathistory', plugin);
})();
