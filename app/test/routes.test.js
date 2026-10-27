'use strict';
// Every Quest Helper route that has worked (tools/routes/golden.json) must still work, so a
// change to the route data (tools/routes/update.js, a new quest's transports) can't quietly
// break a quest that's been tested.
const { execFileSync } = require('child_process');
const path = require('path');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'routes', 'golden.js'), '--check'], { stdio: 'inherit' });
console.log('quest helper routes: ok');
