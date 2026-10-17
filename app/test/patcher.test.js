'use strict';
// Checks the patcher and runtime against a miniature bundle with the same shapes as the
// live client. Set LIVE_BUNDLE=/path/to/client.js to also check a real download.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { patchClient } = require('../src/main/patcher');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'src', 'runtime', 'runtime.js'), 'utf8');

const sample = `
class ch { static ['vM'] = Array.from({length: 99}, (_, i) => i * 100); }
class Zz {
  ['qq'] = new Int32Array(25); ['ww'] = new Int32Array(25); ['ee'] = new Int32Array(25);
  ['xF'] = { available: 1 }; ['lM'] = 10; ['SM'] = 20; ['cam'] = null;
  ['cN'](a, b, c, d, e, dist) { this['cam'] = dist; }
  ['pD']() { return 100; }
  ['draw']() { let Y7 = 128, Y8 = 0; this['cN'](Y7,Y8,this['lM'],this['pD']()-0x32,this['SM'],0x3*Y7+0x258); }
  async['AB'](){ return 1; }
  async['BI'](){if(!this['xF'])return!0x1;try{let Y0=this['xF']['available'];
    if(KX['endsWith'](':tradereq:')){}
    let Yj=0x2,Yk=1200,Yh=12;this['qq'][Yj]=Yk,this['ww'][Yj]=Yh,this['ee'][Yj]=0x1;for(let YI=0x0;YI<0x62;YI++)Yk>=ch['vM'][YI]&&(this['ee'][Yj]=YI+0x2);
  }catch(e){}}
}
var KX = '';
globalThis.__game = new Zz();
`;

const { code, info } = patchClient(sample, runtime);
assert.strictEqual(info.readMethod, 'BI');
assert.deepStrictEqual(info.fields, { statXP: 'qq', statEffectiveLevel: 'ww', statBaseLevel: 'ee' });
assert.strictEqual(info.features.zoom, true, 'zoom hook installed');

// Run the patched bundle with a fake window and check the runtime reports correctly.
const posted = [];
const timers = [];
const messageHandlers = [];
let clock = 1000;
const window = {
  postMessage: (m) => posted.push(m),
  addEventListener: (type, fn) => { if (type === 'message') messageHandlers.push(fn); },
};
const ctx = vm.createContext({
  window, setInterval: (fn) => timers.push(fn), setTimeout: () => 0, clearTimeout: () => {}, Int32Array, performance: { now: () => clock }, Array, Object, String, Math, isFinite,
});
vm.runInContext(code, ctx);
assert.ok(posted.some((m) => m.type === 'runtime-ready'), 'runtime announces itself');

// Zoom: default is the original distance (3 * 128 + 600 = 984)
vm.runInContext('globalThis.__game.draw()', ctx);
assert.strictEqual(vm.runInContext('globalThis.__game.cam', ctx), 984);
messageHandlers.forEach((fn) => fn({ source: window, data: { __lostliteCmd: { type: 'zoom', value: 1.5 } } }));
vm.runInContext('globalThis.__game.draw()', ctx);
assert.strictEqual(vm.runInContext('globalThis.__game.cam', ctx), 1476, 'zoom scales the camera distance');

