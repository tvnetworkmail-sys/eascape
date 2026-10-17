'use strict';
// Serves the EASCape client with the app's runtime in front of it.
//
// Every request from the game view passes through untouched, except the client itself
// (/client/client.js on our server): that one is fetched fresh and the runtime (plus the
// page-side part of each plugin) is put in front of it. Nothing in the client is patched:
// EASCape's client has the hooks built in (webclient/src/client/LostLite.ts) and tells the
// runtime what it has when it starts. If the download fails the request goes through as is.
const fs = require('fs');
const path = require('path');
const { isWorldHost } = require('./worlds');

// The runtime, then the page-side part(s) of each plugin that has one (they register
// themselves with the runtime; their sidebar half switches them on).
const RUNTIME = [fs.readFileSync(path.join(__dirname, '..', 'runtime', 'runtime.js'), 'utf8')]
  .concat(require('../plugins').filter((d) => d.page).flatMap((d) => [].concat(d.page).map((p) => fs.readFileSync(path.join(__dirname, '..', 'plugins', p), 'utf8'))))
  .join('\n;\n');

function install(ses, onStatus, _getOptions = () => ({})) {
  const handler = async (request) => {
    const url = new URL(request.url);
    const passthrough = () => ses.fetch(request, { bypassCustomProtocolHandlers: true });
    if (!isWorldHost(url.hostname) || url.pathname !== '/client/client.js') {
      return passthrough();
    }
    try {
      const original = await ses.fetch(request.url, { bypassCustomProtocolHandlers: true, cache: 'no-store' });
      if (!original.ok) return original;
      const src = await original.text();
      const headers = new Headers(original.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('content-type', 'text/javascript; charset=utf-8');
      headers.set('cache-control', 'no-store');
      onStatus({ type: 'client-patched', host: url.host, readMethod: 'built in', fields: {}, features: {}, warnings: [], length: src.length });
      return new Response(`${RUNTIME}\n;\n${src}`, { status: 200, headers });
    } catch (e) {
      onStatus({ type: 'client-patch-failed', host: url.host, error: 'download failed: ' + (e.message || e) });
      return passthrough();
    }
  };
  ses.protocol.handle('http', handler);
  ses.protocol.handle('https', handler);
}

module.exports = { install, RUNTIME };
