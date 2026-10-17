'use strict';
// Quest Helper: the progress data and guides built from Lost City's content, the engine
// (stages from the quest list, the journal and conversations; picking the step), the route
// finder over the world's collision map, and the page side against a fake client.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'src', 'plugins', 'questhelper');
const progress = require(path.join(dir, 'progress.json'));
const guides = require(path.join(dir, 'guides.json'));
const { QuestEngine } = require(path.join(dir, 'engine.js'));
const { load, corners, smooth } = require(path.join(dir, 'route.js'));

// ---- data
assert.ok(Object.keys(progress.quests).length >= 40, 'quest list read');
for (const k of ['cook', 'sheep', 'runemysteries', 'romeojuliet', 'priest', 'imp', 'doric', 'hetty']) {
  assert.ok(guides[k], `${k} guide`);
  assert.ok(progress.quests[k].com > 0, `${k} quest list entry`);
  for (const st of guides[k].stages) for (const r of st.rules) assert.ok(guides[k].steps[r.step], `${k} rule step`);
  for (const [id, s] of Object.entries(guides[k].steps)) assert.ok(s.text && (s.at || s.npc), `${k}.${id} has text and a place`);
}
assert.ok(progress.journal.root > 0 && progress.journal.lines.length >= 20, 'journal interface');
console.log(`quest data: ok (${Object.keys(guides).length} guides)`);

// ---- engine
const e = new QuestEngine({ progress, guides });
const have = (inv = {}, pos = { x: 3222, z: 3218, level: 0 }, worn = {}) => ({ inv, worn, pos, npcs: new Set() });
// nothing read yet: no guessing
assert.ok(e.current('imp', have()).waiting, 'waits for the quest list');
// quest list: red = not started
e.questList({ cook: 'red', sheep: 'red', romeojuliet: 'yellow', doric: 'green' });
assert.strictEqual(e.status('cook'), 'not started');
assert.strictEqual(e.current('cook', have()).id, 'start');
assert.strictEqual(e.status('doric'), 'done');
assert.ok(e.current('doric', have()).done);
// yellow without knowing more: the first stage, not sure
assert.strictEqual(e.quest('romeojuliet').stage, 10);
assert.strictEqual(e.quest('romeojuliet').sure, false);
// conversation: starting the Cook's quest
assert.deepStrictEqual(e.dialogue("Cook Oh thank you, thank you. I need milk, an egg and flour. I'd be very grateful if you can get them to me."), ['cook']);
assert.strictEqual(e.quest('cook').stage, 1);
assert.strictEqual(e.current('cook', have()).id, 'getBucket');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1 })).id, 'getEgg', 'bucket and pot: egg next');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1 })).id, 'getWheat');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1, 1947: 1 })).id, 'climbUp');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1, 1947: 1 }, { x: 3165, z: 3306, level: 2 })).id, 'fillHopper');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1 }, { x: 3165, z: 3306, level: 2 })).id, 'operate');
e.message('You operate the hopper. The grain slides down the chute.');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1 }, { x: 3165, z: 3306, level: 2 })).id, 'climbDown', 'flag from a game message');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1931: 1, 1944: 1 }, { x: 3165, z: 3306, level: 0 })).id, 'collectFlour');
assert.strictEqual(e.current('cook', have({ 1925: 1, 1933: 1, 1944: 1 })).id, 'milkCow');
assert.strictEqual(e.current('cook', have({ 1927: 1, 1933: 1, 1944: 1 })).id, 'finish');
// journal: Romeo & Juliet, waiting on the cadava berries
const RJ = ["@str@I have agreed to find Juliet for Romeo and tell her how he", "@str@feels. For some reason he can't just do this himself.", '@str@I found Juliet on the Western edge of Varrock, and told', '@str@her about Romeo. She gave me a message to take back.',
  '@str@I delivered the message to Romeo, and he was sad to hear', "@str@that Juliet's father opposed their marriage. However, he", '@str@said that Father Lawrence might be able to overcome this.',
  '@str@I found Father Lawrence and he suggested the use of a', "@str@potion to fool Juliet's father that she is dead so that", '@str@Romeo and Juliet can be together in peace.',
  '@str@I went to the Apothecary regarding making this cadava', '@str@potion, and he told me to bring him some cadava berries.', '@dbl@I will have to find some @dre@cadava berries@dbl@.'];
