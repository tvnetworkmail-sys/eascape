'use strict';
// EASCape: one world, our own server. By default that's the server start.bat runs on this PC
// (port 80, the server's default on Windows). EASCAPE_SERVER points the app somewhere else,
// e.g. EASCAPE_SERVER=http://localhost:8888 (the default port on Linux) or, later, the
// address of the hosted server.
const net = require('net');

const SITE = (process.env.EASCAPE_SERVER || 'http://localhost').replace(/\/+$/, '');
const SITE_URL = new URL(SITE);
const PORT = Number(SITE_URL.port) || (SITE_URL.protocol === 'https:' ? 443 : 80);

const WORLDS = [
  { id: 1, region: 'EASCape', flag: null, members: true },
];

function playUrl(_worldId, detail = 'high') {
  return `${SITE}/rs2.cgi${detail === 'low' ? '?lowmem=1' : ''}`;
}

function worldHost(_worldId) {
  return SITE_URL.hostname;
}

function isWorldHost(host) {
  return host === SITE_URL.hostname;
}

/** No world list page on our server; the sidebar shows no count. */
async function fetchPlayerCounts(_fetchFn) {
  return {};
}

/** Round trip to the server in ms (TCP connect time to its web port), or -1. */
function ping(_worldId, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = net.connect({ host: SITE_URL.hostname, port: PORT });
    const done = (ms) => {
      sock.destroy();
      resolve(ms);
    };
    sock.setTimeout(timeoutMs, () => done(-1));
    sock.once('error', () => done(-1));
    sock.once('connect', () => done(Number((process.hrtime.bigint() - start) / 1000000n)));
  });
}

module.exports = { SITE, WORLDS, playUrl, worldHost, isWorldHost, fetchPlayerCounts, ping };
