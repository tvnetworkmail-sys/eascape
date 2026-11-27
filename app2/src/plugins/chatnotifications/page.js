// RuneLite's Chat Notifications, cloned from net.runelite.client.plugins.chatnotifications (BSD 2-Clause, Copyright (c)
// 2018, Hydrox6 <ikada@protonmail.ch> and RuneLite contributors): ChatNotificationsPlugin.
// Adapted: the message node is the 2007 chat line (ChatMessage.setMessage); RuneLite's <colHIGHLIGHT> / <colNORMAL>
// are ChatColorConfig's opaque defaults for the chat type as 2007 colour tags, NORMAL the line's own colour (@end@);
// the 2007 chat box has no underline, so the own name is only coloured. The 2007 clan chat is RuneLite's friends chat
// (FRIENDSCHAT, its channel the sender). Left out: broadcasts (2019), the 2021 clan chats, Jagex escaping (2007 chat has no <lt>/<gt> escapes).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, Text, notifier } = rl;
  const runeliteTitle = 'RuneLite';

  // ChatColorConfig's opaque highlight defaults, by chat type
  const HIGHLIGHT = { PRIVATECHAT: '<col=002783>', MODPRIVATECHAT: '<col=002783>', PRIVATECHATOUT: '<col=002783>', GAMEMESSAGE: '<col=ef1020>', CONSOLE: '<col=ef1020>' };
  const toLine = (s, type) => rl.toGameTags(String(s)
    .replace(/<colHIGHLIGHT>/g, HIGHLIGHT[type] || '<col=000000>')
    .replace(/<colNORMAL>/g, '\u0000END').replace(/<\/?u>/g, '')).replace(/\u0000END/g, '@end@');
  const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  class ChatNotificationsPlugin {
    constructor() { this.configGroup = 'chatnotification'; this.usernameMatcher = null; this.highlightPatterns = []; }

    startUp() {
      this.config = rl.configProxy('chatnotification', () => this.configItems);
      this.updateHighlights();
    }

    shutDown() { this.usernameMatcher = null; this.highlightPatterns = []; }

    onGameStateChanged(event) {
      const s = event.getGameState();
      if (s === rl.GameState.LOGIN_SCREEN || s === rl.GameState.HOPPING) this.usernameMatcher = null;
    }

    onConfigChanged(event) { if (event.getGroup() === 'chatnotification') this.updateHighlights(); }

    updateHighlights() {
      this.highlightPatterns = [];
      if (String(this.config.highlightWordsString()).trim() !== '') {
        const items = Text.fromCSV(this.config.highlightWordsString());
        const joined = items.map((s) => this.quoteAndIgnoreColor(s)).join('|');
        this.highlightPatterns.push(new RegExp('(?:\\b|(?<=\\s)|^)(?:' + joined + ')(?:\\b|(?=\\s)|$)', 'gi'));
      }
      for (const line of String(this.config.highlightRegexString() || '').split('\n').map((x) => x.trim()).filter(Boolean)) {
        const p = ChatNotificationsPlugin.compilePattern(line);
        if (p) this.highlightPatterns.push(p);
      }
    }

    static compilePattern(pattern) { try { return new RegExp(pattern, 'gi'); } catch { return null; } }

    onChatMessage(chatMessage) {
      const type = chatMessage.getType();
      let update = false;
      switch (type) {
        case 'TRADEREQ':
          if (chatMessage.getMessage().includes('wishes to trade with you.')) this.notify(this.config.notifyOnTrade(), chatMessage.getMessage());
          break;
        case 'CHALREQ_TRADE':
          if (chatMessage.getMessage().includes('wishes to duel with you.')) this.notify(this.config.notifyOnDuel(), chatMessage.getMessage());
          break;
        case 'PRIVATECHAT':
        case 'MODPRIVATECHAT':
          this.notify(this.config.notifyOnPM(), chatMessage.getName() + ': ' + chatMessage.getMessage());
          break;
        case 'PRIVATECHATOUT':
        case 'DIALOG':
        case 'MESBOX':
          return;
        case 'MODCHAT':
        case 'PUBLICCHAT':
        case 'FRIENDSCHAT':
          if (client.getLocalPlayer() != null && Text.removeTags(chatMessage.getName()).replace(/ /g, ' ') === client.getLocalPlayer().getName()) return;
          break;
        case 'CONSOLE':
          if (chatMessage.getName() === runeliteTitle) return;
          break;
        default:
      }
      // (the line as the plugins before have left it)
      const msg = chatMessage.msg || {};
      let value = typeof msg.replace === 'string' ? Text.fromGameTags(msg.replace) : chatMessage.getMessage();

      if (this.usernameMatcher == null && client.getLocalPlayer() != null && client.getLocalPlayer().getName() != null) {
        const username = client.getLocalPlayer().getName();
        const pattern = username.split(' ').map((s) => (s ? quote(s) : '')).join('[  ]'); // space or nbsp
        this.usernameMatcher = new RegExp('\\b' + pattern + '\\b', 'gi');
      }

      if (this.config.highlightOwnName() && this.usernameMatcher != null) {
        const message = value;
        this.usernameMatcher.lastIndex = 0;
        if (this.usernameMatcher.test(message)) {
          const username = client.getLocalPlayer().getName();
          value = message.replace(this.usernameMatcher, (m, start) => {
            // start not end, since username won't contain a col tag
            const closeColor = getLastColor(message.substring(0, start)) || '<colNORMAL>';
            return '<colHIGHLIGHT><u>' + username + '</u>' + closeColor;
          });
          update = true;
          if (['PUBLICCHAT', 'PRIVATECHAT', 'FRIENDSCHAT', 'MODCHAT', 'MODPRIVATECHAT'].includes(type)) {
            this.sendNotification(this.config.notifyOnOwnName(), chatMessage);
          }
        }
      }

      let matchesHighlight = false;
      let nodeValue = value;
      for (const pattern of this.highlightPatterns) {
        pattern.lastIndex = 0;
        if (!pattern.test(nodeValue)) continue;
        const src = nodeValue;
        nodeValue = src.replace(pattern, (...args) => {
          const m = args[0];
          const offset = args.find((a, i) => i > 0 && typeof a === 'number');
          const end = offset + m.length;
          const closeColor = getLastColor(src.substring(0, end)) || '<colNORMAL>';
          update = true;
          matchesHighlight = true;
          return '<colHIGHLIGHT>' + stripColor(m) + closeColor;
        });
      }
      if (matchesHighlight) {
        value = nodeValue;
        this.sendNotification(this.config.notifyOnHighlight(), chatMessage);
      }
      if (update) chatMessage.setMessage(toLine(value, type));
    }

    notify(notification, message) { if (notification) notifier.notify(message); }

    sendNotification(notification, message) {
      const name = message.getName();
      const sender = message.getSender();
      let m = '';
      if (sender) m += '[' + sender + '] ';
      if (name) m += name + ': ';
      m += message.getMessage();
      this.notify(notification, m);
    }

    quoteAndIgnoreColor(str) {
      let s = '';
      for (const c of str) s += quote(c) + '(?:<col=[^>]*?>)?';
      return s;
    }
  }

  /** the last colour tag of a string, or null if there was none */
  function getLastColor(str) {
    const colIdx = str.lastIndexOf('<col=');
    const colEndIdx = str.lastIndexOf('</col>');
    if (colEndIdx > colIdx) return '<colNORMAL>';
    if (colIdx === -1) return null; // no color
    const closeIdx = str.indexOf('>', colIdx);
    if (closeIdx === -1) return null; // unclosed col tag
    return str.substring(colIdx, closeIdx + 1); // include the >
  }

  const stripColor = (str) => str.replace(/(<col=[0-9a-f]+>|<\/col>)/g, '');

  const plugin = new ChatNotificationsPlugin();
  rl.registerPlugin('chatnotifications', plugin);
  ll.chatNotificationsTest = { plugin, getLastColor, stripColor, toLine };
})();