const rj = e.journal(RJ);
assert.ok(rj && rj.quest === 'romeojuliet', JSON.stringify(rj));
assert.strictEqual(e.quest('romeojuliet').stage, 50);
assert.ok(e.quest('romeojuliet').sure);
assert.strictEqual(e.current('romeojuliet', have()).id, 'berries');
// Sheep Shearer: the journal says how many balls are left
e.journal(['@str@I asked Farmer Fred, near Lumbridge, for a quest. Fred', "@str@said he'd pay me for shearing his sheep for him!", '', '@dbl@I need to collect 15 more @dre@balls of wool.']);
assert.strictEqual(e.quest('sheep').stage, 6);
assert.strictEqual(e.itemList('sheep', ['balls'], have())[0].need, 15);
assert.strictEqual(e.current('sheep', have({ 1735: 1 })).id, 'shear');
assert.strictEqual(e.current('sheep', have({ 1759: 15 })).id, 'handIn');
// quest list turning green finishes it
e.questList({ cook: 'green' });
assert.ok(e.current('cook', have()).done);
// red again (a reset on the server): back to the start
e.questList({ cook: 'red' });
assert.strictEqual(e.current('cook', have()).id, 'start');
// pinning a step
e.pin('cook', 'milkCow');
assert.strictEqual(e.current('cook', have()).id, 'milkCow');
e.dialogue('Oh thank you, thank you. I need milk, an egg and flour. I\'d be very grateful if you can get them to me.');
assert.notStrictEqual(e.current('cook', have()).pinned, true, 'a pin lasts until the stage moves');
// worn items count: the ghostspeak amulet
e.dialogue('Father Urhney hands you an amulet.');
assert.strictEqual(e.quest('priest').stage, 2);
assert.strictEqual(e.itemList('priest', ['amulet'], have({}, undefined, { 552: true }))[0].have, 1);
// Horror from the Deep: part-steps from game messages, the lighthouse copy, the wall
e.questList({ horror: 'red' });
assert.strictEqual(e.current('horror', have({}, { x: 2540, z: 3570, level: 0 })).id, 'start');
e.dialogue("Oh thank you so much! I know my darling would never have left with the lighthouse lights off and without even telling me where he's gone!");
assert.strictEqual(e.quest('horror').stage, 1);
assert.strictEqual(e.current('horror', have()).id, 'plank1');
e.dialogue('You create half a makeshift walkway out of the plank.');
assert.strictEqual(e.current('horror', have()).id, 'plank2');
e.dialogue('You have now made a makeshift walkway over the bridge.');
assert.strictEqual(e.current('horror', have()).id, 'gunnjorn');
assert.strictEqual(e.current('horror', have({ 3848: 1 })).id === 'unlock' || e.current('horror', have({ [guides.horror.items.key.ids[0]]: 1 })).id === 'unlock', true);
e.message('You unlock the Lighthouse front door.');
assert.strictEqual(e.current('horror', have()).id, 'enter');
e.journal(['@str@I repaired the bridge leading to Rellekka and got a key @str@from Gunnjorn so I could enter the lighthouse.', '@dbl@Now I need to find some way of @dre@fixing@dbl@ the @dre@lighthouse @dre@lamp@dbl@.']);
assert.strictEqual(e.quest('horror').stage, 2, 'own journal stages');
assert.strictEqual(e.current('horror', have({}, { x: 2445, z: 4598, level: 0 })).id, 'up1');
assert.strictEqual(e.current('horror', have({}, { x: 2443, z: 4600, level: 2 })).id, 'useTar');
e.message('You use the swamp tar to make the torch flammable again.');
e.message('You light the torch with your tinderbox.');
assert.strictEqual(e.current('horror', have({}, { x: 2443, z: 4600, level: 2 })).id, 'useGlass');
e.journal(['@str@I repaired the bridge leading to Rellekka and got a key @str@from Gunnjorn so I could enter the lighthouse.', '@str@I managed to repair the lighthouse light with some molten @str@glass, some swamp tar and a tinderbox.', "@dbl@I must @dre@search this place@dbl@ and find out what has happened to @dbl@Larrissa's boyfriend @dre@Jossik@dbl@!"]);
assert.strictEqual(e.quest('horror').stage, 4);
assert.strictEqual(e.current('horror', have({}, { x: 2507, z: 3639, level: 2 })).id, 'downTop');
assert.strictEqual(e.current('horror', have({}, { x: 2518, z: 4618, level: 1 })).id, 'wallFire');
for (const m of ['You place a fire rune into the slot in the wall.', 'You place a water rune into the slot in the wall.', 'You place an earth rune into the slot in the wall.', 'You place an air rune into the slot in the wall.', 'You place a sword into the slot in the wall.']) e.message(m);
assert.strictEqual(e.current('horror', have({}, { x: 2518, z: 4618, level: 1 })).id, 'wallArrow');
e.message('You place an arrow into the slot in the wall.');
e.message('You hear the sound of something moving within the wall.');
assert.strictEqual(e.current('horror', have({}, { x: 2518, z: 4618, level: 1 })).id, 'throughWall');
assert.strictEqual(e.current('horror', have({}, { x: 2518, z: 4633, level: 0 })).id, 'jossik');
e.dialogue("Okay, now that the creature's dead we can get you out of here.");
assert.strictEqual(e.current('horror', have({}, { x: 2518, z: 4633, level: 0 })).id, 'mother');

