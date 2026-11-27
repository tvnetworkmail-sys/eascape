// RuneLite's Chat Filter, cloned from net.runelite.client.plugins.chatfilter (BSD 2-Clause, Copyright
// (c) 2018, Magic fTail; (c) 2019, osrs-music-map; and RuneLite contributors): ChatFilterPlugin.
// RuneLite filters in the chat box's chatFilterCheck script; here each line is filtered as the client
// adds it (a removed line is dropped). Gaps: "Collapse game/player chat" needs the client to remove an
// earlier line, which its chat hook can't yet, so duplicates aren't collapsed; friends chat (clan chat
// in 2007) membership isn't known to the hook, so those options don't change anything.
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client } = rl;
  const CENSOR_MESSAGE = 'Hey, everyone, I just tried to say something very silly!';
  const PLAYER_TYPES = new Set(['PUBLICCHAT', 'MODCHAT', 'PRIVATECHAT', 'MODPRIVATECHAT', 'FRIENDSCHAT']);
  const GAME_TYPES = new Set(['GAMEMESSAGE', 'FRIENDSCHATNOTIFICATION']);
  const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const compile = (p) => { try { return new RegExp(p, 'gi'); } catch { return null; } };
  const standardize = (n) => String(n || '').replace(/ /g, ' ').replace(/[_-]/g, ' ').toLowerCase().trim();

  class ChatFilterPlugin {
    constructor() {
      this.configGroup = 'chatfilter';
      this.config = rl.configProxy('chatfilter', () => this.configItems);
      this.filteredPatterns = []; this.filteredNamePatterns = [];
      this.repeats = new Map();
    }
    startUp() { this.updateFilteredPatterns(); }
    shutDown() { this.filteredPatterns = []; this.filteredNamePatterns = []; this.repeats.clear(); }
    onConfigChanged() { this.updateFilteredPatterns(); }
    stripAccents(s) { return this.config.stripAccents() ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
    updateFilteredPatterns() {
      const words = String(this.config.filteredWords() || '').split(',').map((s) => s.trim()).filter(Boolean);
      const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
      this.filteredPatterns = [...words.map((w) => new RegExp(quote(this.stripAccents(w)), 'gi')), ...lines(this.config.filteredRegex()).map((r) => compile(this.stripAccents(r))).filter(Boolean)];
      this.filteredNamePatterns = lines(this.config.filteredNames()).map((r) => compile(this.stripAccents(r))).filter(Boolean);
    }
    canFilterPlayer(name) {
      const me = client.getLocalPlayer();
      if (me && name === me.getName()) return false;
      const friend = ll.api && ll.api.isFriend ? ll.api.isFriend(name) : false;
      return this.config.filterFriends() || !friend;
    }
    isNameFiltered(name) {
      const n = standardize(name);
      return this.filteredNamePatterns.some((p) => { p.lastIndex = 0; return p.test(n); });
    }
    censorMessage(username, message) {
      const type = this.config.filterType();
      if (username && this.isNameFiltered(username)) {
        if (type === 'CENSOR_WORDS') return '*'.repeat(message.length);
        if (type === 'CENSOR_MESSAGE') return CENSOR_MESSAGE;
        return null;
      }
      let stripped = message.replace(/ /g, ' ');
      const accents = this.stripAccents(stripped);
      let filtered = false;
      for (const p of this.filteredPatterns) {
        p.lastIndex = 0;
        let sb = ''; let idx = 0; let m;
        while ((m = p.exec(accents)) !== null) {
          if (type === 'CENSOR_MESSAGE') return CENSOR_MESSAGE;
          if (type === 'REMOVE_MESSAGE') return null;
          sb += stripped.slice(idx, m.index) + '*'.repeat(m[0].length);
          idx = m.index + m[0].length;
          filtered = true;
          if (m[0].length === 0) p.lastIndex++;
        }
        stripped = sb + stripped.slice(idx);
      }
      return filtered ? stripped : message;
    }
    onChatMessage(e) {
      const type = e.getType();
      let message = e.getMessage();
      const name = e.getName();
      let block = false;
      if (PLAYER_TYPES.has(type)) {
        if (this.canFilterPlayer(name)) { message = this.censorMessage(name, message); block = message === null; }
      } else if (GAME_TYPES.has(type) && this.config.filterGameChat()) {
        message = this.censorMessage(null, message); block = message === null;
      }
      if (!block && (type === 'PUBLICCHAT' || type === 'MODCHAT') && this.config.maxRepeatedPublicChats() > 0) {
        const k = `${name}:${message}`;
        const n = (this.repeats.get(k) || 0) + 1;
        this.repeats.set(k, n);
        if (this.repeats.size > 100) this.repeats.delete(this.repeats.keys().next().value);
        block = n > this.config.maxRepeatedPublicChats();
      }
      if (block) e.drop();
      else if (message !== e.getMessage()) e.setMessage(message);
    }
  }
  rl.registerPlugin('chatfilter', new ChatFilterPlugin());
})();
