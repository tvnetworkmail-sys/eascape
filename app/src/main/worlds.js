'use strict';
// The live game's worlds, one subdomain each. EASCAPE_SERVER points the app somewhere else, e.g.
// EASCAPE_SERVER=http://localhost:8888 for a test server: every world then opens on that server.
const net = require('net');

const DOMAIN = '2006rs.com';
const OVERRIDE = (process.env.EASCAPE_SERVER || '').replace(/\/+$/, '');
const SITE = OVERRIDE || `https://${DOMAIN}`;
const OVERRIDE_URL = OVERRIDE ? new URL(OVERRIDE) : null;

// ours: the test server (2006rs.com/test, world 20): its own accounts, set your stats and add items;
// the Test Server panel (ui/panels/testserver.js) shows only there
const TEST_WORLD = 20;
const WORLDS = [
  { id: 1, region: '2006RS', flag: null, members: true },
  { id: 2, region: '2006RS', flag: null, members: true },
  { id: 3, region: '2006RS', flag: null, members: true },
  { id: TEST_WORLD, region: 'Test server', flag: null, members: true, test: true },
];

const liveHost = (id) => (id === TEST_WORLD ? DOMAIN : `w${id}.${DOMAIN}`);
const LIVE_HOSTS = new Set([DOMAIN, ...WORLDS.map((w) => liveHost(w.id))]);

function worldHost(worldId) {
  return OVERRIDE_URL ? OVERRIDE_URL.hostname : liveHost(worldId);
}

function playUrl(worldId, detail = 'high') {
  const base = OVERRIDE || `https://${liveHost(worldId)}`;
  return `${base}${worldId === TEST_WORLD ? '/test' : ''}/rs2.cgi${detail === 'low' ? '?lowmem=1' : ''}`;
}

function isWorldHost(host) {
  return OVERRIDE_URL ? host === OVERRIDE_URL.hostname : LIVE_HOSTS.has(host);
}

/** { worldId: players } from the website's /worlds.json, or {} if it can't be read. */
async function fetchPlayerCounts(fetchFn) {
  try {
    const res = await fetchFn(`${SITE}/worlds.json`);
    if (!res.ok) return {};
    const { worlds } = await res.json();
    return Object.fromEntries(worlds.map((w) => [w.id, w.players]));
  } catch {
    return {};
  }
}

/** Round trip to the world in ms (TCP connect time to its web port), or -1. */
function ping(worldId, timeoutMs = 3000) {
  const port = OVERRIDE_URL ? Number(OVERRIDE_URL.port) || (OVERRIDE_URL.protocol === 'https:' ? 443 : 80) : 443;
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = net.connect({ host: worldHost(worldId), port });
    const done = (ms) => {
      sock.destroy();
      resolve(ms);
    };
    sock.setTimeout(timeoutMs, () => done(-1));
    sock.once('error', () => done(-1));
    sock.once('connect', () => done(Number((process.hrtime.bigint() - start) / 1000000n)));
  });
}

module.exports = { SITE, WORLDS, TEST_WORLD, playUrl, worldHost, isWorldHost, fetchPlayerCounts, ping };