// saving and loading
const saved = JSON.parse(JSON.stringify(e.save()));
const e2 = new QuestEngine({ progress, guides });
e2.load(saved);
assert.strictEqual(e2.quest('sheep').stage, 6);
console.log('quest engine: ok');

// ---- routes
const t0 = Date.now();
const w = load(dir);
const loadMs = Date.now() - t0;
const r1 = w.find({ x: 3222, z: 3218, level: 0 }, { x: 3166, z: 3307, level: 2 }, { near: 1 });
assert.ok(r1 && r1.some((p) => p.via === 'ladder') && r1[r1.length - 1].level === 2, 'up the mill ladders');
const r2 = w.find({ x: 3222, z: 3218, level: 0 }, { x: 3103, z: 9571, level: 0 }, { near: 1 });
assert.ok(r2 && r2.some((p) => p.via === 'wizards_tower_laddertop'), "down into the Wizards' Tower basement");
const r3 = w.find({ x: 3222, z: 3218, level: 0 }, { x: 3212, z: 3428, level: 0 });
assert.ok(r3 && r3.length > 150, 'to Varrock square, ending beside the fountain');
for (let i = 1; i < r3.length; i++) {
  const a = r3[i - 1];
  const b = r3[i];
  assert.ok(a.via || Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) === 1, 'one square at a time');
  if (!a.via) assert.ok(w.canStep(a.x, a.z, a.level, b.x - a.x, b.z - a.z), 'every step walkable');
}
const r4 = w.find({ x: 2540, z: 3570, level: 0 }, { x: 2508, z: 3635, level: 0 }, { near: 1, maxNodes: 300000, weight: 2 });
assert.ok(r4 && r4.some((p) => /jumping_spot/.test(p.via || '')), 'Barbarian Outpost to the lighthouse, over the basalt rocks');
const r5 = w.find({ x: 3012, z: 3355, level: 0 }, { x: 2508, z: 3635, level: 0 }, { near: 1, maxNodes: 3000000, weight: 2 });
assert.ok(r5 && r5.length > 600, 'Falador to the lighthouse, the long way round on foot');
assert.ok(r5.filter((p) => p.level > 0).length < 40, 'no walking through the air on upper floors');
assert.ok(!w.walkable(2700, 3500, 1), 'open air above the ground is not walkable');
const c3 = smooth(w, r3);
assert.ok(c3.length < r3.length / 5 && c3[0] === r3[0] && c3[c3.length - 1] === r3[r3.length - 1], `smoothed ${r3.length} -> ${c3.length}`);
const s1 = smooth(w, r1);
assert.ok(s1.some((p) => p.via === 'ladder'), 'smoothing keeps the ladders');
assert.strictEqual(w.find({ x: 3222, z: 3218, level: 0 }, { x: 3212, z: 3215, level: 3 }, { maxNodes: 20000 }), null, 'no route: null');
console.log(`routes: ok (loaded in ${loadMs} ms)`);