(async () => {
  await vm.runInContext('globalThis.__game.BI()', ctx);
  assert.ok(posted.some((m) => m.type === 'hooked'), 'client captured on first packet read');
  timers.forEach((t) => t());
  assert.ok(posted.some((m) => m.type === 'login-state' && m.data === true), 'reports logged in');
  const stats = posted.find((m) => m.type === 'stats');
  assert.ok(stats, 'stats reported');
  const str = stats.data.find((s) => s.skill === 'strength');
  assert.strictEqual(str.xp, 1200);
  assert.strictEqual(str.boosted, 12);
  assert.strictEqual(str.level, 14);

  clock += 5000; // no packet reads for 5s = logged out
  timers.forEach((t) => t());
  assert.ok(posted.some((m) => m.type === 'login-state' && m.data === false), 'reports logged out');
  console.log('synthetic bundle: ok');

  if (process.env.LIVE_BUNDLE) {
    const live = fs.readFileSync(process.env.LIVE_BUNDLE, 'utf8');
    // The runtime plus every plugin's page part, exactly as the app serves it.
    const r = patchClient(live, require('../src/main/clientLoader').RUNTIME, { drawDistance: 40 });
    for (const k of ['statXP', 'cameraYaw', 'menuCount', 'menuOption', 'menuOpen', 'loginScreen', 'loginUser', 'loginPass',
      'closeModal', 'sideModal', 'chatModal', 'redrawChat', 'dialogInputOpen', 'socialInputOpen',
      'localPlayer', 'level', 'entityX', 'entityZ', 'primaryAnim', 'combatCycle', 'health', 'faceEntity', 'playerName',
      'combatLevel', 'baseX', 'baseZ', 'runEnergy', 'runWeight', 'varps',
      'friendCount', 'friendUserhash', 'friendWorld', 'socialUserhash', 'socialInputHeader', 'addChat', 'chatType', 'chatUsername']) {
      assert.ok(r.info.fields[k], `field ${k} found`);
    }
    assert.strictEqual(r.info.features.login, true, 'login screen hook found');
    assert.strictEqual(r.info.features.player, true, 'player data found');
    assert.strictEqual(r.info.features.social, true, 'private message prompt found');
    assert.strictEqual(r.info.features.overlay, true, 'overlay hooks found');
    assert.strictEqual(r.info.features.entities, true, 'NPC and player data found');
    assert.strictEqual(r.info.features.actions, true, 'menu action numbers found');
    assert.strictEqual(r.info.features.roofs, true, 'roof check found');
    assert.strictEqual(r.info.features.buttons, true, 'orb buttons found');
    assert.ok(r.info.fields.buttons.pause > 0, 'continue button action found');
    for (const k of ['comType', 'comChildren', 'comText', 'comColour']) assert.ok(r.info.fields[k], `field ${k} found`);
    assert.strictEqual(r.info.features.scene, true, 'scene objects found');
    assert.strictEqual(r.info.features.idle, true, 'idle timer found');
    assert.strictEqual(r.info.features.icons, true, 'item icons found');
    assert.strictEqual(r.info.features.spotanim, true, 'spot animations found');
    assert.ok(r.code.includes("registerPlugin('timersandbuffs'"), 'timers & buffs page part included');
    assert.ok(r.code.includes("registerPlugin('opponentinfo'"), 'opponent info page part included');
    for (const id of ['objectindicators', 'groundmarkers', 'woodcutting', 'mining', 'loottracker']) assert.ok(r.code.includes("registerPlugin('" + id + "'") || r.code.includes('__skilling'), id + ' page part included');
    for (const k of ['sceneWorld', 'sceneWall', 'sceneDecor', 'sceneLoc', 'sceneGroundDecor', 'sceneInfo', 'locName']) assert.ok(r.info.fields[k], `field ${k} found`);
    assert.ok(/loc:\(id\)=>/.test(r.code), 'loc type lookup added');
    assert.ok(r.code.includes("registerPlugin('dialoguekeys'"), 'dialogue keys page part included');
    assert.ok(r.code.includes("registerPlugin('questhelper'"), 'quest helper page part included');
    assert.ok(r.code.includes("registerPlugin('xpdrops'"), 'xp drops page part included');
    assert.ok(r.code.includes("registerPlugin('infoboxes'"), 'info boxes page part included');
    for (const k of ['doAction', 'comHide', 'sideIcon', 'activeTab', 'redrawSide', 'redrawIcons', 'comScripts', 'comOperand', 'hintType', 'hintNpc', 'hintTileX', 'hintTileZ']) assert.ok(r.info.fields[k], `field ${k} found`);
    assert.ok(r.code.includes('window.__lostlite.hideRoofs?this['), 'roof hook added');
    const acts = r.info.fields.actions;
    assert.ok(acts.npc.includes(acts.npcExamine) && acts.obj.includes(acts.objExamine) && acts.walk > 0, 'action numbers make sense');
    assert.ok(r.code.includes('window.__lostlite.modelDrawn(this,'), 'model hull hook added');
    assert.ok(r.code.includes("registerPlugin('npcindicators'"), 'NPC Indicators page part included');
    for (const k of ['npcs', 'npcIds', 'npcCount', 'npcType', 'npcName', 'npcLevel', 'npcId', 'players', 'playerIds', 'playerCount', 'entityHeight']) {
      assert.ok(r.info.fields[k], `field ${k} found`);
    }
    assert.ok(r.code.includes('window.__lostlite.frame(this,0),'), 'scene frame hook added');
    assert.ok(r.code.includes('window.__lostlite.frame(this,1),'), 'interface frame hook added');
    assert.ok(r.code.indexOf('window.__lostlite.frame(this,0),') < r.code.indexOf('window.__lostlite.frame(this,1),'), 'scene layer first');
    assert.ok(r.code.includes("registerPlugin('cluescroll'"), 'clue scroll page part included');
    assert.ok(r.code.includes("registerPlugin('grounditems'"), 'ground items page part included');
    for (const k of ['project', 'projectX', 'fontP11', 'fontDrawTag', 'fontWidth', 'groundObj', 'listHead', 'objCost', 'objStackable', 'objCount']) {
      assert.ok(r.info.fields[k], `field ${k} found`);
    }
    assert.ok(/setApi\(\{loopCycle:/.test(r.code), 'loop cycle exposed');
    assert.strictEqual(r.info.features.chat, true, 'chat prompt / close interface found');
    assert.ok(r.code.includes('window.__lostlite&&window.__lostlite.chatPrompt)'), 'chat prompt branch added');
    assert.strictEqual(r.info.features.menu, true, 'menu hook found');
    assert.strictEqual(r.info.features.zoom, true, 'zoom hook found');
    assert.strictEqual(r.info.features.drawDistance, 40, 'draw distance patched');
    assert.strictEqual(r.info.features.rotate, true, 'camera fields found');
    // Still valid JavaScript (the bundle is an ES module, so check it as one).
    const tmp = path.join(require('os').tmpdir(), `lostlite-check-${process.pid}.mjs`);
    fs.writeFileSync(tmp, r.code);
    const check = require('child_process').spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    fs.unlinkSync(tmp);
    assert.strictEqual(check.status, 0, `patched bundle does not parse: ${(check.stderr || '').slice(0, 300)}`);
    console.log('live bundle: ok', JSON.stringify({ readMethod: r.info.readMethod, fields: r.info.fields, features: r.info.features }));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
