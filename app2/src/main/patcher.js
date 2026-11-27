'use strict';
// Adds LostLite's hooks to the live Lost City client bundle as it is downloaded.
//
// The live client.js is obfuscated and every world/build uses different member names
// (w2 calls its stream 'xF', w3 'tF', ...), so nothing is hard-coded. Instead we find
// code by shape, the same technique RuneLite's deobfuscator relies on: strings and
// control flow survive obfuscation even when names don't.
//
//  - The packet reader is the async no-argument method that contains ':tradereq:'.
//    The client calls it many times per frame while connected, so a hook at its first
//    statement captures the live Client instance at login and doubles as a heartbeat
//    (it stops being called when you log out).
//  - Stat arrays come from the stat-update handler: three array writes followed by the
//    98-iteration level loop (statXP, statEffectiveLevel, statBaseLevel).
//  - Camera distance: the follow camera is placed at distance pitch * 3 + 600, passed as
//    the last argument of the camera call. Multiplying it gives scroll-wheel zoom, which
//    the 2004 client never had.

const HOOK = 'window.__lostlite&&window.__lostlite.tick(this);';

function findReadMethod(src) {
  const anchor = src.indexOf("':tradereq:'");
  if (anchor < 0) throw new Error("anchor ':tradereq:' not found");
  const re = /async\['([\w$]+)'\]\(\)\{/g;
  let best = null;
  let m;
  while ((m = re.exec(src)) && m.index < anchor) best = m;
  if (!best) throw new Error('packet reader method not found');
  const bodyStart = best.index + best[0].length;
  const head = src.slice(bodyStart, bodyStart + 200);
  if (!head.includes("['available']")) throw new Error('packet reader shape mismatch');
  return { name: best[1], insertAt: bodyStart };
}

function findFields(src) {
  const f = {};
  // Follow camera: pitch starts from orbitCameraPitch, yaw is orbitCameraYaw + offset.
  const cam = /let ([\w$]+)=this\['([\w$]+)'\];\(this\['[\w$]+'\]\/0x100\|0x0\)>\1&&[^;]*;let [\w$]+=this\['([\w$]+)'\]\+this\['[\w$]+'\]&0x7ff;/.exec(src);
  if (cam) {
    f.cameraPitch = cam[2];
    f.cameraYaw = cam[3];
  }
  const stat = /this\['([\w$]+)'\]\[([\w$]+)\]=([\w$]+),this\['([\w$]+)'\]\[\2\]=([\w$]+),this\['([\w$]+)'\]\[\2\]=0x1;for\(let ([\w$]+)=0x0;\7<0x62;/.exec(src);
  if (stat) {
    f.statXP = stat[1];
    f.statEffectiveLevel = stat[4];
    f.statBaseLevel = stat[6];
  }
  return f;
}

// ------------------------------------------------------------------ draw distance
//
// The 2004 scene renderer (World class) draws tiles within 25 of the camera, using
// visibility tables sized for that radius, and drops models further than 3500 units in
// front of the camera. The class is found by its visibility pre-calculation (pitch 128 to
// 384 in steps of 32), and inside it every radius-derived constant is rewritten:
//   25 -> R, 26 -> R + 1, 51 -> 2R + 1, 53 -> 2R + 3, and the occluder bounds 50 -> 2R.
// The counts are checked against the open-source client; any mismatch leaves the client
// untouched. The far clip becomes window.__lostlite.far so zooming out can push it back,
// and the visibility pre-calculation reports itself so it can be re-run for the zoom.

function hex(n) {
  return '0x' + n.toString(16);
}

function classBounds(src, at) {
  const start = src.lastIndexOf('class ', at);
  if (start < 0) return null;
  let depth = 0;
  for (let k = src.indexOf('{', start); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return { start, end: k + 1 };
  }
  return null;
}

function countAll(text, re) {
  return (text.match(re) || []).length;
}

function patchDrawDistance(src, radius) {
  const fail = (reason) => ({ code: src, ok: false, reason });
  const loop = /for\(let ([\w$]+)=0x80;\1<=0x180;\1\+=0x20\)/.exec(src);
  if (!loop) return fail('visibility pre-calculation not found');
  const b = classBounds(src, loop.index);
  if (!b) return fail('World class not found');
  let body = src.slice(b.start, b.end);

  // The method holding the loop, e.g. static['Qq'](Y0,Y1,Y2,Y3,Y4){
  const rel = loop.index - b.start;
  const methods = [...body.slice(0, rel).matchAll(/static\s*\['([\w$]+)'\]\(([\w$]+),[\w$]+,[\w$]+,[\w$]+,[\w$]+\)\{/g)];
  const visMethod = methods[methods.length - 1];
  if (!visMethod) return fail('visibility method not found');

  const expect = {
    r25: [/(?<![\w$])0x19(?![0-9a-f])/g, 36],
    r26: [/(?<![\w$])0x1a(?![0-9a-f])/g, 4],
    r51: [/(?<![\w$])0x33(?![0-9a-f])/g, 2],
    r53: [/(?<![\w$])0x35(?![0-9a-f])/g, 2],
    occA: [/(>=0x0&&[\w$]+<=)0x32\)/g, 2],
    occB: [/([\w$]+)>0x32&&\(\1=0x32\)/g, 4],
    far: [/([\w$]+>)0xdac\)return!0x1;/g, 1],
  };
  for (const [name, [re, n]] of Object.entries(expect)) {
    const got = countAll(body, re);
    if (got !== n) return fail(`${name}: found ${got}, expected ${n}`);
  }
  const modelFar = /(\|\|[\w$]+>=)0xdac\)return;/g;
  const outside = src.slice(0, b.start) + src.slice(b.end);
  if (countAll(outside, modelFar) !== 1) return fail(`model far clip found ${countAll(outside, modelFar)} times`);

  const R = Math.round(radius);
  if (R !== 25) {
    // Occluder bounds first (they contain 0x32, which none of the replacements below
    // match), then all radius constants in ONE pass: replacing them one after another
    // would re-replace values that a previous step produced (at R = 50, R + 1 = 0x33).
    body = body
      .replace(expect.occA[0], `$1${hex(2 * R)})`)
      .replace(expect.occB[0], `$1>${hex(2 * R)}&&($1=${hex(2 * R)})`);
    const map = { '0x19': R, '0x1a': R + 1, '0x33': 2 * R + 1, '0x35': 2 * R + 3 };
    body = body.replace(/(?<![\w$])0x(?:19|1a|33|35)(?![0-9a-f])/g, (t) => hex(map[t]));
  }
  body = body.replace(expect.far[0], '$1window.__lostlite.far)return!0x1;');
  // Let the runtime see the visibility method (static, so `this` is the World class).
  const name = visMethod[1].replace(/\$/g, '\\$');
  const sig = new RegExp(`(static\\s*\\['${name}'\\]\\([^)]*\\)\\{)`);
  body = body.replace(sig, `$1window.__lostlite&&window.__lostlite.visCalc(this,'${visMethod[1]}',arguments);`);

  let code = src.slice(0, b.start) + body + src.slice(b.end);
  code = code.replace(modelFar, '$1window.__lostlite.far)return;');
  return { code, ok: true, radius: R };
}

// ------------------------------------------------------------------ menu
//
// buildMinimenu() rebuilds the right-click menu every frame and finishes with a bubble
// sort that keeps priority actions (< 1000) above deprioritised ones (> 1000). Its swap
// code names all five parallel menu arrays and the entry count, so we read the field
// names from it and call window.__lostlite.menuBuilt(this) right after it - the same
// point RuneLite's menu swapper works at. The top entry (index count - 1) is what a
// left click does.

const MENU_SORT = new RegExp(
  "let ([\\w$]+)=!0x1;for\\(;!\\1;\\)\\{\\1=!0x0;for\\(let ([\\w$]+)=0x0;\\2<this\\['([\\w$]+)'\\]-0x1;\\2\\+\\+\\)"
  + "if\\(this\\['([\\w$]+)'\\]\\[\\2\\]<0x3e8&&this\\['\\4'\\]\\[\\2\\+0x1\\]>0x3e8\\)\\{"
  + "(?:let [\\w$]+=this\\['([\\w$]+)'\\]\\[\\2\\];[^{}]*?)"
  + "\\1=!0x1;\\}\\}",
  'g',
);