// ---- page side
const posted = [];
const handlers = {};
const win = { postMessage: (m) => posted.push(m), addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); } };
let clock = 1000;
const ctx = vm.createContext({ window: win, document: { getElementById: () => null }, setInterval() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => clock }, Int32Array, Math, String, Array, Object, RegExp, Proxy, Map, Set, JSON, Number, isFinite, parseInt });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'page.js'), 'utf8'), ctx);
const ll = vm.runInContext('window.__lostlite', ctx);
const cmd = (c) => handlers.message.forEach((fn) => fn({ source: win, data: { __lostliteCmd: c } }));
const texts = [];
const font = { tag(str, x, y, rgb) { texts.push({ str, x, y, rgb }); }, wid(str) { return String(str).length * 6; } };
const L = [];
const com = (id, extra) => { L[id] = { cid: id, bt: 0, hd: false, kids: null, txt: '', col: 0, ...extra }; return L[id]; };
const cookCom = progress.quests.cook.com;
com(cookCom, { col: 0xf8f800 }); // as the server sends it: 5 bits per channel
com(progress.quests.sheep.com, { col: 0xff0000 });
com(progress.quests.doric.com, { col: 0x00f800 });
// a conversation with options
com(2490, { kids: [2491, 2492, 2493] });
com(2491, { txt: 'Select an Option' });
com(2492, { txt: "What's wrong?", bt: 1 });
com(2493, { txt: 'Nice hat!', bt: 1 });
const cook = { t: { nm: 'Cook', lv: 0, id: 278 }, ex: 10 * 128 + 64, ez: 30 * 128 + 64, sz: 1, ht: 80, rx: new Int32Array([10]), rz: new Int32Array([30]), anim: -1, cc: -1000, hp: 0, th: 0, face: -1 };
const client = {
  lp: { ex: 12 * 128 + 64, ez: 30 * 128 + 64 }, lvl: 0, bx: 3199, bz: 3185, p11: font, p12: font, b12: font, px: -1, py: -1,
  proj(x, z, h) { this.px = 256 + (x - 12 * 128) / 4; this.py = 167 - (z - 30 * 128) / 4 - h; },
  npcList: [], npcIds: new Int32Array([4]), npcN: 1, plist: [], pids: new Int32Array(0), pN: 0,
  ht: 0, hn: -1, hox: 0, hoz: 0, htx: 0, htz: 0, hh: 0, chat: -1, modal: -1, rc: false,
  ctype: [0, 0, 0], ctext: ['Welcome to RuneScape.', '', ''],
};
client.npcList[4] = cook;
const pixels = new Int32Array(512 * 334);
ll.configure({ fields: {
  localPlayer: 'lp', entityX: 'ex', entityZ: 'ez', entitySize: 'sz', entityHeight: 'ht2', routeX: 'rx', routeZ: 'rz', primaryAnim: 'anim',
  combatCycle: 'cc', health: 'hp', totalHealth: 'th', faceEntity: 'face', level: 'lvl', baseX: 'bx', baseZ: 'bz',
  npcs: 'npcList', npcIds: 'npcIds', npcCount: 'npcN', npcType: 't', npcName: 'nm', npcLevel: 'lv', npcId: 'id',
  players: 'plist', playerIds: 'pids', playerCount: 'pN', playerName: 'pn', combatLevel: 'pl',
  fontP11: 'p11', fontP12: 'p12', fontB12: 'b12', fontDrawTag: 'tag', fontWidth: 'wid', project: 'proj', projectX: 'px', projectY: 'py',
  hintType: 'ht', hintNpc: 'hn', hintOffsetX: 'hox', hintOffsetZ: 'hoz', hintTileX: 'htx', hintTileZ: 'htz', hintHeight: 'hh',
  chatModal: 'chat', mainModal: 'modal', redrawChat: 'rc', chatType: 'ctype', chatText: 'ctext',
  comId: 'cid', comButtonType: 'bt', comHide: 'hd', comChildren: 'kids', comText: 'txt', comColour: 'col',
}, features: {} });
ll.setApi({ pix: () => ({ pixels, width: 512, height: 334 }), loopCycle: () => 0, ifList: () => L });
const config = {
  listComs: { cook: cookCom, sheep: progress.quests.sheep.com, doric: progress.quests.doric.com }, journal: progress.journal,
  step: { npc: [278], at: [3209, 3215, 0], options: ["What's wrong?"] },
  route: [{ x: 3211, z: 3215, level: 0 }, { x: 3209, z: 3215, level: 0 }],
  showRoute: true, hintArrow: true, highlight: true, markOptions: true, colour: '#00FFFF',
};
cmd({ type: 'plugin-config', id: 'questhelper', enabled: true, config });
const frame = () => { clock += 300; texts.length = 0; ll.__questHelper.poll({ client, npcs: () => ll.readNpcs(client) }); ll.frame(client); };
ll.loggedIn = true;
frame();
let input = posted.filter((m) => m.type === 'questhelper-input').pop();
assert.ok(input, 'input sent');
assert.deepStrictEqual({ ...input.data.list }, {}, 'quest list not trusted straight after login');
clock += 7000;
frame();
input = posted.filter((m) => m.type === 'questhelper-input').pop();
assert.deepStrictEqual({ ...input.data.list }, { cook: 'yellow', sheep: 'red', doric: 'green' });
assert.deepStrictEqual([...input.data.npcs], [278]);
assert.strictEqual(client.ht, 1, 'hint arrow on the Cook');
assert.ok(pixels.some((p) => p !== 0), 'drew something');
// a conversation: its text is sent, the wanted option goes green
client.chat = 2490;
frame();
input = posted.filter((m) => m.type === 'questhelper-input').pop();
assert.ok(/Select an Option/.test(input.data.dialogue) && !/What's wrong/.test(input.data.dialogue), 'options on offer are not sent as dialogue');
assert.strictEqual(L[2492].txt, "@gre@What's wrong?", 'option marked');
assert.strictEqual(L[2493].txt, 'Nice hat!');
frame();
assert.strictEqual(L[2492].txt, "@gre@What's wrong?", 'marked once');
// a numbered option (Dialogue Keys): the colour goes after the number
L[2493].txt = '2. Nice hat!';
cmd({ type: 'plugin-config', id: 'questhelper', enabled: true, config: { ...config, step: { ...config.step, options: ['Nice hat!'] } } });
frame();
assert.strictEqual(L[2493].txt, '2. @gre@Nice hat!');
assert.strictEqual(L[2492].txt, "What's wrong?", 'old mark removed');
// the journal
client.chat = -1;
client.modal = progress.journal.root;
com(progress.journal.lines[0], { txt: '@dbl@I can start this quest by speaking to the @dre@Cook@dbl@ in the' });
frame();
input = posted.filter((m) => m.type === 'questhelper-input').pop();
assert.ok(input.data.journal && /I can start this quest/.test(input.data.journal.lines[0]));
// game messages
client.ctext = ['You operate the hopper. The grain slides down the chute.', 'Welcome to RuneScape.', '', ''];
client.ctype = [0, 0, 0, 0];
frame();
input = posted.filter((m) => m.type === 'questhelper-input').pop();
assert.deepStrictEqual([...input.data.messages], ['You operate the hopper. The grain slides down the chute.']);
// no step: arrow removed
cmd({ type: 'plugin-config', id: 'questhelper', enabled: true, config: { ...config, step: null } });
frame();
assert.strictEqual(client.ht, 0, 'arrow cleared');
console.log('quest helper overlay: ok');
