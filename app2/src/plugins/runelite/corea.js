// RuneLite core pieces the A-M clones use (additive, read only; nothing goes to the server):
// - ChatMessageManager / ChatMessageBuilder / ChatColorType / QueuedMessage: RuneLite's console messages
//   (chatMessageManager.queue) as our own game messages in the chat box. The 2007 chat box line is drawn in one
//   colour, so HIGHLIGHT / NORMAL colour tags are dropped (client.addChatMessage removes tags).
// - rl.npcChatText(): InterfaceID.ChatLeft.TEXT for the 2007 client, the open npcchat1-4 (241-244) lines joined
//   with <br> (null when no NPC dialogue is open), for plugins that read the NPC's dialogue text.
// - WorldPoint.fromCoord: the packed coord (level << 28 | x << 14 | z, the same packing as our server's coord vars).
// - VarClientID.TOPLEVEL_PANEL: the open side tab (the frame's (548) tab layers 99-112: the one not hidden; 3 = inventory,
//   as OSRS).
// - client.getDraggedWidget / getDragTime: the item being dragged (client hooks dragCom / dragSlot / dragCycles: the client's
//   objDragCom / objDragSlot / objDragCycles, read only). The 2007 client moves the item once the mouse has left a 5 px box and 5 cycles have passed, so the
//   widget's drag dead time is 4. rl.inventorySlot(componentId, slot) gives a slot's item and canvas bounds from the
//   component's slot layout (its width is in slots, marginX / marginY the gaps), for empty slots too.
// - client.playSoundEffect(id[, volume]): a cache sound effect played locally (client hook playSound: the client's
//   own synth playback, nothing sent). The 2007 client mixes it at the player's sound effect volume, so the volume
//   argument only mutes (0).
// - AlphaComposite.SrcOver(.derive(a)) and Graphics2D.setComposite: drawing at an alpha (canvas globalAlpha).
// - rl.modelOutlineRenderer (ModelOutlineRenderer.drawOutline): the outline of an NPC's, player's, loc's or ground item's
//   models as the client drew them this frame (client hook: lostliteModelDrawn passes the model's faces with its screen
//   points; the runtime keeps the visible triangles of the tags asked for, one frame ahead). The triangles fill a mask
//   at the overlay canvas's device scale (so it stays crisp when the game is scaled up), the mask is grown by the width
//   in game pixels, the inside cut out, and feather softens it (a blur).
// - client.getMenuX / getMenuY / getMenuWidth / getMenuHeight (the client's open menu box, read only).
// - rl.itemLayerAt(sceneX, sceneY): Tile.getItemLayer for a scene square: getTop() / getNext() over the obj stack's
//   items (top first, as the 2007 client's list), getLocalLocation, getCanvasTilePoly; null when nothing lies there.
// - FriendsChatManager.getName / getOwner / getSize (100, the 2007 channel's cap) / getKickRank / getMyRank (client hook
//   friendsChatInfo: the client's chatDisplayName / chatOwnerName / chatMinKick / chatRank, read only);
//   client.removeChatMessage(type, text): the oldest chat line of that type with that text (client hook removeChat with a
//   text, display only), for RuneLite's ChatLineBuffer.removeMessageNode of one line.
// - rl.widgetChildren(componentId): Widget.getChildren for the 2007 scripts' cc_create children (client hook
//   comChildren), each with getText / getTextColor / getIndex and display-only setText / setTextColor (setChildText /
//   setChildColour; the script's next rebuild puts its own back).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, WorldPoint } = rl;

  const ChatColorType = { NORMAL: 'NORMAL', HIGHLIGHT: 'HIGHLIGHT' };
  class ChatMessageBuilder {
    constructor() { this.parts = []; }
    append(x) {
      // append(ChatColorType) switches colour (one colour per 2007 chat line, so it's dropped); append(String) adds text
      if (x !== ChatColorType.NORMAL && x !== ChatColorType.HIGHLIGHT) this.parts.push(String(x));
      return this;
    }
    build() { return this.parts.join(''); }
  }
  const QueuedMessage = {
    builder() {
      const m = { type: 'CONSOLE', name: '', value: '', runeLiteFormattedMessage: null };
      const b = {
        type(t) { m.type = t; return b; },
        name(n) { m.name = n; return b; },
        value(v) { m.value = v; return b; },
        runeLiteFormattedMessage(s) { m.runeLiteFormattedMessage = s; return b; },
        build() { return Object.assign({}, m); },
      };
      return b;
    },
  };
  const chatMessageManager = {
    queue(message) {
      const text = message.runeLiteFormattedMessage != null ? message.runeLiteFormattedMessage : message.value;
      client.addChatMessage(message.type || 'CONSOLE', message.name || '', String(text), null);
    },
  };

  function npcChatText() {
    for (let g = 241; g <= 244; g++) {
      const head = client.getWidget(g, 0);
      if (!head || head.isHidden()) continue;
      const lines = [];
      for (let c = 2; c < 2 + (g - 240); c++) { const w = client.getWidget(g, c); if (w) lines.push(w.getText()); }
      return lines.join('<br>');
    }
    return null;
  }

  if (WorldPoint && !WorldPoint.fromCoord) {
    WorldPoint.fromCoord = (c) => new WorldPoint((c >>> 14) & 0x3fff, c & 0x3fff, (c >>> 28) & 3);
  }

  const toplevelPanel = () => {
    if (!ll.api || !ll.api.com) return -1;
    for (let tab = 0; tab < 14; tab++) { const c = ll.api.com((548 << 16) | (99 + tab)); if (c && !c.hide) return tab; }
    return -1;
  };
  const VarClientID = rl.VarClientID;
  if (VarClientID && VarClientID.TOPLEVEL_PANEL === undefined) {
    VarClientID.TOPLEVEL_PANEL = 'toplevelPanel';
    const getVarc = client.getVarcIntValue.bind(client);
    client.getVarcIntValue = (id) => (id === VarClientID.TOPLEVEL_PANEL ? toplevelPanel() : getVarc(id));
  }

  function inventorySlot(componentId, slot) {
    const c = ll.api && ll.api.com ? ll.api.com(componentId) : null;
    if (!c || !c.screen || !(c.width > 0)) return null;
    const x = c.screen[0] + (slot % c.width) * (32 + (c.marginX | 0));
    const y = c.screen[1] + Math.trunc(slot / c.width) * (32 + (c.marginY | 0));
    const t = c.linkObjType ? c.linkObjType[slot] | 0 : 0;
    const id = t > 0 ? t - 1 : -1;
    const quantity = id >= 0 && c.linkObjNumber ? c.linkObjNumber[slot] | 0 : 0;
    return { id, quantity, bounds: new rl.Rectangle(x, y, 32, 32) };
  }
  client.getDraggedWidget = () => {
    const c = ll.client;
    const id = c && typeof c.dragCom === 'number' ? c.dragCom : -1;
    if (id === -1) return null;
    return { getId: () => id, getIndex: () => c.dragSlot | 0, getDragDeadTime: () => 4, isIf3: () => false, getParent: () => client.getWidget(id) };
  };
  client.getDragTime = () => (ll.client ? ll.client.dragCycles | 0 : 0);

  client.playSoundEffect = (id, volume) => {
    if (volume === 0 || !ll.api || !ll.api.playSound) return;
    ll.api.playSound(id);
  };

  const makeComposite = (alpha) => ({ alpha, derive: (a) => makeComposite(a) });
  const AlphaComposite = { SrcOver: makeComposite(1) };
  const G = rl.Graphics2D && rl.Graphics2D.prototype;
  if (G && !G.__composite) {
    G.__composite = true;
    const begin = G._begin;
    G.setComposite = function setComposite(c) { this.composite = c && typeof c.alpha === 'number' ? c : null; };
    G.getComposite = function getComposite() { return this.composite || AlphaComposite.SrcOver; };
    G._begin = function _begin() { begin.call(this); if (this.composite) this.ctx.globalAlpha *= this.composite.alpha; };
  }

  Object.assign(rl, { AlphaComposite, inventorySlot, ChatColorType, ChatMessageBuilder, QueuedMessage, chatMessageManager, npcChatText });

  // Direction / Angle (net.runelite.api.coords), WorldPoint.toWorldArea, WorldArea.toWorldPointList / canTravelInDirection
  // (RuneLite's collision walk over client.getCollisionMaps(); Mage Training Arena's telekinetic maze)
  if (!rl.Direction) {
    const Direction = { NORTH: 'NORTH', SOUTH: 'SOUTH', EAST: 'EAST', WEST: 'WEST' };
    class Angle {
      constructor(angle) { this.angle = angle; }
      getAngle() { return this.angle; }
      getNearestDirection() {
        let round = this.angle >>> 9;
        const up = this.angle & 256;
        if (up !== 0) ++round; // round up
        return [Direction.SOUTH, Direction.WEST, Direction.NORTH, Direction.EAST][round & 3];
      }
    }
    const WP = rl.WorldPoint; const WA = rl.WorldArea;
    WP.prototype.toWorldArea = function toWorldArea() { return new WA(this.x, this.y, 1, 1, this.plane); };
    WA.prototype.toWorldPointList = function toWorldPointList() {
      const list = [];
      for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) list.push(new WP(this.x + x, this.y + y, this.plane));
      return list;
    };
    const F = { NW: 0x1, N: 0x2, NE: 0x4, E: 0x8, SE: 0x10, S: 0x20, SW: 0x40, W: 0x80, FULL: 0x100 | 0x40000 | 0x200000 };
    WA.prototype.canTravelInDirection = function canTravelInDirection(wv, dx, dy, extraCondition = () => true) {
      dx = Math.sign(dx); dy = Math.sign(dy);
      if (dx === 0 && dy === 0) return true;
      const lp = rl.LocalPoint.fromWorld(client, this.x, this.y);
      if (!lp) return false;
      const width = this.width; const height = this.height; const plane = this.plane;
      const startX = lp.getSceneX() + dx; const startY = lp.getSceneY() + dy;
      const checkX = startX + (dx > 0 ? width - 1 : 0); const checkY = startY + (dy > 0 ? height - 1 : 0);
      const endX = startX + width - 1; const endY = startY + height - 1;
      let xFlags = F.FULL; let yFlags = F.FULL; let xyFlags = F.FULL;
      let xWallFlagsSouth = F.FULL; let xWallFlagsNorth = F.FULL; let yWallFlagsWest = F.FULL; let yWallFlagsEast = F.FULL;
      if (dx < 0) { xFlags |= F.E; xWallFlagsSouth |= F.S | F.SE; xWallFlagsNorth |= F.N | F.NE; }
      if (dx > 0) { xFlags |= F.W; xWallFlagsSouth |= F.S | F.SW; xWallFlagsNorth |= F.N | F.NW; }
      if (dy < 0) { yFlags |= F.N; yWallFlagsWest |= F.W | F.NW; yWallFlagsEast |= F.E | F.NE; }
      if (dy > 0) { yFlags |= F.S; yWallFlagsWest |= F.W | F.SW; yWallFlagsEast |= F.E | F.SE; }
      if (dx < 0 && dy < 0) xyFlags |= F.NE;
      if (dx < 0 && dy > 0) xyFlags |= F.SE;
      if (dx > 0 && dy < 0) xyFlags |= F.NW;
      if (dx > 0 && dy > 0) xyFlags |= F.SW;
      const collisionData = (wv || client).getCollisionMaps ? (wv || client).getCollisionMaps() : client.getCollisionMaps();
      if (collisionData == null) return false;
      const flags = collisionData[plane].getFlags();
      const at = (x, y) => (x < 0 || y < 0 || x >= 104 || y >= 104 ? F.FULL : flags[x][y] | 0);
      const fromScene = (x, y) => new WP(client.getBaseX() + x, client.getBaseY() + y, plane);
      if (dx !== 0) {
        for (let y = startY; y <= endY; y++) if ((at(checkX, y) & xFlags) !== 0 || !extraCondition(fromScene(checkX, y))) return false;
        for (let y = startY + 1; y <= endY; y++) if ((at(checkX, y) & xWallFlagsSouth) !== 0) return false;
        for (let y = endY - 1; y >= startY; y--) if ((at(checkX, y) & xWallFlagsNorth) !== 0) return false;
      }
      if (dy !== 0) {
        for (let x = startX; x <= endX; x++) if ((at(x, checkY) & yFlags) !== 0 || !extraCondition(fromScene(x, checkY))) return false;
        for (let x = startX + 1; x <= endX; x++) if ((at(x, checkY) & yWallFlagsWest) !== 0) return false;
        for (let x = endX - 1; x >= startX; x--) if ((at(x, checkY) & yWallFlagsEast) !== 0) return false;
      }
      if (dx !== 0 && dy !== 0) {
        if ((at(checkX, checkY) & xyFlags) !== 0 || !extraCondition(fromScene(checkX, checkY))) return false;
        // When the area's edge size is 1 and it travels diagonally, the x and y axes are checked as well
        if (width === 1 && (at(checkX, checkY - dy) & xFlags) !== 0 && extraCondition(fromScene(checkX, startY))) return false;
        if (height === 1 && (at(checkX - dx, checkY) & yFlags) !== 0 && extraCondition(fromScene(startX, checkY))) return false;
      }
      return true;
    };
    Object.assign(rl, { Direction, Angle });
  }

  // ---- batch 31 (Friend List, Friend Notes, Item Identification, Inventory Tags)
  const { Text, eventBus, InterfaceID, ScriptID } = rl;
  // Text.toJagexName: non-breaking spaces, underscores and hyphens to spaces, non-ASCII dropped, trimmed
  if (Text && !Text.toJagexName) {
    Text.toJagexName = (str) => String(str || '').replace(/[^\x00-\x7F ]/g, '').replace(/[ _-]/g, ' ').trim();
  }
  // the 2007 friends (550) and ignore (551) tabs: their titles are 550:2 / 551:2
  Object.assign(InterfaceID, { FRIENDS: 550, IGNORE: 551 });
  InterfaceID.Friends = Object.assign(InterfaceID.Friends || {}, { HEADER: (550 << 16) | 2, LIST: (550 << 16) | 1 });
  InterfaceID.Ignore = Object.assign(InterfaceID.Ignore || {}, { HEADER: (551 << 16) | 2, LIST: (551 << 16) | 1 });
  // OSRS's friends_update / ignore_update scripts: the 2007 tabs have no such script, so the core posts
  // ScriptPostFired FRIENDS_UPDATE / IGNORE_UPDATE when the list it reads changes (names or worlds), and at log in
  Object.assign(ScriptID, { FRIENDS_UPDATE: 631, IGNORE_UPDATE: 630 });
  // client.getIgnoreContainer (client hook `ignores`): NameableContainer<Ignore>
  const norm = (n) => String(n || '').replace(/ /g, ' ').toLowerCase();
  const container = (list) => ({ getMembers: () => list, getCount: () => list.length, findByName: (n) => list.find((f) => norm(f.getName()) === norm(n)) || null, getPendingLogins: () => [] });
  client.getIgnoreContainer = () => container((ll.api && ll.api.ignores ? ll.api.ignores() : []).map((f) => ({ getName: () => f.name, getPrevName: () => null })));
  client.isMembers = () => !!(ll.api && ll.api.members && ll.api.members());
  // ChatMessage.getMessageNode(): MessageNode getValue / setValue (the line's text, as the 2007 chat box draws it), getName, getType
  if (!eventBus.__messageNode) {
    eventBus.__messageNode = true;
    const post = eventBus.post.bind(eventBus);
    eventBus.post = (name, ev) => {
      if (name === 'ChatMessage' && ev && ev.msg && !ev.getMessageNode) {
        const msg = ev.msg;
        const node = {
          getValue: () => (typeof msg.replace === 'string' ? msg.replace : msg.text),
          setValue: (v) => { msg.replace = rl.toGameTags ? rl.toGameTags(v) : v; },
          getName: () => msg.name || '', getType: () => ev.getType(), getSender: () => msg.channel || null, getTimestamp: () => ev.getTimestamp(),
          getId: () => msg.id | 0, getCrown: () => msg.crown | 0, // (the 2007 crown on mod lines, for putting a line back)
        };
        ev.getMessageNode = () => node;
      }
      return post(name, ev);
    };
  }
  // ChatboxPanelManager titles with RuneLite tags (Friend Notes' "<name>'s Notes<br><col=0000aa>(Limit ...)"): the 2007
  // prompt has one title line, so <br> becomes a space and colours become the client's @col@ codes
  const cpm = rl.chatboxPanelManager;
  if (cpm && !cpm.__tags) {
    cpm.__tags = true;
    const show = cpm.show.bind(cpm);
    cpm.show = (lines) => show(lines && lines.map((l) => (typeof l === 'string' && /<(br|col)/.test(l) && rl.toGameTags ? rl.toGameTags(l.replace(/<br>/g, ' ')) : l)));
  }
  // ItemManager.getItemOutline(id, qty, color) (SpritePixels.toBufferedOutline: each transparent pixel next to an opaque
  // one, in the colour) and ImageUtil.fillImage(image, color) (every opaque pixel in the colour), on the client's item
  // icons ({ w, h, px } ARGB, what Graphics2D.drawImage takes); cached per item, quantity and colour
  const outlines = new Map();
  if (rl.itemManager && !rl.itemManager.getItemOutline) {
    rl.itemManager.getItemOutline = (itemId, qty, color) => {
      const icon = rl.itemManager.getImage(itemId, qty);
      if (!icon || !icon.px) return null;
      const key = `${itemId}:${qty}:${color.getRGB()}`;
      const hit = outlines.get(key);
      if (hit && hit.src === icon) return hit.img;
      const { w, h, px } = icon; const out = new Uint32Array(w * h); const argb = color.getRGB() | 0xff000000;
      const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (px[y * w + x] >>> 24) !== 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (opaque(x, y)) continue;
          if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) out[y * w + x] = argb;
        }
      }
      const img = { w, h, px: out };
      if (outlines.size > 64) outlines.delete(outlines.keys().next().value);
      outlines.set(key, { src: icon, img });
      return img;
    };
  }
  const ImageUtil = rl.ImageUtil || (rl.ImageUtil = {});
  if (!ImageUtil.fillImage) {
    ImageUtil.fillImage = (image, color) => {
      if (!image || !image.px) return image;
      const argb = ((color.getAlpha() << 24) | (color.getRGB() & 0xffffff)) >>> 0;
      const px = new Uint32Array(image.px.length);
      for (let i = 0; i < px.length; i++) if ((image.px[i] >>> 24) !== 0) px[i] = argb;
      return { w: image.w, h: image.h, px };
    };
  }
  // ---- batch 32 (Minimap): client.getMapDots / setMapDot (client hook mapDot: the client's minimap dot sprites,
  // display only), setMinimapZoom(enabled | level) / getMinimapZoom (client hook minimapZoom: pixels per tile, 4 = the
  // 2007 minimap). While zoom is enabled the wheel over the minimap (548:85) zooms it, 2-8 in steps of 0.5 (OSRS's
  // client limits; it doesn't reach the server: the 2007 minimap is drawn by the client).
  const dotCount = () => (ll.api && ll.api.mapDotCount ? ll.api.mapDotCount() : 0);
  client.getMapDots = () => { const n = dotCount(); return n ? new Array(n).fill(null) : null; };
  client.setMapDot = (i, sprite) => !!(ll.api && ll.api.mapDot && ll.api.mapDot(i, sprite ? sprite.px : null, sprite ? sprite.w : 0, sprite ? sprite.h : 0));
  let minimapZoomEnabled = false;
  client.setMinimapZoom = (v) => {
    if (typeof v === 'boolean') { minimapZoomEnabled = v; if (!v && ll.api && ll.api.minimapZoom) ll.api.minimapZoom(4); return; }
    if (ll.api && ll.api.minimapZoom && v > 0) ll.api.minimapZoom(Math.max(2, Math.min(8, Number(v))));
  };
  client.getMinimapZoom = () => (ll.api && ll.api.minimapZoom ? ll.api.minimapZoom() : 4);
  client.isMinimapZoom = () => minimapZoomEnabled;
  if (window.addEventListener && document.getElementById && !rl.__minimapWheel) {
    rl.__minimapWheel = true;
    window.addEventListener('wheel', (e) => {
      if (!minimapZoomEnabled || !ll.loggedIn || !e.deltaY) return;
      const cv = document.getElementById('canvas'); if (!cv || e.target !== cv) return;
      const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * 765 / r.width; const y = (e.clientY - r.top) * 503 / r.height;
      const c = ll.api && ll.api.com ? ll.api.com((548 << 16) | 85) : null;
      if (!c || !c.screen || c.hide || x < c.screen[0] || y < c.screen[1] || x >= c.screen[0] + c.width || y >= c.screen[1] + c.height) return;
      e.preventDefault(); e.stopImmediatePropagation();
      client.setMinimapZoom(client.getMinimapZoom() + (e.deltaY > 0 ? -0.5 : 0.5));
    }, { passive: false, capture: true });
  }
  // the friends / ignore lists polled each tick: ScriptPostFired FRIENDS_UPDATE / IGNORE_UPDATE on change, RemovedFriend
  let lastFriends = null; let lastIgnores = null;
  const sig = (c) => c.getMembers().map((f) => `${f.getName()}:${f.getWorld ? f.getWorld() : ''}`).join(',');
  eventBus.register({
    subscribePriority: 100,
    onGameStateChanged(e) { if (e.getGameState() !== 'LOGGED_IN') { lastFriends = null; lastIgnores = null; } },
    onGameTick() {
      const fc = client.getFriendContainer(); const ic = client.getIgnoreContainer();
      const f = sig(fc); const i = sig(ic);
      if (f !== lastFriends) {
        if (lastFriends) {
          const now = new Set(fc.getMembers().map((m) => norm(m.getName())));
          for (const n of lastFriends.split(',').filter(Boolean).map((s) => s.slice(0, s.lastIndexOf(':')))) {
            if (!now.has(norm(n))) eventBus.post('RemovedFriend', { getNameable: () => ({ getName: () => n, getPrevName: () => null }) });
          }
        }
        lastFriends = f; eventBus.post('ScriptPostFired', { getScriptId: () => ScriptID.FRIENDS_UPDATE });
      }
      if (i !== lastIgnores) { lastIgnores = i; eventBus.post('ScriptPostFired', { getScriptId: () => ScriptID.IGNORE_UPDATE }); }
    },
  });
})();
// ---- batch 33 (Chat History, Key Remapping, Music): client.getVarcStrValue / setVarcStrValue (client hook varcStr: the
// 2007 chatbox scripts keep the typed text in varc string 1, a PM's text in 22 and its target in 23; local input
// state, nothing is sent by itself); VarClientID.CHATINPUT / MESLAYERINPUT / FRIENDTOMESSAGE / MESLAYERMODE (varc 5, 6 =
// private message, as OSRS's InputType); client.addChatMessage(type, name, value, sender, postEvent): postEvent false
// puts the line back without a ChatMessage (client hook addChatQuiet); client.removeChatMessages(types): RuneLite's
// ChatLineBuffer.removeMessageNode for every line of those ChatMessageTypes (client hook removeChat, display only);
// AreaSoundEffectPlayed / SoundEffectPlayed with consume() (client hook ll.onSound: the 2007 client's seq / area sounds
// and the server's sound effects, consumed ones aren't played locally; the source is getSourceKind(): 'local' /
// 'player' / 'npc' / null, as our actors are snapshots); client.setAmbientSound(null) / restoreAmbientSound() (client
// hook ambientMute: the loc ambient sounds stop); KeyListener.keyTyped (keypress), consume() stops the game seeing it,
// and KeyEvent.setKeyCode(code) for keydown / keyup (the client reads the event's keyCode).
(() => {
  const ll = window.__lostlite;
  const rl = ll && ll.rl;
  if (!rl) return;
  const { client, eventBus, keyManager } = rl;
  const api = () => ll.api || {};
  const VarClientID = rl.VarClientID || (rl.VarClientID = {});
  Object.assign(VarClientID, { CHATINPUT: 1, MESLAYERINPUT: 22, FRIENDTOMESSAGE: 23, MESLAYERMODE: 5 });
  rl.InputType = rl.InputType || { NONE: 0, PRIVATE_MESSAGE: 6 };
  const getVarcInt = client.getVarcIntValue.bind(client);
  client.getVarcIntValue = (id) => (id === VarClientID.MESLAYERMODE ? (api().varc ? api().varc(id) | 0 : 0) : getVarcInt(id));
  client.getVarcStrValue = (id) => (api().varcStr ? api().varcStr(id) : null);
  client.setVarcStrValue = (id, v) => { if (api().varcStr) api().varcStr(id, v == null ? '' : String(v)); };
  const CODE = { GAMEMESSAGE: 0, CONSOLE: 0, WELCOME: 0, MODCHAT: 1, PUBLICCHAT: 2, PRIVATECHAT: 3, TRADEREQ: 4, LOGINLOGOUTNOTIFICATION: 5, PRIVATECHATOUT: 6,
    MODPRIVATECHAT: 7, CHALREQ_TRADE: 8, FRIENDSCHAT: 9, FRIENDSCHATNOTIFICATION: 11 };
  rl.chatTypeCode = (t) => (typeof t === 'number' ? t : t in CODE ? CODE[t] : -1);
  const addChat = client.addChatMessage.bind(client);
  client.addChatMessage = (type, name, value, sender, postEvent) => {
    if (postEvent !== false || !api().addChatQuiet) { addChat(type, name, value, sender); return null; }
    const code = rl.chatTypeCode(type);
    if (code < 0) return null;
    api().addChatQuiet(code, rl.toGameTags ? rl.toGameTags(String(value)) : String(value), String(name || ''), sender == null ? null : String(sender));
    return { setRuneLiteFormatMessage() {}, setTimestamp() {} };
  };
  client.removeChatMessages = (types) => {
    const codes = [...new Set(types.map((t) => rl.chatTypeCode(t)).filter((c) => c >= 0))];
    // (game messages share code 0 with console lines; RuneLite's GAME tab clears them all the same)
    return api().removeChat ? api().removeChat(codes) : 0;
  };
  // sounds
  ll.onSound = (kind, id, src, idx) => {
    let consumed = false;
    const local = src === 'local';
    const source = () => {
      if (local) return client.getLocalPlayer();
      if (src === 'npc') { const wv = client.getTopLevelWorldView && client.getTopLevelWorldView(); return wv && wv.npcs ? wv.npcs().byIndex(idx) : null; }
      if (src === 'player') return (client.getPlayers ? client.getPlayers() : []).find((p) => p && p.info && p.info.index === idx) || { isPlayer: true };
      return null;
    };
    const ev = { getSoundId: () => id, getSource: source, getSourceKind: () => src, consume() { consumed = true; }, isConsumed: () => consumed };
    eventBus.post(kind === 'area' ? 'AreaSoundEffectPlayed' : 'SoundEffectPlayed', ev);
    return !consumed;
  };
  client.setAmbientSound = (s) => { if (api().ambientMute) api().ambientMute(s == null); };
  client.restoreAmbientSound = () => { if (api().ambientMute) api().ambientMute(false); };
  // keys: keyTyped and setKeyCode / setKeyChar
  const typedListeners = new Set();
  if (keyManager && !keyManager.__typed) {
    keyManager.__typed = true;
    const reg = keyManager.registerKeyListener.bind(keyManager); const unreg = keyManager.unregisterKeyListener.bind(keyManager);
    keyManager.registerKeyListener = (l) => { reg(l); if (l.keyTyped) typedListeners.add(l); };
    keyManager.unregisterKeyListener = (l) => { unreg(l); typedListeners.delete(l); };
    window.addEventListener('keypress', (e) => {
      if (!typedListeners.size) return;
      let consumed = false;
      e.consume = () => { consumed = true; };
      for (const l of [...typedListeners]) { try { l.keyTyped(e); } catch { /* keep going */ } }
      if (consumed) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }
  // KeyEvent.setKeyCode / setKeyChar / getKeyCode / getKeyChar on every key event (the client reads keyCode and key)
  const KP = window.KeyboardEvent && window.KeyboardEvent.prototype;
  if (KP && !KP.setKeyCode) {
    KP.getKeyCode = function getKeyCode() { return this.keyCode; };
    KP.getKeyChar = function getKeyChar() { return this.__noChar ? null : this.key && this.key.length === 1 ? this.key : null; };
    KP.setKeyCode = function setKeyCode(c) {
      Object.defineProperty(this, 'keyCode', { value: c, configurable: true });
      Object.defineProperty(this, 'which', { value: c, configurable: true });
      if (KEY_NAMES[c]) Object.defineProperty(this, 'key', { value: KEY_NAMES[c], configurable: true });
    };
    KP.setKeyChar = function setKeyChar(ch) { this.__noChar = ch == null; };
  }
  const KEY_NAMES = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 17: 'Control', 27: 'Escape', 32: ' ', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown',
    112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12' };
  rl.KeyEvent = Object.assign(rl.KeyEvent || {}, { VK_UNDEFINED: 0, VK_ENTER: 13, VK_BACK_SPACE: 8, VK_TAB: 9, VK_CONTROL: 17, VK_ESCAPE: 27, VK_SPACE: 32,
    VK_LEFT: 37, VK_UP: 38, VK_RIGHT: 39, VK_DOWN: 40, VK_SLASH: 191, VK_COLON: 513, VK_F1: 112, VK_F2: 113, VK_F3: 114, VK_F4: 115, VK_F5: 116, VK_F6: 117,
    VK_F7: 118, VK_F8: 119, VK_F9: 120, VK_F10: 121, VK_F11: 122, VK_F12: 123, CHAR_UNDEFINED: null });
  // ModifierlessKeybind.matches: the key alone, whatever modifiers are held (the config's "W" / "1" / "-" / "Escape" text)
  const CODE_KEYS = { Minus: '-', Equal: '=', Space: 'Space', Slash: '/', Backquote: '`', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Backslash: '\\' };
  rl.ModifierlessKeybind = {
    matches(bind, e) {
      if (!bind || !e) return false;
      const key = String(bind).split('+').pop();
      if (key === 'UNDEFINED' || key === '') return false;
      let k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.code && CODE_KEYS[e.code] ? CODE_KEYS[e.code] : null;
      if (!k) k = e.key === ' ' ? 'Space' : e.key && e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === 'Ctrl') return e.key === 'Control';
      return k === key;
    },
  };
  // ---- ModelOutlineRenderer
  {
    let mask = null; let out = null;
    const canvasOf = (c, w, h) => {
      if (!c && typeof document !== 'undefined' && document.createElement) c = document.createElement('canvas');
      if (c && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
      return c;
    };
    const tagOf = (target, item) => {
      if (item !== undefined) {
        // ItemLayer: the obj stack's scene tag (x + (z << 7) + 0x60000000, the 2007 client's)
        const lp = target && target.getLocalLocation && target.getLocalLocation();
        return lp ? BigInt(0x60000000 + lp.getSceneX() + (lp.getSceneY() << 7)) : null;
      }
      if (target && target.info && target.info.typecode != null) return target.info.typecode;
      if (target && target.tag != null) return target.tag;
      return null;
    };
    const draw = (target, item, outlineWidth, color, feather) => {
      const gfx = rl._test && rl._test.R && rl._test.R.gfx;
      const frame = rl._test && rl._test.getFrame && rl._test.getFrame();
      const tag = tagOf(target, item);
      if (!gfx || !frame || tag == null || !color) return;
      const mesh = frame.mesh ? frame.mesh(tag) : null;
      const ctx = gfx.ctx;
      // no triangles until the frame after the first ask (as the hulls)
      if (!mesh || !mesh.length || !ctx || typeof ctx.getTransform !== 'function') return;
      const T = ctx.getTransform();
      const s = Math.hypot(T.a, T.b) || 1;
      const vx = client.getViewportXOffset() + gfx.tx; const vy = client.getViewportYOffset() + gfx.ty;
      let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
      for (let i = 0; i < mesh.length; i += 2) {
        const x = mesh[i] + vx; const y = mesh[i + 1] + vy;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const r = Math.max(1, outlineWidth) * s; const f = Math.max(0, feather | 0) * s;
      const pad = Math.ceil(r + f + 2);
      const dx0 = Math.floor(x0 * T.a + T.e) - pad; const dy0 = Math.floor(y0 * T.d + T.f) - pad;
      const w = Math.min(4096, Math.ceil((x1 - x0) * T.a) + pad * 2); const h = Math.min(4096, Math.ceil((y1 - y0) * T.d) + pad * 2);
      if (w <= 0 || h <= 0) return;
      mask = canvasOf(mask, w, h); out = canvasOf(out, w, h);
      if (!mask || !out) return;
      const m = mask.getContext('2d'); const o = out.getContext('2d');
      m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, w, h);
      m.setTransform(T.a, 0, 0, T.d, T.e - dx0, T.f - dy0);
      m.beginPath();
      for (let i = 0; i < mesh.length; i += 6) {
        const ax = mesh[i] + vx; const ay = mesh[i + 1] + vy;
        let bx = mesh[i + 2] + vx; let by = mesh[i + 3] + vy; let cx = mesh[i + 4] + vx; let cy = mesh[i + 5] + vy;
        // one winding for every triangle, so the nonzero fill is their union
        if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) { const tx = bx; const ty = by; bx = cx; by = cy; cx = tx; cy = ty; }
        m.moveTo(ax, ay); m.lineTo(bx, by); m.lineTo(cx, cy); m.closePath();
      }
      m.fillStyle = '#fff'; m.fill('nonzero');
      // grow by the width: the mask drawn around a circle of radius r (and r / 2), then coloured, then the inside cut out
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, w, h);
      for (const rr of r > 2 ? [r, r / 2] : [r]) {
        const n = Math.max(8, Math.ceil(rr * 6));
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; o.drawImage(mask, Math.cos(a) * rr, Math.sin(a) * rr); }
      }
      o.globalCompositeOperation = 'source-in'; o.fillStyle = color.css ? color.css() : String(color); o.fillRect(0, 0, w, h);
      o.globalCompositeOperation = 'destination-out'; o.drawImage(mask, 0, 0);
      o.globalCompositeOperation = 'source-over';
      ctx.save();
      // the overlay's clip (the viewport, minus the open interfaces it is drawn under), as the core's Graphics2D
      if (gfx.clip || gfx.clipHoles) {
        const cr = gfx.clip || { x: 0, y: 0, width: 4096, height: 4096 };
        ctx.beginPath(); ctx.rect(cr.x, cr.y, cr.width, cr.height);
        for (const hr of gfx.clipHoles || []) ctx.rect(hr.x, hr.y, hr.width, hr.height);
        ctx.clip(gfx.clipHoles ? 'evenodd' : 'nonzero');
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (f > 0) ctx.filter = `blur(${(f / 2).toFixed(1)}px)`;
      ctx.drawImage(out, dx0, dy0);
      ctx.restore();
    };
    rl.modelOutlineRenderer = {
      /** drawOutline(NPC | Player | TileObject, width, color, feather) or drawOutline(ItemLayer, TileItem, width, color, feather) */
      drawOutline(target, a, b, c, d) {
        if (d !== undefined && typeof a === 'object' && a !== null && typeof a.getId === 'function') draw(target, a, b, c, d);
        else draw(target, undefined, a, b, c);
      },
    };
  }
  // ---- open menu box; item layers by scene square
  {
    const menuField = (k) => { const c = ll.client; const f = ll.fields || {}; return c && f[k] ? c[f[k]] | 0 : 0; };
    client.getMenuX = () => menuField('menuX');
    client.getMenuY = () => menuField('menuY');
    client.getMenuWidth = () => menuField('menuWidth');
    client.getMenuHeight = () => menuField('menuHeight');
    rl.itemLayerAt = (sx, sy) => {
      const frame = rl._test && rl._test.getFrame && rl._test.getFrame();
      const list = frame && frame.groundItems ? frame.groundItems(sx, sy) : null;
      if (!list || !list.length) return null;
      const lp = rl.LocalPoint.fromScene(sx, sy);
      const nodes = list.map((o) => ({ getId: () => o.id, getQuantity: () => o.count, getNext: () => null }));
      nodes.forEach((n, i) => { n.getNext = () => nodes[i + 1] || null; n.equals = (t) => !!t && t.getId() === n.getId() && t.__layer === layer; n.__layer = null; });
      const layer = { getTop: () => nodes[0], getLocalLocation: () => lp, getPlane: () => client.getPlane(),
        getCanvasTilePoly: () => rl.Perspective.getCanvasTilePoly(client, lp), getWorldLocation: () => rl.WorldPoint.fromLocal(client, lp), sceneX: sx, sceneY: sy };
      nodes.forEach((n) => { n.__layer = layer; });
      return layer;
    };
  }
  // ---- friends chat channel info, one chat line, script-made children
  {
    const api = () => ll.api || {};
    const fcm = client.getFriendsChatManager.bind(client);
    client.getFriendsChatManager = () => {
      const m = fcm();
      if (!m) return null;
      const info = api().friendsChatInfo ? api().friendsChatInfo() : null;
      const screen = (n) => (n == null ? null : String(n).replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase()));
      return Object.assign(m, {
        getName: () => (info ? screen(info.name) : null), getOwner: () => (info ? screen(info.owner) : null), getSize: () => 100,
        getKickRank: () => rl.FriendsChatRank.valueOf(info ? info.minKick : -1), getMyRank: () => rl.FriendsChatRank.valueOf(info ? info.myRank : -1),
      });
    };
    client.removeChatMessage = (type, text) => {
      const code = rl.chatTypeCode ? rl.chatTypeCode(type) : 0;
      return api().removeChat ? api().removeChat([code < 0 ? 0 : code], String(text)) : 0;
    };
    rl.widgetChildren = (packed) => {
      const list = api().comChildren ? api().comChildren(packed) : null;
      if (!list) return null;
      return list.map((c, i) => (c == null ? null : {
        getIndex: () => i, getId: () => packed, getText: () => c.text || '', getTextColor: () => c.colour | 0, getType: () => c.type,
        setText: (t) => { api().setChildText(packed, i, String(t)); c.text = String(t); },
        setTextColor: (rgb) => { api().setChildColour(packed, i, rgb | 0); c.colour = rgb | 0; },
      }));
    };
  }
})();