function patchMenu(src) {
  const matches = [...src.matchAll(MENU_SORT)];
  if (matches.length !== 1) return { code: src, ok: false, reason: `menu sort found ${matches.length} times (expected 1)` };
  const m = matches[0];
  // The swap body names every menu array in order: option, action, paramB, paramC, paramA.
  const arrays = [...m[0].matchAll(/let [\w$]+=this\['([\w$]+)'\]\[/g)].map((x) => x[1]);
  if (arrays.length !== 5 || arrays[1] !== m[4]) return { code: src, ok: false, reason: `menu arrays: found ${arrays.length}` };
  const fields = {
    menuCount: m[3],
    menuOption: arrays[0],
    menuAction: arrays[1],
    menuParamB: arrays[2],
    menuParamC: arrays[3],
    menuParamA: arrays[4],
  };
  const end = m.index + m[0].length;
  let code = src.slice(0, end) + 'window.__lostlite&&window.__lostlite.menuBuilt(this);' + src.slice(end);

  // doAction(index): a left click runs it on the top entry ("count > 0 && doAction(count - 1)").
  // A hook at its start lets entries LostLite added run LostLite's own handler instead.
  const esc = (x) => x.replace(/\$/g, '\\$');
  const call = new RegExp(`this\\['${esc(fields.menuCount)}'\\]>0x0&&this\\['([\\w$]+)'\\]\\(this\\['${esc(fields.menuCount)}'\\]-0x1\\)`).exec(code);
  if (!call) return { code: src, ok: false, reason: 'menu action method not found' };
  const def = new RegExp(`\\['${esc(call[1])}'\\]\\(([\\w$]+)\\)\\{(?=if\\(\\1<0x0\\)return;)`, 'g');
  const defs = [...code.matchAll(def)];
  if (defs.length !== 1) return { code: src, ok: false, reason: `menu action method found ${defs.length} times` };
  const d = defs[0];
  fields.doAction = call[1];
  const at = d.index + d[0].length;
  code = code.slice(0, at) + `if(window.__lostlite&&window.__lostlite.menuClick(this,${d[1]}))return;` + code.slice(at);

  // Where the open menu is (for hover sub-menus): the open-menu click code reads the menu's
  // x, y and width and the mouse position, then subtracts the area offset (viewport 4,4;
  // side panel 553,205; chatbox 17,357) chosen by the menu area field.
  const geo = new RegExp(
    "this\\['([\\w$]+)'\\]\\)if\\(0x1===[\\w$]+\\)\\{let [\\w$]+=this\\['([\\w$]+)'\\],[\\w$]+=this\\['([\\w$]+)'\\],[\\w$]+=this\\['([\\w$]+)'\\],"
    + "[\\w$]+=this\\['([\\w$]+)'\\],[\\w$]+=this\\['([\\w$]+)'\\];0x0===this\\['([\\w$]+)'\\]\\?\\([\\w$]+-=0x4,[\\w$]+-=0x4\\)"
    + ":0x1===this\\['\\7'\\]\\?\\([\\w$]+-=0x229,[\\w$]+-=0xcd\\):0x2===this\\['\\7'\\]&&\\([\\w$]+-=0x11,[\\w$]+-=0x165\\);",
    'g',
  );
  const g = [...code.matchAll(geo)];
  if (g.length === 1) {
    const [, open, x, y, w, mx, my, area] = g[0];
    Object.assign(fields, { menuOpen: open, menuX: x, menuY: y, menuWidth: w, mouseX: mx, mouseY: my, menuArea: area });
  }
  return { code, ok: true, fields, hover: g.length === 1 };
}

// ------------------------------------------------------------------ login screen
//
// The title screen is drawn every frame by an async method that draws "Welcome to
// RuneScape" (screen 0) and the login box (screen 2) with "Username: " + user and
// "Password: " + stars. From it we read the screen-state, username and password field
// names, call window.__lostlite.title(this) at its start (so LostLite can fill in a
// remembered username/password before you've logged in), and let "Hide username" show
// asterisks instead of the name.

function patchLogin(src) {
  const fail = (reason) => ({ code: src, ok: false, reason });
  const anchor = src.indexOf("'Welcome\\x20to\\x20RuneScape'");
  if (anchor < 0) return fail('title screen not found');
  const re = /async\['([\w$]+)'\]\(\)\{/g;
  let best = null;
  let m;
  while ((m = re.exec(src)) && m.index < anchor) best = m;
  if (!best) return fail('title draw method not found');
  const body = src.slice(best.index, anchor);
  const screen = /if\(0x0===this\['([\w$]+)'\]\)\{[^{}]*$/.exec(body);
  const user = /'Username:\\x20'\+this\['([\w$]+)'\]/.exec(src.slice(anchor, anchor + 3000));
  const pass = /'Password:\\x20'\+[\w$]+\['[\w$]+'\]\(this\['([\w$]+)'\]\)/.exec(src.slice(anchor, anchor + 3000));
  if (!screen || !user || !pass) return fail('login fields not found');
  const fields = { loginScreen: screen[1], loginUser: user[1], loginPass: pass[1] };

  const at = best.index + best[0].length;
  let code = src.slice(0, at) + 'window.__lostlite&&window.__lostlite.title(this);' + src.slice(at);
  const draw = `'Username:\\x20'+this['${user[1]}']`;
  const i = code.indexOf(draw, at);
  if (i < 0) return fail('username drawing not found');
  const masked = `'Username:\\x20'+(window.__lostlite&&window.__lostlite.hideUser?'*'.repeat(this['${user[1]}'].length):this['${user[1]}'])`;
  code = code.slice(0, i) + masked + code.slice(i + draw.length);
  return { code, ok: true, fields };
}

// ------------------------------------------------------------------ bank (interfaces and items)
//
// Bank search needs: the open main interface, the interface list, an inventory
// component's item ids and counts, item names, the drag flags and a layer's scroll
// position. All are read from code shapes:
//  - buildMinimenu: "mainModal === -1 ? addWorldOptions() : addComponentOptions(
//    IfType.list[mainModal], mouseX, mouseY, 4, 4, 0)"
//  - its inventory branch: "!com.linkObjType || com.linkObjType[slot] <= 0 -> skip;
//    obj = ObjType.get(com.linkObjType[slot] - 1)" and "'Use ... with @lre@' + obj.name"
//  - IfType.swapSlots(a, b) checks linkObjType and linkObjNumber
//  - the drag start: "if (com.objSwap || com.objReplace)"
//  - nested layers draw with their scroll position: "draw(child, ..., child.scrollPosition)"
// The interface list and item lookup are module-level names, so they're exposed to the
// runtime through small functions added after the runtime (they're only called later).

function patchBank(src) {
  const fail = (reason) => ({ ok: false, reason });
  const f = {};
  let m = /\(-0x1===this\['([\w$]+)'\]\?this\['[\w$]+'\]\(\):this\['[\w$]+'\]\(([\w$]+)\['([\w$]+)'\]\[this\['\1'\]\],this\['[\w$]+'\],this\['[\w$]+'\],0x4,0x4,0x0\)\)/.exec(src);
  if (!m) return fail('main interface not found');
  f.mainModal = m[1];
  const ifHolder = m[2];
  const ifList = m[3];
  m = /!([\w$]+)\['([\w$]+)'\]\|\|\1\['\2'\]\[([\w$]+)\]<=0x0\)\{\3\+\+;continue;\}let ([\w$]+)=([\w$]+)\['([\w$]+)'\]\(\1\['\2'\]\[\3\]-0x1\);/.exec(src);
  if (!m) return fail('inventory slots not found');
  f.invObj = m[2];
  const objHolder = m[5];
  const objGet = m[6];
  const name = new RegExp(`'\\\\x20with\\\\x20@lre@'\\+${m[4].replace(/\$/g, '\\$')}\\['([\\w$]+)'\\]`).exec(src.slice(m.index, m.index + 2000));
  if (!name) return fail('item name not found');
  f.objName = name[1];
  m = new RegExp(`\\['[\\w$]+'\\]\\([\\w$]+,[\\w$]+\\)\\{if\\(!this\\['${f.invObj}'\\]\\|\\|!this\\['([\\w$]+)'\\]\\)return;`).exec(src);
  if (!m) return fail('item counts not found');
  f.invCount = m[1];
  m = /if\(([\w$]+)\['([\w$]+)'\]\|\|\1\['([\w$]+)'\]\)return this\['[\w$]+'\]=!0x1,/.exec(src);
  if (!m) return fail('drag flags not found');
  f.objSwap = m[2];
  f.objReplace = m[3];
  m = /this\['[\w$]+'\]\(([\w$]+),[\w$]+,[\w$]+,[\w$]+,[\w$]+,\1\['([\w$]+)'\]\),\1\['[\w$]+'\]>\1\['[\w$]+'\]&&/.exec(src);
  if (!m) return fail('scroll position not found');
  f.scrollPos = m[2];
  const api = `window.__lostlite&&window.__lostlite.setApi({ifList:()=>${ifHolder}['${ifList}'],obj:(id)=>${objHolder}['${objGet}'](id)});`;
  return { ok: true, fields: f, api };
}

// ------------------------------------------------------------------ chatbox prompt and closing interfaces
//
// drawChat starts "if (socialInputOpen) centreString(header, 239, 40, BLACK),
// centreString(input + '*', 239, 60, DARKBLUE) else if (dialogInputOpen) ... 'Enter amount:'".
// A branch is added in front of it that draws window.__lostlite.chatPrompt ([line1, line2])
// the same way, so plugin prompts (bank search) are drawn by the game itself on the real
// chatbox background, exactly like the game's own "Enter amount:" prompt.
// closeModal is "out.p1Enc(CLOSE_MODAL); if (sideModal != -1) {...}; if (chatModal != -1)
// { chatModal = -1; redrawChat = true; ... } mainModal = -1" - the Close Window button.

const CHAT_PROMPT = /,this\['([\w$]+)'\]\)(this\['([\w$]+)'\]\?\.\['([\w$]+)'\])\(this\['[\w$]+'\],0xef,0x28,0x0\),\2\(this\['[\w$]+'\]\+'\*',0xef,0x3c,0x80\);else if\(this\['([\w$]+)'\]\)\2\('Enter\\x20amount:'/g;
const CLOSE_MODAL = /\['([\w$]+)'\]\(\)\{this\['[\w$]+'\]\['[\w$]+'\]\(0x[0-9a-f]+\),-0x1!==this\['([\w$]+)'\]&&\(this\['\2'\]=-0x1,this\['[\w$]+'\]=!0x0,this\['[\w$]+'\]=!0x1,this\['[\w$]+'\]=!0x0\),-0x1!==this\['([\w$]+)'\]&&\(this\['\3'\]=-0x1,this\['([\w$]+)'\]=!0x0,this\['[\w$]+'\]=!0x1\),this\['([\w$]+)'\]=-0x1;\}/g;

function patchChat(src) {
  const fail = (reason) => ({ code: src, ok: false, reason });
  const prompts = [...src.matchAll(CHAT_PROMPT)];
  if (prompts.length !== 1) return fail(`chat prompt found ${prompts.length} times (expected 1)`);
  const closes = [...src.matchAll(CLOSE_MODAL)];
  if (closes.length !== 1) return fail(`close interface found ${closes.length} times (expected 1)`);
  const p = prompts[0];
  const c = closes[0];
  const fields = {
    socialInputOpen: p[1],
    dialogInputOpen: p[5],
    closeModal: c[1],
    sideModal: c[2],
    chatModal: c[3],
    redrawChat: c[4],
  };
  const P = 'window.__lostlite.chatPrompt';
  const draw = `,window.__lostlite&&${P})${p[2]}(${P}[0],0xef,0x28,0x0),${p[2]}(${P}[1],0xef,0x3c,0x80);else if(this['${p[1]}'])`;
  const code = src.slice(0, p.index) + draw + src.slice(p.index + `,this['${p[1]}'])`.length);
  return { code, ok: true, fields };
}

// ------------------------------------------------------------------ local player and game state
//
// Fields only (no code is changed). Found from:
//  - the local player update, op 3: "minusedlevel = gBit(2); x = gBit(7); z = gBit(7);
//    jump = gBit(1); localPlayer?.teleport(jump === 1, x, z)"
//  - teleport itself: it clears a primary anim that aborts on move, then sets
//    "x = 128 * routeX[0] + 64 * size, z = 128 * routeZ[0] + 64 * size"
//  - hitmarks: "addHitmark(loopCycle, type, damage); combatCycle = loopCycle + 400;
//    health = g1(); totalHealth = g1()"
//  - face entity: "faceEntity = g2(); if (faceEntity === 65535) faceEntity = -1"
//  - player appearance: "name = toScreenName(toRawUsername(g8())); combatLevel = g1();
//    skillLevel = g2(); ready = true"
//  - rebuild map: "baseX = 8 * (centreZoneX - 6), baseZ = 8 * (centreZoneZ - 6)"
//  - run energy and weight: the two packets that redraw the side panel on tab 12 and read
//    one value; energy is read with g1 (the same reader as health), weight with g2b
//  - varps: "varServ[id] = value; if (var[id] !== value) { var[id] = value; clientVar(id) ..."

function patchPlayer(src) {
  const fail = (reason) => ({ ok: false, reason });
  const f = {};
  const id = '[\\w$]+';
  let m = /else if\(0x3===[\w$]+\)\{this\['([\w$]+)'\]=([\w$]+)\['[\w$]+'\]\(0x2\);let [\w$]+=\2\['[\w$]+'\]\(0x7\),[\w$]+=\2\['[\w$]+'\]\(0x7\),[\w$]+=\2\['[\w$]+'\]\(0x1\);this\['([\w$]+)'\]\?\.\['([\w$]+)'\]\(/.exec(src);
  if (!m) return fail('local player not found');
  f.level = m[1];
  f.localPlayer = m[3];
  const teleport = m[4];
  m = new RegExp(`\\['${teleport.replace(/\$/g, '\\$')}'\\]\\(${id},${id},${id}\\)\\{if\\(-0x1!==this\\['(${id})'\\]&&`).exec(src);
  if (!m) return fail('teleport not found');
  f.primaryAnim = m[1];
  const body = src.slice(m.index, m.index + 1200);
  const pos = /this\['([\w$]+)'\]=0x80\*this\['([\w$]+)'\]\[0x0\]\+0x40\*this\['([\w$]+)'\],this\['([\w$]+)'\]=0x80\*this\['([\w$]+)'\]\[0x0\]\+0x40\*this\['\3'\]/.exec(body);
  if (!pos) return fail('entity position not found');
  f.entityX = pos[1];
  f.routeX = pos[2];
  f.entitySize = pos[3];
  f.entityZ = pos[4];
  f.routeZ = pos[5];
  m = /\['[\w$]+'\]\(([\w$]+)\['([\w$]+)'\],[\w$]+,[\w$]+\),([\w$]+)\['([\w$]+)'\]=\1\['\2'\]\+0x190,\3\['([\w$]+)'\]=[\w$]+\['([\w$]+)'\]\(\),\3\['([\w$]+)'\]=/.exec(src);
  if (!m) return fail('health not found');
  const loopHolder = m[1];
  const loopCycle = m[2];
  f.combatCycle = m[4];
  f.health = m[5];
  f.totalHealth = m[7];
  const g1 = m[6];
  m = /if\(0x4&[\w$]+&&\(([\w$]+)\['([\w$]+)'\]=[\w$]+\['[\w$]+'\]\(\),0xffff===\1\['\2'\]&&\(\1\['\2'\]=-0x1\)\)/.exec(src);
  if (!m) return fail('combat target not found');
  f.faceEntity = m[2];
  m = /this\['([\w$]+)'\]=[\w$]+\['[\w$]+'\]\([\w$]+\['[\w$]+'\]\([\w$]+\['[\w$]+'\]\(\)\)\),this\['([\w$]+)'\]=[\w$]+\['[\w$]+'\]\(\),this\['[\w$]+'\]=[\w$]+\['[\w$]+'\]\(\),this\['[\w$]+'\]=!0x0/.exec(src);
  if (!m) return fail('player name not found');
  f.playerName = m[1];
  f.combatLevel = m[2];
  m = /this\['([\w$]+)'\]=0x8\*\(this\['[\w$]+'\]-0x6\),this\['([\w$]+)'\]=0x8\*\(this\['[\w$]+'\]-0x6\),/.exec(src);
  if (!m) return fail('map base not found');
  f.baseX = m[1];
  f.baseZ = m[2];
  const reads = [...src.matchAll(/0xc===this\['[\w$]+'\]&&\(this\['[\w$]+'\]=!0x0\),this\['([\w$]+)'\]=this\['[\w$]+'\]\['([\w$]+)'\]\(\),this\['[\w$]+'\]=-0x1,!0x0;/g)];
  if (reads.length !== 2) return fail(`run energy/weight found ${reads.length} times (expected 2)`);
  const energy = reads.find((r) => r[2] === g1);
  const weight = reads.find((r) => r[2] !== g1);
  if (!energy || !weight) return fail('run energy/weight not told apart');
  f.runEnergy = energy[1];
  f.runWeight = weight[1];
  m = /this\['[\w$]+'\]\[([\w$]+)\]=([\w$]+),this\['([\w$]+)'\]\[\1\]!==\2&&\(this\['\3'\]\[\1\]=\2,this\['[\w$]+'\]\(\1\),/.exec(src);
  if (!m) return fail('varps not found');
  f.varps = m[3];
  const api = `window.__lostlite&&window.__lostlite.setApi({loopCycle:()=>${loopHolder}['${loopCycle}']});`;
  return { ok: true, fields: f, api };
}

// ------------------------------------------------------------------ private messages (tab to reply)
//
// Fields only. From the friends list "Message" option: "userhash = toUserhash(name); find
// it in friendUserhash[0..friendCount]; if online (friendNodeId > 0): redrawChat = true,
// dialogInputOpen = false, socialInputOpen = true, socialInput = '', socialInputType = 3,
// socialUserhash = friendUserhash[i], socialInputHeader = 'Enter message to send to ' +
// friendUsername[i]". And addChat(type, text, sender), which shifts the 100-line chat
// history (chatType, chatUsername, chatText) down one and writes the new line at 0.

function patchSocial(src) {
  const fail = (reason) => ({ ok: false, reason });
  const f = {};
  let m = /let ([\w$]+)=([\w$]+)\['([\w$]+)'\]\([\w$]+\['substring'\]\([\w$]+\+0x5\)\['trim'\]\(\)\),[\w$]+=-0x1;for\(let [\w$]+=0x0;[\w$]+<this\['([\w$]+)'\];[\w$]+\+\+\)if\(this\['([\w$]+)'\]\[[\w$]+\]===\1\)\{[\w$]+=[\w$]+;break;\}-0x1!==[\w$]+&&this\['([\w$]+)'\]\[[\w$]+\]>0x0&&\(this\['([\w$]+)'\]=!0x0,this\['([\w$]+)'\]=!0x1,this\['([\w$]+)'\]=!0x0,this\['([\w$]+)'\]='',this\['([\w$]+)'\]=0x3,this\['([\w$]+)'\]=this\['\5'\]\[[\w$]+\],this\['([\w$]+)'\]='Enter\\x20message\\x20to\\x20send\\x20to\\x20'\+this\['([\w$]+)'\]\[[\w$]+\]\)/.exec(src);
  if (!m) return fail('private message prompt not found');
  const jstring = m[2];
  const toUserhash = m[3];
  f.friendCount = m[4];
  f.friendUserhash = m[5];
  f.friendWorld = m[6];
  f.socialRedraw = m[7];
  f.socialDialogOpen = m[8];
  f.socialInputOpen2 = m[9];
  f.socialInput = m[10];
  f.socialInputType = m[11];
  f.socialUserhash = m[12];
  f.socialInputHeader = m[13];
  f.friendUsername = m[14];
  m = /\['([\w$]+)'\]\(([\w$]+),([\w$]+),([\w$]+)\)\{0x0===\2&&-0x1!==this\['[\w$]+'\]&&\(this\['[\w$]+'\]=\3,this\['[\w$]+'\]=0x0\),-0x1===this\['[\w$]+'\]&&\(this\['[\w$]+'\]=!0x0\);for\(let [\w$]+=0x63;[\w$]+>0x0;[\w$]+--\)this\['([\w$]+)'\]\[[\w$]+\]=this\['\5'\]\[[\w$]+-0x1\],this\['([\w$]+)'\]\[[\w$]+\]=this\['\6'\]\[[\w$]+-0x1\],this\['([\w$]+)'\]\[/.exec(src);
  if (!m) return fail('chat history not found');
  f.addChat = m[1];
  f.chatType = m[5];
  f.chatUsername = m[6];
  f.chatText = m[7];
  const api = `window.__lostlite&&window.__lostlite.setApi({toUserhash:(n)=>${jstring}['${toUserhash}'](n)});`;
  return { ok: true, fields: f, api };
}

// ------------------------------------------------------------------ overlays (Phase 3) and ground items (2.4)
//
// Overlays are drawn by LostLite straight into the game's 3D view, after the client has
// drawn the scene and its own overlays (hitsplats, overhead text, the click cross) and
// just before it copies the view to the screen - the same moment RuneLite's overlays
// render. So they move with the camera exactly and never flicker.
//  - frame hook: gameDrawMain ends "world.renderAll(...); world.removeSprites();
//    entityOverlays(); coordArrow(); textureRunAnims(cycle); otherOverlays();
//    areaGame?.draw(4, 4); camX = savedCamX; ..." - window.__lostlite.frame(this, 0) goes
//    before otherOverlays (which draws the open interface and the menu) and frame(this, 1)
//    after it, in front of areaGame.draw
//  - projection: getOverlayPos(x, z, height) (the one used for hitsplats), "if (x < 128 ||
//    z < 128 || x > 13056 || z > 13056) { projectX = -1; projectY = -1; return }"
//  - the pixel buffer: Pix2D.setPixels(pixels, width, height) "pixels = a; width = b;
//    height = c; setClipping(0, 0, b, c)"
//  - fonts: "p11 = PixFont.depack(title, 'p11_full', false)" and its methods from
//    "p11?.centreStringTag(message, 180, y, 0x75a9a9, true)": centreStringTag(str, x, y,
//    rgb, shadowed) { drawStringTag(str, x - stringWid(str) / 2, y, rgb, shadowed) }
//  - colour tags: PixFont's tag lookup "return 'red' === tag ? 0xff0000 : ..." learns
//    LostLite's own "@~xx@" tags, so menus and text can use any colour
//  - ground items: showObject(x, z) "objs = groundObj[level][x][z]; ... for (obj =
//    objs.head(); obj; obj = objs.next()) { type = ObjType.list(obj.id); cost = type.cost;
//    if (type.stackable) cost *= obj.count + 1; ..."

const FRAME = /(this\['[\w$]+'\]\?\.\['[\w$]+'\]\(\),this\['[\w$]+'\]\(\),this\['[\w$]+'\]\(\),this\['[\w$]+'\]\([\w$]+\),)(this\['[\w$]+'\]\(\),)(this\['[\w$]+'\]\?\.\['[\w$]+'\]\(0x4,0x4\),this\['([\w$]+)'\]=)/g;
const PROJECT = /\['([\w$]+)'\]\(([\w$]+),([\w$]+),([\w$]+)\)\{if\(\2<0x80\|\|\3<0x80\|\|\2>0x3300\|\|\3>0x3300\)return this\['([\w$]+)'\]=-0x1,void\(this\['([\w$]+)'\]=-0x1\);let [\w$]+=this\['[\w$]+'\]\(\2,\3,this\['[\w$]+'\]\)-\4,[\w$]+=\2-this\['([\w$]+)'\]/g;
const SET_PIXELS = /static\['[\w$]+'\]\(([\w$]+),([\w$]+),([\w$]+)\)\{this\['([\w$]+)'\]=\1,this\['([\w$]+)'\]=\2,this\['([\w$]+)'\]=\3,this\['[\w$]+'\]\(0x0,0x0,\2,\3\);\}/g;
const FONTS = /this\['([\w$]+)'\]=([\w$]+)\['([\w$]+)'\]\(this\['[\w$]+'\],'p11_full',!0x1\),this\['([\w$]+)'\]=\2\['\3'\]\(this\['[\w$]+'\],'p12_full',!0x1\),this\['([\w$]+)'\]=\2\['\3'\]\(this\['[\w$]+'\],'b12_full',!0x1\)/;
const TAGS = /\['([\w$]+)'\]\(([\w$]+)\)\{return'red'===\2\?0xff0000:/g;
const GROUND = /\{let ([\w$]+)=this\['([\w$]+)'\]\[this\['[\w$]+'\]\]\[[\w$]+\]\[[\w$]+\];if\(!\1\)return void this\['[\w$]+'\]\?\.\['[\w$]+'\]\([^)]*\);let [\w$]+=-0x5f5e0ff,[\w$]+=null;for\(let ([\w$]+)=\1\['([\w$]+)'\]\(\);null!==\3;\3=\1\['([\w$]+)'\]\(\)\)\{let ([\w$]+)=[\w$]+\['[\w$]+'\]\(\3\['([\w$]+)'\]\),([\w$]+)=\6\['([\w$]+)'\];\6\['([\w$]+)'\]&&\(\8\*=\3\['([\w$]+)'\]\+0x1\)/;

function patchOverlay(src) {
  const fail = (reason) => ({ code: src, ok: false, reason });
  const f = {};
  const frames = [...src.matchAll(FRAME)];
  if (frames.length !== 1) return fail(`frame end found ${frames.length} times (expected 1)`);
  const projects = [...src.matchAll(PROJECT)];
  if (projects.length !== 1) return fail(`projection found ${projects.length} times (expected 1)`);
  const p = projects[0];
  f.project = p[1];
  f.projectX = p[5];
  f.projectY = p[6];
  f.camX = p[7];
  if (frames[0][4] !== f.camX) return fail('frame end and projection disagree');
  const pix = [...src.matchAll(SET_PIXELS)];
  if (pix.length !== 1) return fail(`pixel buffer found ${pix.length} times (expected 1)`);
  const cls = classBounds(src, pix[0].index);
  const clsName = cls && /^class ([\w$]+)/.exec(src.slice(cls.start, cls.start + 80));
  if (!clsName) return fail('pixel buffer class not found');
  const pixClass = clsName[1];
  const pixF = { pixels: pix[0][4], width: pix[0][5], height: pix[0][6] };
  const fonts = FONTS.exec(src);
  if (!fonts) return fail('fonts not found');
  f.fontP11 = fonts[1];
  f.fontP12 = fonts[4];
  f.fontB12 = fonts[5];
  const cst = new RegExp(`this\\['${fonts[1].replace(/\$/g, '\\$')}'\\]\\?\\.\\['([\\w$]+)'\\]\\(this\\['[\\w$]+'\\]\\['[\\w$]+'\\],0xb4,[\\w$]+,0x75a9a9,!0x0\\)`).exec(src);
  if (!cst) return fail('font centre method not found');
  const body = new RegExp(`\\['${cst[1].replace(/\$/g, '\\$')}'\\]\\(([\\w$]+),([\\w$]+),[\\w$]+,[\\w$]+,[\\w$]+\\)\\{\\2\\|=0x0,[\\w$]+\\|=0x0,this\\['([\\w$]+)'\\]\\(\\1,\\2-\\(this\\['([\\w$]+)'\\]\\(\\1\\)\\/0x2\\|0x0\\)`).exec(src);
  if (!body) return fail('font draw methods not found');
  f.fontDrawTag = body[3];
  f.fontWidth = body[4];
  const tags = [...src.matchAll(TAGS)];
  if (tags.length !== 1) return fail(`colour tags found ${tags.length} times (expected 1)`);
  const g = GROUND.exec(src);
  if (!g) return fail('ground items not found');
  f.groundObj = g[2];
  f.listHead = g[4];
  f.listNext = g[5];
  f.objId = g[7];
  f.objCost = g[9];
  f.objStackable = g[10];
  f.objCount = g[11];

  let code = src;
  // Later edits first, so earlier offsets stay valid.
  const edits = [
    // Layer 0 before otherOverlays() (so the open interface and the menu draw over world
    // overlays), layer 1 after it (overlays on interfaces, like the puzzle solver's).
    { at: frames[0].index + frames[0][1].length + frames[0][2].length, insert: 'window.__lostlite&&window.__lostlite.frame(this,1),' },
    { at: frames[0].index + frames[0][1].length, insert: 'window.__lostlite&&window.__lostlite.frame(this,0),' },
    { at: tags[0].index + tags[0][0].length - `return'red'===${tags[0][2]}?0xff0000:`.length, insert: `if('~'===${tags[0][2]}[0]&&window.__lostlite)return window.__lostlite.tagColour(${tags[0][2]});` },
  ].sort((a, b) => b.at - a.at);
  for (const e of edits) code = code.slice(0, e.at) + e.insert + code.slice(e.at);
  const api = `window.__lostlite&&window.__lostlite.setApi({pix:()=>({pixels:${pixClass}['${pixF.pixels}'],width:${pixClass}['${pixF.width}'],height:${pixClass}['${pixF.height}']})});`;
  return { code, ok: true, fields: f, api };
}

// ------------------------------------------------------------------ NPCs and players (2.2), model hulls
//
//  - addNpcs: "for (i < npcCount) { npc = npcs[npcIds[i]]; typecode = 0x20000000 + (npcIds[i]
//    << 14) | 0; if (!npc || !npc.isReady() || npc.type?.alwaysontop !== top) continue"
//  - addPlayers: "player = players[playerIds[i]]; id = playerIds[i] << 14" (self: 2047 << 14)
//  - ClientNpc: "type = null; getTempModel() { if (type == null) return null; model = ...;
//    height = model.minY; ..."
//  - NPC menu text: "name = type.name; if (type.vislevel !== 0) name += ' (level-' + vislevel"
//    and NpcType.list(id), whose 20-entry cache sets "type.id = id"
//  - the model draw (worldRender) projects every vertex into the static vertexScreenX/Y
//    arrays (-5000 when behind the camera) and then draws; a hook just before the draw lets
//    LostLite take the convex hull of models it wants (RuneLite's NPC hull highlight)

const ADD_NPCS = /for\(let ([\w$]+)=0x0;\1<this\['([\w$]+)'\];\1\+\+\)\{let ([\w$]+)=this\['([\w$]+)'\]\[this\['([\w$]+)'\]\[\1\]\],[\w$]+=0x20000000\+\(this\['\5'\]\[\1\]<<0xe\)\|0x0;if\(!\3\|\|!\3\['[\w$]+'\]\(\)\|\|\3\['([\w$]+)'\]\?\.\['[\w$]+'\]!==[\w$]+\)continue;/;
const ADD_PLAYERS = /\(([\w$]+)=this\['[\w$]+'\],([\w$]+)=0x1ffc000\):\(\1=this\['([\w$]+)'\]\[this\['([\w$]+)'\]\[([\w$]+)\]\],\2=this\['\4'\]\[\5\]<<0xe\)/;
const NPC_MENU = /let ([\w$]+)=([\w$]+)\['([\w$]+)'\];if\(0x0!==\2\['([\w$]+)'\]&&this\['[\w$]+'\]&&\(\1=\1\+this\['[\w$]+'\]\(this\['[\w$]+'\]\['[\w$]+'\],\2\['\4'\]\)\+'\\x20\(level-'\+\2\['\4'\]\+'\)'\)/;
const MODEL_DRAW = /\(([\w$]+)\['([\w$]+)'\]\[([\w$]+)\]=-0x1388,[\w$]+=!0x0\),\([^)]*\)&&\([^)]*\);\}(try\{this\['[\w$]+'\]\([\w$]+,[\w$]+,([\w$]+)\);\})/g;

function patchEntities(src) {
  const fail = (reason) => ({ code: src, ok: false, reason });
  const f = {};
  let m = ADD_NPCS.exec(src);
  if (!m) return fail('NPC list not found');
  f.npcCount = m[2];
  f.npcs = m[4];
  f.npcIds = m[5];
  f.npcType = m[6];
  m = /\(([\w$]+)=this\['[\w$]+'\],([\w$]+)=0x1ffc000\)/.exec(src);
  const pl = ADD_PLAYERS.exec(src);
  if (!pl) return fail('player list not found');
  f.players = pl[3];
  f.playerIds = pl[4];
  const countM = new RegExp(`let ([\\w$]+)=this\\['([\\w$]+)'\\];[\\w$]+&&\\(\\1=0x1\\);for\\(let ${pl[5].replace(/\$/g, '\\$')}=0x0;`).exec(src.slice(Math.max(0, pl.index - 400), pl.index));
  if (!countM) return fail('player count not found');
  f.playerCount = countM[2];
  m = new RegExp(`\\['[\\w$]+'\\]\\(\\)\\{if\\(null==this\\['${f.npcType.replace(/\$/g, '\\$')}'\\]\\)return null;let ([\\w$]+)=this\\['[\\w$]+'\\]\\(\\);if\\(null==\\1\\)return null;if\\(this\\['([\\w$]+)'\\]=\\1\\['[\\w$]+'\\],`).exec(src);
  if (!m) return fail('NPC model height not found');
  f.entityHeight = m[2];
  m = NPC_MENU.exec(src);
  if (!m) return fail('NPC name not found');
  f.npcName = m[3];
  f.npcLevel = m[4];
  // NpcType.list(id): the 20-entry cache in the class that declares the level field
  const lists = [...src.matchAll(/static\['[\w$]+'\]\(([\w$]+)\)\{if\(!this\['[\w$]+'\]\|\|!this\['[\w$]+'\]\|\|!this\['[\w$]+'\]\)throw Error\(\);for\(let [\w$]+=0x0;[\w$]+<0x14;[\w$]+\+\+\)\{let ([\w$]+)=this\['[\w$]+'\]\[[\w$]+\];if\(\2&&\2\['([\w$]+)'\]===\1\)return \2;\}/g)];
  const own = lists.find((l) => {
    const cls = classBounds(src, l.index);
    return cls && src.slice(cls.start, cls.end).includes(`['${f.npcLevel}']=-0x1`) && src.slice(cls.start, cls.end).includes(`['${f.npcName}']=null`);
  });
  if (!own) return fail('NPC id not found');
  f.npcId = own[3];
  const draws = [...src.matchAll(MODEL_DRAW)];
  if (draws.length !== 1) return fail(`model draw found ${draws.length} times (expected 1)`);
  const d = draws[0];
  const loopVar = d[3];
  const before = src.slice(Math.max(0, d.index - 1500), d.index);
  const loop = [...before.matchAll(new RegExp(`for\\(let ${loopVar.replace(/\$/g, '\\$')}=0x0;${loopVar.replace(/\$/g, '\\$')}<this\\['([\\w$]+)'\\];`, 'g'))].pop();
  if (!loop) return fail('model vertex count not found');
  const screenY = new RegExp(`${d[1].replace(/\$/g, '\\$')}\\['([\\w$]+)'\\]\\[${loopVar.replace(/\$/g, '\\$')}\\]=[\\w$]+\\+\\(\\([\\w$]+<<0x9\\)\\/[\\w$]+\\|0x0\\)\\):`).exec(before.slice(-300));
  if (!screenY) return fail('model screen y not found');
  const holder = d[1];
  const at = d.index + d[0].length - d[4].length;
  const hook = `window.__lostlite&&window.__lostlite.hullWanted&&window.__lostlite.modelDrawn(this,${d[5]},${holder}['${d[2]}'],${holder}['${screenY[1]}'],this['${loop[1]}']);`;
  const code = src.slice(0, at) + hook + src.slice(at);
  return { code, ok: true, fields: f };
}

// ------------------------------------------------------------------ menu action numbers
//
// The numbers the client gives its menu entries (what an entry does) differ between client
// builds, so they're read from the menu-building code rather than taken from the source:
//  - NPC options: the method that adds "<op> @yel@<name> (level-N)" entries, ending with
//    "Examine @yel@<name>"
//  - ground items: the block that adds "Take @lre@<name>" (the default op 3), from its
//    "Use <item> with @lre@<name>" entry to its "Examine @lre@<name>"
//  - "Walk here"
// An entry's number can also have 2000 added, which puts it below the others.

function patchActions(src, menuAction) {
  const fail = (reason) => ({ ok: false, reason });
  if (!menuAction) return fail('menu not found');
  const A = menuAction.replace(/\$/g, '\\$');
  const numbers = (text) => [...text.matchAll(new RegExp(`this\\['${A}'\\]\\[this\\['[\\w$]+'\\]\\]=(?:[\\w$]+\\+)?(0x[0-9a-f]+)`, 'g'))].map((m) => parseInt(m[1], 16));
  const actions = {};
  const walk = new RegExp(`'Walk\\\\x20here',this\\['${A}'\\]\\[this\\['[\\w$]+'\\]\\]=(0x[0-9a-f]+)`).exec(src);
  if (!walk) return fail('Walk here not found');
  actions.walk = parseInt(walk[1], 16);
  // NPCs
  const lvl = src.indexOf("'\\x20(level-'+");
  let npcStart = -1;
  let npcEnd = -1;
  for (let at = lvl; at >= 0; at = src.indexOf("'\\x20(level-'+", at + 1)) {
    const ex = src.indexOf("'Examine\\x20@yel@'+", at);
    if (ex > at && ex - at < 4000 && src.slice(at, ex).includes("'\\x20@yel@'+")) {
      npcStart = at;
      npcEnd = ex;
      break;
    }
  }
  if (npcStart < 0) return fail('NPC options not found');
  actions.npc = numbers(src.slice(npcStart, npcEnd));
  const npcEx = numbers(src.slice(npcEnd, npcEnd + 200))[0];
  if (!npcEx || actions.npc.length < 5) return fail('NPC actions not found');
  actions.npcExamine = npcEx;
  actions.npc.push(npcEx);
  // Ground items
  const take = src.indexOf("'Take\\x20@lre@'+");
  if (take < 0) return fail('Take not found');
  const useAt = src.lastIndexOf("with\\x20@lre@'+", take);
  const exAt = src.indexOf("'Examine\\x20@lre@'+", take);
  if (useAt < 0 || exAt < 0 || take - useAt > 3000 || exAt - take > 1000) return fail('ground item options not found');
  const objOps = numbers(src.slice(useAt, exAt));
  const objEx = numbers(src.slice(exAt, exAt + 200))[0];
  if (!objEx || objOps.length < 6) return fail('ground item actions not found');
  actions.objTake = [...new Set(objOps)];
  actions.objExamine = objEx;
  actions.obj = actions.objTake.concat(objEx);
  return { ok: true, actions };
}

// ------------------------------------------------------------------ roofs
//
// gameDrawMain picks the highest level to draw: "level = cinemaCam ? roofCheck2() :
// roofCheck()" (3 = everything, your own level = roofs and floors above you hidden, which
// roofCheck does when a roof is between you and the camera). With window.__lostlite.hideRoofs
// it always uses your own level, like standing indoors.

function patchRoofs(src, levelField, camX) {
  if (!levelField || !camX) return { code: src, ok: false, reason: 'level or camera not found' };
  const re = new RegExp(`(=this\\['[\\w$]+'\\]\\?this\\['[\\w$]+'\\]\\(\\):)(this\\['[\\w$]+'\\]\\(\\))(;let [\\w$]+=this\\['${camX.replace(/\$/g, '\\$')}'\\],)`, 'g');
  const m = [...src.matchAll(re)];
  if (m.length !== 1) return { code: src, ok: false, reason: `roof check found ${m.length} times (expected 1)` };
  const code = src.replace(re, `$1(window.__lostlite&&window.__lostlite.hideRoofs?this['${levelField}']:$2)$3`);
  return { code, ok: true };
}

// ------------------------------------------------------------------ interface buttons (status orbs)
//
// The orbs press the game's own buttons, exactly as a click on them would: the run/walk
// buttons in the controls tab and the special attack bar in the combat tab. A button press
// is a menu entry run through doAction(index), so the entry is written into a spare menu
// slot and doAction runs it. The numbers come from the component menu code:
// "buttonType 1 (ok) -> IF_BUTTON, 2 target, 3 'Close', 4 toggle, 5 select, 6 continue",
// with com.id as the third parameter.
//  - IF_SETHIDE: "com = g2(); hide = g1() === 1; IfType.list[com].hide = hide"
//  - side tabs: the tab icon click "if (x >= 694 && x <= 724 && y >= 168 && y < 205 &&
//    sideIcon[5] != -1) { redrawSide = true; activeIcon = 5; redrawIcons = true }"

function patchButtons(src) {
  const esc = (x) => x.replace(/\$/g, '\\$');
  const fail = (reason) => ({ ok: false, reason });
  const f = {};
  const id = '[\\w$]+';
  const close = src.indexOf("='Close',this['");
  if (close < 0) return fail('Close button not found');
  const around = src.slice(Math.max(0, close - 1200), close + 800);
  let m = new RegExp(`0x1===(${id})\\['(${id})'\\]\\)\\{let ${id}=!0x1;[^}]*?\\(this\\['${id}'\\]\\[this\\['${id}'\\]\\]=\\1\\['(${id})'\\],this\\['${id}'\\]\\[this\\['${id}'\\]\\]=(0x[0-9a-f]+),this\\['${id}'\\]\\[this\\['${id}'\\]\\]=\\1\\['(${id})'\\]`).exec(around);
  if (!m) return fail('button actions not found');
  f.comButtonType = m[2];
  f.comButtonText = m[3];
  f.comId = m[5];
  const buttons = { ok: parseInt(m[4], 16) };
  for (const [kind, n] of [['toggle', 4], ['select', 5]]) {
    const b = new RegExp(`0x${n.toString(16)}===${id}\\['${f.comButtonType}'\\]&&${id}\\['${f.comButtonText}'\\]\\?\\(this\\['${id}'\\]\\[this\\['${id}'\\]\\]=${id}\\['${f.comButtonText}'\\],this\\['${id}'\\]\\[this\\['${id}'\\]\\]=(0x[0-9a-f]+)`).exec(around);
    if (!b) return fail(`${kind} button action not found`);
    buttons[kind] = parseInt(b[1], 16);
  }
  // "Click here to continue" (BUTTON_CONTINUE, 6): optional, Dialogue Keys' Space uses it.
  const wide = src.slice(Math.max(0, close - 3000), close + 3000);
  const pause = new RegExp(`0x6===${id}\\['${esc(f.comButtonType)}'\\](?:&&[^?;]{0,80}?)?(?:\\?|&&)\\(this\\['${id}'\\]\\[this\\['${id}'\\]\\]=${id}\\['${esc(f.comButtonText)}'\\],this\\['${id}'\\]\\[this\\['${id}'\\]\\]=(0x[0-9a-f]+)`).exec(wide);
  if (pause) buttons.pause = parseInt(pause[1], 16);
  f.buttons = buttons;
  // Interface decoding (optional, for Dialogue Keys): a layer's child list ("if (type === 0)
  // { scrollHeight = g2(); hide = g1() === 1; n = g2(); children = new Array(n) ...") and a
  // text component's text ("if (type === 4) { text = gjstr(); text2 = gjstr() }").
  const kids = /if\(0x0===([\w$]+)\['([\w$]+)'\]\)\{\1\['[\w$]+'\]=[\w$]+\['[\w$]+'\]\(\),\1\['([\w$]+)'\]=0x1===[\w$]+\['[\w$]+'\]\(\);let ([\w$]+)=[\w$]+\['[\w$]+'\]\(\);\1\['([\w$]+)'\]=Array\(\4\)/.exec(src);
  if (kids) {
    f.comType = kids[2];
    f.comChildren = kids[5];
    const text = new RegExp(`0x4===${id}\\['${esc(kids[2])}'\\]&&\\(${id}\\['(${id})'\\]=${id}\\['${id}'\\]\\(\\),${id}\\['${id}'\\]=`).exec(src);
    if (text) f.comText = text[1];
    // "if (type === 1 || type === 3 || type === 4) colour = g4()" (the quest list's red/yellow/green)
    const colour = new RegExp(`0x1!==(${id})\\['${esc(kids[2])}'\\]&&0x3!==\\1\\['${esc(kids[2])}'\\]&&0x4!==\\1\\['${esc(kids[2])}'\\]\\|\\|\\(\\1\\['(${id})'\\]=`).exec(src);
    if (colour) f.comColour = colour[2];
  }
  // The select button's own action: "if (com.scripts && com.scripts[0] && com.scripts[0][0] === 5)
  // { varp = com.scripts[0][1]; if (com.scriptOperand && var[varp] !== com.scriptOperand[0]) ..."
  const sel = new RegExp(`if\\(([\\w$]+)\\['([\\w$]+)'\\]&&\\1\\['\\2'\\]\\[0x0\\]&&0x5===\\1\\['\\2'\\]\\[0x0\\]\\[0x0\\]\\)\\{let [\\w$]+=\\1\\['\\2'\\]\\[0x0\\]\\[0x1\\];\\1\\['([\\w$]+)'\\]&&`).exec(src);
  if (!sel) return fail('button scripts not found');
  f.comScripts = sel[2];
  f.comOperand = sel[3];
  const hides = [...src.matchAll(/let ([\w$]+)=this\['[\w$]+'\]\['[\w$]+'\]\(\),([\w$]+)=0x1===this\['[\w$]+'\]\['[\w$]+'\]\(\);return [\w$]+\['[\w$]+'\]\[\1\]\['([\w$]+)'\]=\2,/g)];
  if (hides.length !== 1) return fail(`interface hide found ${hides.length} times (expected 1)`);
  f.comHide = hides[0][3];
  m = />=0x2b6&&this\['[\w$]+'\]<=0x2d4&&this\['[\w$]+'\]>=0xa8&&this\['[\w$]+'\]<0xcd&&-0x1!=this\['([\w$]+)'\]\[0x5\]\?\(this\['([\w$]+)'\]=!0x0,this\['([\w$]+)'\]=0x5,this\['([\w$]+)'\]=!0x0\)/.exec(src);
  if (!m) return fail('side tabs not found');
  f.sideIcon = m[1];
  f.redrawSide = m[2];
  f.activeTab = m[3];
  f.redrawIcons = m[4];
  return { ok: true, fields: f };
}

// ------------------------------------------------------------------ scene objects (2.5)
//
// Fields only. Removing a loc reads the scene the way RuneLite's tile objects do:
// "typecode = layer 0 ? world.wallType(level, x, z) : 1 ? world.decorType(level, z, x) :
// 2 ? world.sceneType(level, x, z) : 3 && world.gdType(level, x, z); if (typecode) info =
// world.typeCode2(level, x, z, typecode)". A typecode is x + (z << 7) + (loc id << 14) +
// (2 << 29). Loc names come from the examine option: "LocType.list(id).desc ?? 'It's a ' + name".

/** The client's idle timer: when you last moved the mouse or pressed a key in the game
 * (performance.now). After 90 s without input it asks the server to log you out. */
/** Interface layout, for scrolling with the mouse wheel: addComponentOptions(com, mouseX,
 * mouseY, x, y, scrollPos) "if (com.type !== 0 || !com.children || com.hide || mouseX < x ||
 * mouseY < y || mouseX > x + com.width || mouseY > y + com.height || !com.childX ||
 * !com.childY) return; ... childX = com.childX[i] + x; childY = com.childY[i] + y - scroll;
 * child = IfType.list[com.children[i]]; childX += child.x; childY += child.y; ... if
 * (child.type === 0) { addComponentOptions(child, ..., child.scrollPos); if
 * (child.scrollHeight > child.height) doScrollbar(...) }". */
function patchScroll(src) {
  const id = '[\\w$]+';
  const m = new RegExp(`\\['${id}'\\]\\((${id}),(${id}),(${id}),(${id}),(${id}),(${id})\\)\\{if\\(0x0!==\\1\\['(${id})'\\]\\|\\|!\\1\\['(${id})'\\]\\|\\|\\1\\['(${id})'\\]\\|\\|\\2<\\4\\|\\|\\3<\\5\\|\\|\\2>\\4\\+\\1\\['(${id})'\\]\\|\\|\\3>\\5\\+\\1\\['(${id})'\\]\\|\\|!\\1\\['(${id})'\\]\\|\\|!\\1\\['(${id})'\\]\\)return;`).exec(src);
  if (!m) return { ok: false, reason: 'interface layout not found' };
  const body = src.slice(m.index, m.index + 1500);
  const pos = new RegExp(`(${id})\\+=(${id})\\['(${id})'\\],(${id})\\+=\\2\\['(${id})'\\]`).exec(body);
  const sh = pos && new RegExp(`${pos[2].replace(/\$/g, '\\$')}\\['(${id})'\\]>${pos[2].replace(/\$/g, '\\$')}\\['${m[11].replace(/\$/g, '\\$')}'\\]&&`).exec(body);
  if (!pos || !sh) return { ok: false, reason: 'interface positions not found' };
  return { ok: true, fields: { comWidth: m[10], comHeight: m[11], comChildX: m[12], comChildY: m[13], comX: pos[3], comY: pos[5], comScrollHeight: sh[1] } };
}

// ------------------------------------------------------------------ item drags (bank placeholders)
//
// When a drag ends over another slot of the same inventory: "if (hoveredSlotComId ===
// objDragComId && hoveredSlot !== objDragSlot) { com = list[objDragComId]; mode = 0; if
// (bankArrangeMode == 1 && com.clientCode == CC_BANKMODE) mode = 1; ... swap the slots and send
// INV_BUTTOND }". window.__lostlite.invDrag(com, from, to, mode) is asked first; true means
// LostLite handled it (the bank with placeholders is laid out by LostLite, so its slots aren't
// the server's) and the game does nothing.
const INV_DRAG = /this\['([\w$]+)'\]=-0x1,this\['[\w$]+'\]\(\),(this\['\1'\]===this\['([\w$]+)'\]&&this\['([\w$]+)'\]!==this\['([\w$]+)'\])\)\{let [\w$]+=[\w$]+\['[\w$]+'\]\[this\['\3'\]\],[\w$]+=0x0;if\(0x1==this\['([\w$]+)'\]&&0xce==/g;

function patchDrag(src) {
  const all = [...src.matchAll(INV_DRAG)];
  if (all.length !== 1) return { code: src, ok: false, reason: `item drag found ${all.length} times (expected 1)` };
  const m = all[0];
  const at = m.index + m[0].indexOf(m[2]) + m[2].length;
  const hook = `&&!(window.__lostlite&&window.__lostlite.invDrag(this['${m[3]}'],this['${m[5]}'],this['${m[4]}'],this['${m[6]}']))`;
  return { code: src.slice(0, at) + hook + src.slice(at), ok: true };
}

function patchIdle(src) {
  const id = '[\\w$]+';
  const m = new RegExp(`${id}-this\\['(${id})'\\]>0x15f90&&\\(this\\['${id}'\\]=0xfa,this\\['\\1'\\]\\+=0x2710`).exec(src);
  if (!m) return { ok: false, reason: 'idle timer not found' };
  return { ok: true, fields: { idleTimer: m[1] } };
}

/** Item icons: the client's ObjType.getSprite(id, count, outline), which draws the 32 x 32
 * inventory icon (cached by the client); and the spot animation on an entity (spotanimId and
 * when it starts), e.g. the bind impact on you. */
function patchIcons(src) {
  const id = '[\\w$]+';
  const m = new RegExp(`static\\['(${id})'\\]\\((${id}),(${id}),(${id})\\)\\{if\\(0x0===\\4\\)\\{let ${id}=(${id})\\['${id}'\\]\\['${id}'\\]\\(BigInt\\(\\2\\)\\)`).exec(src);
  if (!m) return { ok: false, reason: 'item icon drawing not found' };
  const body = src.slice(m.index, m.index + 3000);
  const v = new RegExp(`let (${id})=new ${id}\\(0x20,0x20\\)`).exec(body);
  const d = v && new RegExp(`\\(${v[1].replace(/\$/g, '\\$')}\\['(${id})'\\],0x20,0x20\\)`).exec(body);
  if (!d) return { ok: false, reason: 'item icon pixels not found' };
  const fields = { iconData: d[1] };
  const api = `window.__lostlite&&window.__lostlite.setApi({objIcon:(id,n)=>${m[5]}['${m[1]}'](id,n,0)});`;
  return { ok: true, fields, api };
}

function patchSpotanim(src) {
  const id = '[\\w$]+';
  const m = new RegExp(`(${id})\\['(${id})'\\]=${id}\\['${id}'\\]\\(\\);let (${id})=${id}\\['${id}'\\]\\(\\);\\1\\['${id}'\\]=\\3>>0x10,\\1\\['(${id})'\\]=${id}\\['${id}'\\]\\+\\(0xffff&\\3\\)`).exec(src);
  if (!m) return { ok: false, reason: 'spot animations not found' };
  return { ok: true, fields: { entitySpotanim: m[2], entitySpotanimCycle: m[4] } };
}

function patchScene(src) {
  const id = '[\\w$]+';
  const m = new RegExp(`0x0===(${id})\\?(${id})=this\\['(${id})'\\]\\['(${id})'\\]\\((${id}),(${id}),(${id})\\):0x1===\\1\\?\\2=this\\['\\3'\\]\\['(${id})'\\]\\(\\5,\\7,\\6\\):0x2===\\1\\?\\2=this\\['\\3'\\]\\['(${id})'\\]\\(\\5,\\6,\\7\\):0x3===\\1&&\\(\\2=this\\['\\3'\\]\\['(${id})'\\]\\(\\5,\\6,\\7\\)\\),0x0!==\\2\\)\\{let ${id}=this\\['\\3'\\]\\['(${id})'\\]\\(`).exec(src);
  if (!m) return { ok: false, reason: 'scene object lookups not found' };
  const f = { sceneWorld: m[3], sceneWall: m[4], sceneDecor: m[8], sceneLoc: m[9], sceneGroundDecor: m[10], sceneInfo: m[11] };
  const n = new RegExp(`(${id})=(${id})>>0xe&0x7fff,(${id})=(${id})\\['(${id})'\\]\\(\\1\\);${id}=\\3\\['(${id})'\\]\\?\\3\\['\\6'\\]:'It\\\\x27s\\\\x20a\\\\x20'\\+\\3\\['(${id})'\\]`).exec(src);
  if (!n) return { ok: false, reason: 'loc names not found' };
  f.locName = n[7];
  f.locDesc = n[6];
  const api = `window.__lostlite&&window.__lostlite.setApi({loc:(id)=>${n[4]}['${n[5]}'](id)});`;
  return { ok: true, fields: f, api };
}

// ------------------------------------------------------------------ hint arrow
//
// The game's own hint arrow (the yellow arrow quests use): HINT_ARROW sets "hintType =
// g1(); if (type 1) hintNpc = g2(); if (2..6) { offsets ...; hintType = 2; hintTileX = g2();
// hintTileZ = g2(); hintHeight = g1() }; if (10) hintPlayer = g2()". The Clue Helper points
// it at the clue's NPC or tile, client-side only.

function patchHint(src) {
  const m = /return this\['([\w$]+)'\]=this\['[\w$]+'\]\['[\w$]+'\]\(\),0x1===this\['\1'\]&&\(this\['([\w$]+)'\]=this\['[\w$]+'\]\['[\w$]+'\]\(\)\),this\['\1'\]>=0x2&&this\['\1'\]<=0x6&&\(0x2===this\['\1'\]\?\(this\['([\w$]+)'\]=0x40,this\['([\w$]+)'\]=0x40\)[^;]*?this\['\1'\]=0x2,this\['([\w$]+)'\]=this\['[\w$]+'\]\['[\w$]+'\]\(\),this\['([\w$]+)'\]=this\['[\w$]+'\]\['[\w$]+'\]\(\),this\['([\w$]+)'\]=/.exec(src);
  if (!m) return { ok: false, reason: 'hint arrow not found' };
  return { ok: true, fields: { hintType: m[1], hintNpc: m[2], hintOffsetX: m[3], hintOffsetZ: m[4], hintTileX: m[5], hintTileZ: m[6], hintHeight: m[7] } };
}

// ------------------------------------------------------------------ camera

const CAMERA_DISTANCE = /(-0x32,this\['[\w$]+'\],)(0x3\*[\w$]+\+0x258)\)/g;

/** Makes the follow camera's distance scale with window.__lostlite.zoom. */
function patchZoom(src) {
  const matches = [...src.matchAll(CAMERA_DISTANCE)];
  if (matches.length !== 1) {
    return { code: src, ok: false, reason: `camera distance found ${matches.length} times (expected 1)` };
  }
  const code = src.replace(CAMERA_DISTANCE, '$1($2)*window.__lostlite.zoom|0)');
  return { code, ok: true };
}

/**
 * Returns { code, info } where code is the patched bundle with the runtime prepended.
 * options.drawDistance: tiles drawn around the camera (25 is the original).
 */
function patchClient(src, runtimeSource, options = {}) {
  if (src.includes('window.__lostlite')) throw new Error('bundle already patched');
  const read = findReadMethod(src);
  const fields = findFields(src);
  let patched = src.slice(0, read.insertAt) + HOOK + src.slice(read.insertAt);
  const zoom = patchZoom(patched);
  patched = zoom.code;
  const draw = patchDrawDistance(patched, Math.max(25, Math.min(50, options.drawDistance || 25)));
  patched = draw.code;
  const menu = patchMenu(patched);
  patched = menu.code;
  if (menu.ok) Object.assign(fields, menu.fields);
  const login = patchLogin(patched);
  patched = login.code;
  if (login.ok) Object.assign(fields, login.fields);
  const bank = patchBank(patched);
  if (bank.ok) Object.assign(fields, bank.fields);
  const player = patchPlayer(patched);
  if (player.ok) Object.assign(fields, player.fields);
  const hint = patchHint(patched);
  if (hint.ok) Object.assign(fields, hint.fields);
  const buttons = patchButtons(patched);
  if (buttons.ok) Object.assign(fields, buttons.fields);
  const scene = patchScene(patched);
  if (scene.ok) Object.assign(fields, scene.fields);
  const scroll = patchScroll(patched);
  if (scroll.ok) Object.assign(fields, scroll.fields);
  const idle = patchIdle(patched);
  if (idle.ok) Object.assign(fields, idle.fields);
  const icons = patchIcons(patched);
  if (icons.ok) Object.assign(fields, icons.fields);
  const spot = patchSpotanim(patched);
  if (spot.ok) Object.assign(fields, spot.fields);
  const acts = patchActions(patched, fields.menuAction);
  if (acts.ok) fields.actions = acts.actions;
  const drag = patchDrag(patched);
  patched = drag.code;
  const overlay = patchOverlay(patched);
  patched = overlay.code;
  if (overlay.ok) Object.assign(fields, overlay.fields);
  const roofs = patchRoofs(patched, fields.level, fields.camX);
  patched = roofs.code;
  const entities = patchEntities(patched);
  patched = entities.code;
  if (entities.ok) Object.assign(fields, entities.fields);
  const social = patchSocial(patched);
  if (social.ok) Object.assign(fields, social.fields);
  const chat = patchChat(patched);
  patched = chat.code;
  if (chat.ok) Object.assign(fields, chat.fields);
  const warnings = [];
  if (!zoom.ok) warnings.push(`Zoom unavailable: ${zoom.reason}`);
  if (!draw.ok) warnings.push(`Draw distance unavailable: ${draw.reason}`);
  if (!fields.cameraYaw) warnings.push('Camera rotation unavailable: camera fields not found');
  if (!menu.ok) warnings.push(`Menu hook unavailable: ${menu.reason}`);
  if (!login.ok) warnings.push(`Login screen hook unavailable: ${login.reason}`);
  if (!bank.ok) warnings.push(`Bank search unavailable: ${bank.reason}`);
  if (!player.ok) warnings.push(`Player data unavailable: ${player.reason}`);
  if (!hint.ok) warnings.push(`Hint arrow unavailable: ${hint.reason}`);
  if (!buttons.ok) warnings.push(`Orb buttons unavailable: ${buttons.reason}`);
  if (!acts.ok) warnings.push(`Menu actions unknown: ${acts.reason}`);
  if (!overlay.ok) warnings.push(`Overlays unavailable: ${overlay.reason}`);
  if (!roofs.ok) warnings.push(`Hide roofs unavailable: ${roofs.reason}`);
  if (!entities.ok) warnings.push(`NPC and player data unavailable: ${entities.reason}`);
  if (!social.ok) warnings.push(`Tab to reply unavailable: ${social.reason}`);
  if (!chat.ok) warnings.push(`Chat prompt / Esc to close unavailable: ${chat.reason}`);
  if (!scene.ok) warnings.push(`Scene objects unavailable: ${scene.reason}`);
  if (!idle.ok) warnings.push(`Idle timer unavailable: ${idle.reason}`);
  if (!scroll.ok) warnings.push(`Mouse wheel scrolling unavailable: ${scroll.reason}`);
  if (!icons.ok) warnings.push(`Item icons unavailable: ${icons.reason}`);
  if (!spot.ok) warnings.push(`Spot animations unavailable: ${spot.reason}`);
  if (!drag.ok) warnings.push(`Bank placeholders unavailable: ${drag.reason}`);
  const info = {
    readMethod: read.name,
    fields,
    features: { zoom: zoom.ok, drawDistance: draw.ok ? draw.radius : null, rotate: !!fields.cameraYaw, menu: menu.ok, menuHover: !!menu.hover, login: login.ok, bank: bank.ok, chat: chat.ok, player: player.ok, social: social.ok, overlay: overlay.ok, entities: entities.ok, actions: acts.ok, roofs: roofs.ok, buttons: buttons.ok && !!fields.doAction, hint: hint.ok, scene: scene.ok, idle: idle.ok, scroll: scroll.ok, icons: icons.ok, spotanim: spot.ok, drag: drag.ok },
    warnings,
    length: src.length,
  };
  const prelude = `${runtimeSource}\n;window.__lostlite&&window.__lostlite.configure(${JSON.stringify(info)});\n${bank.ok ? bank.api : ''}\n${player.ok ? player.api : ''}\n${social.ok ? social.api : ''}\n${overlay.ok ? overlay.api : ''}\n${scene.ok ? scene.api : ''}\n${icons.ok ? icons.api : ''}\n`;
  return { code: prelude + patched, info };
}

module.exports = { patchClient, findReadMethod, findFields, patchZoom, patchDrawDistance, patchMenu, patchLogin, patchBank, patchChat, patchPlayer, patchSocial, patchOverlay, patchEntities, patchActions, patchRoofs, patchButtons, patchHint, patchScene, patchDrag, HOOK };
