'use strict';
// Every Quest Helper route that has worked (tools/routes/golden.json) must still work, so a
// change to the route data (tools/routes/update.js, a new quest's transports) can't quietly
// break a quest that's been tested.
const { execFileSync } = require('child_process');
const path = require('path');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'routes', 'golden.js'), '--check'], { stdio: 'inherit' });
console.log('quest helper routes: ok');

// EASCape: the fairy rings (Fairytale II) are only taken when the player has them: from the
// Zanaris ring to the cosmic entity's plane (code CKP), which only the rings reach
{
  const assert = require('assert');
  const { load } = require(path.join(__dirname, '..', 'src', 'plugins', 'questhelper', 'route'));
  const world = load();
  const from = { x: 2412, z: 4436, level: 0 };
  const to = { x: 2075, z: 4848, level: 0 };
  assert.strictEqual(world.find(from, to, { near: 1, maxNodes: 200000, weight: 2 }), null, 'a route to the cosmic plane without the rings');
  const r = world.find(from, to, { near: 1, maxNodes: 200000, weight: 2, allow: ['fairyrings'] });
  assert.ok(r && r.some((s) => s.via && /fairy_ring/.test(s.via)), 'no route by fairy ring to the cosmic plane');
  console.log('fairy ring routes: ok');
}
