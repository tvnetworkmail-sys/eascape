// Runs in the Lost City game page and in every frame inside it (isolated world, so the
// page can't reach any of this). Lost City's page shows the game in an iframe served
// from the world's own host, so each frame works out its role:
//   - website frame (the top page): makes the game iframe fill the window and hides
//     everything else
//   - game frame (the frame with the #canvas): shows only the canvas, fixed size or
//     scaled to fit, forwards the in-page runtime's messages to the app and hosts the
//     game-side half of plugins
// If the top page itself holds the canvas (no iframe), it plays both roles.
const { ipcRenderer } = require('electron');
const path = require('path');
const hotkeys = require('./hotkeys');

const GAME_W = 765;
const GAME_H = 503;
const isTop = window.top === window;
const WORLD_HOST = /^w\d+-2004\.lostcity\.rs$/;

// ------------------------------------------------------------------ settings

let values = {};
let descriptors = [];
let initialised = false;

function defaultFor(group, key) {
  for (const d of descriptors) {
    if (d.config.group !== group) continue;
    const item = d.config.items.find((i) => i.key === key);
    if (item) return item.default;
  }
  return undefined;
}

function cfg(group, key) {
  const v = values[`${group}.${key}`];
  return v === undefined ? defaultFor(group, key) : v;
}

function setCfg(group, key, value) {
  values[`${group}.${key}`] = value;
  ipcRenderer.send('game-set-config', group, key, value);
}

function addStyle(id, css) {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = css;
}

function removeStyle(id) {
  const style = document.getElementById(id);
  if (style) style.remove();
}

// ------------------------------------------------------------------ website frame

let gameFrame = null;

/** The iframe that holds the game: one on a world host, otherwise the largest one. */
function findGameIframe() {
  const frames = [...document.querySelectorAll('iframe')];
  const byHost = frames.find((f) => {
    try { return WORLD_HOST.test(new URL(f.src, location.href).hostname); } catch { return false; }
  });
  if (byHost) return byHost;
  let best = null;
  let area = 0;
  for (const f of frames) {
    const r = f.getBoundingClientRect();
    if (r.width * r.height > area) { area = r.width * r.height; best = f; }
  }
  return area >= 300 * 200 ? best : null;
}

// ------------------------------------------------------------------ the site's own prompts

// On a first visit the site asks you to agree to its rules before the game shows (the game
// itself is already running behind it, music and all). Hiding the website would hide that
// too and leave a black screen, so the website stays visible while such a prompt is up or
// the game canvas isn't shown yet, and is hidden once it's gone.
const AGREE = /\b(i\s*agree|agree|accept)\b/i;

function shown(el) {
  if (!el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function sitePrompt() {
  for (const el of document.querySelectorAll('button, a, input[type=submit], input[type=button], [role=button]')) {
    const text = (el.value || el.textContent || '').trim();
    if (text.length <= 40 && AGREE.test(text) && shown(el)) return text;
  }
  return null;
}

let waitTimer = null;
let waitLogged = false;

/** True while the page must stay as the site shows it; re-checks until it's clear. */
function mustShowSite(what) {
  const prompt = sitePrompt();
  const hidden = what && !shown(what);
  if (!prompt && !hidden) {
    if (waitTimer) {
      clearInterval(waitTimer);
      waitTimer = null;
      ipcRenderer.send('game-event', { type: 'log', data: 'Website prompt gone; hiding the website again' });
    }
    return false;
  }
  if (!waitLogged) {
    waitLogged = true;
    ipcRenderer.send('game-event', { type: 'log', data: prompt ? `Website is asking "${prompt}"; showing it until you answer` : 'Game not shown yet; showing the website' });
  }
  if (!waitTimer) {
    waitTimer = setInterval(() => {
      applyWebsiteFrame();
      applyGameFrame();
    }, 500);
  }
  return true;
}

function applyWebsiteFrame() {
  if (!gameFrame) return;
  if (!cfg('lostlite', 'hideWebsite') || mustShowSite(null)) {
    removeStyle('lostlite-website');
    gameFrame.removeAttribute('data-lostlite-game');
    return;
  }
  gameFrame.setAttribute('data-lostlite-game', '');
  addStyle('lostlite-website', `
    html, body { margin: 0 !important; background: #000 !important; overflow: hidden !important; }
    body * { visibility: hidden !important; }
    iframe[data-lostlite-game] {
      visibility: visible !important;
      position: fixed !important; inset: 0 !important;
      width: 100vw !important; height: 100vh !important;
      max-width: none !important; max-height: none !important;
      margin: 0 !important; border: 0 !important; padding: 0 !important;
      transform: none !important; z-index: 2147483647 !important;
    }`);
  // position:fixed is relative to the nearest transformed ancestor; lift the frame out
  // to <body> if the page has one. (Moving an iframe reloads it, so only when needed.)
  for (let el = gameFrame.parentElement; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || cs.contain.includes('paint')) {
      ipcRenderer.send('game-event', { type: 'log', data: 'Game frame is inside a transformed element; layout may be off' });
      break;
    }
  }
}

// ------------------------------------------------------------------ game frame

let canvas = null;

// 2007RS: the 2007 client's page is just the canvas (centred), and the client scales it to the
// window itself (webclient/src/client/DisplayScale.ts), with HD's full-resolution view under it.
// So the page is only made black and borderless, with the game in the middle, and the Game size
// setting goes to the client (displaySettings).
function applyGameFrame() {
  if (!canvas) return;
  if (!cfg('lostlite', 'hideWebsite')) {
    removeStyle('lostlite-game');
    return;
  }
  addStyle('lostlite-game', `
    html, body { margin: 0 !important; background: #000 !important; overflow: hidden !important; }
    body > center { display: flex !important; align-items: center !important; justify-content: center !important; height: 100vh !important; }
    #game { margin: 0 !important; }`);
  sendDisplay();
}

function resize() {}

/** The client's display settings from LostLite > Game Area: { scale, hd?, fps, snow }. */
function displaySettings() {
  const size = cfg('lostlite', 'gameSize');
  const scale = size === 'fit' ? (cfg('lostlite', 'pixelated') ? 'pixel' : 'smooth') : 'off';
  const out = { scale, fps: !!cfg('lostlite', 'showFps'), snow: cfg('lostlite', 'showChristmasSnow') !== false };
  const renderer = cfg('lostlite', 'renderer');
  if (renderer === 'hd') out.hd = true;
  else if (renderer === 'sd') out.hd = false;
  return out;
}

function sendDisplay() {
  if (canvas) sendToGame({ type: 'display', display: displaySettings() });
}

/** Converts a mouse position in this frame to game pixels (0..764, 0..502), or null. */
function toGamePoint(clientX, clientY) {
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const x = ((clientX - r.left) * GAME_W) / r.width;
  const y = ((clientY - r.top) * GAME_H) / r.height;
  if (x < 0 || y < 0 || x >= GAME_W || y >= GAME_H) return null;
  return { x, y };
}

// ------------------------------------------------------------------ finding things

function scan() {
  const c = document.getElementById('canvas');
  if (c && c !== canvas) {
    canvas = c;
    ipcRenderer.send('game-event', { type: 'log', data: `Game canvas found (${isTop ? 'top page' : `frame ${location.host}`})` });
    applyGameFrame();
    startPlugins();
  }
  if (isTop && !canvas) {
    const f = findGameIframe();
    if (f && f !== gameFrame) {
      gameFrame = f;
      ipcRenderer.send('game-event', { type: 'log', data: `Game frame found: ${f.src || '(no src)'}` });
      applyWebsiteFrame();
    }
  }
}

const observer = new MutationObserver(() => scan());
document.addEventListener('DOMContentLoaded', () => {
  scan();
  observer.observe(document.documentElement, { childList: true, subtree: true });
});
window.addEventListener('load', scan);
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ runtime messages

let runtimeReady = false;
const runtimeListeners = new Set();

window.addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== window || !m || m.__lostlite !== true || typeof m.type !== 'string') return;
  ipcRenderer.send('game-event', { type: m.type, data: m.data });
  if (m.type === 'runtime-ready') runtimeReady = true;
  for (const fn of runtimeListeners) safe(() => fn(m.type, m.data));
  if (m.type === 'runtime-ready') sendDisplay();
  if (m.type === 'runtime-ready' || m.type === 'hooked' || m.type === 'login-state') {
    for (const p of running.values()) if (p.gameReady) safe(() => p.gameReady());
  }
});

function sendToGame(cmd) {
  window.postMessage({ __lostliteCmd: cmd }, '*');
}

// Esc closes the open interface (bank, shop, ...) the way its Close button does. This
// listens in the bubble phase, so a plugin that is using Esc itself (the bank search
// clears its text with it) stops it first.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.repeat || !canvas || !cfg('lostlite', 'escCloses')) return;
  sendToGame({ type: 'close-interface' });
});

// ------------------------------------------------------------------ plugins (game side)

const running = new Map();
const factories = new Map();
let pluginsWanted = false;

function safe(fn) {
  try {
    fn();
  } catch (e) {
    ipcRenderer.send('game-event', { type: 'runtime-error', data: `plugin: ${e && e.stack ? e.stack.split('\n')[0] : e}` });
  }
}

const hotkeyManager = hotkeys.createManager(typeof window !== 'undefined' ? window : null);

function contextFor(p) {
  return {
    /** A hotkey (3.6) from one of the plugin's "hotkey" settings: { pressed(e), released(e),
     *  when() (only then), consume (default true: the game doesn't also get the key) }.
     *  Returns a remover. */
    hotkey: (key, handlers) => hotkeyManager.add(() => cfg(p.group, key), handlers),
    /** Does this key event match a hotkey setting value ("Ctrl+M")? */
    matchesHotkey: (e, spec) => hotkeys.matches(e, spec),
    config: (key) => cfg(p.group, key),
    state: (key, fallback) => {
      const v = cfg(p.group, key);
      return v === undefined ? fallback : v;
    },
    setState: (key, value) => setCfg(p.group, key, value),
    /** Every saved value of the plugin's own group ({ key: value }). */
    groupValues: (group = p.group) => {
      const out = {};
      const pre = `${group}.`;
      for (const [k, v] of Object.entries(values)) if (k.startsWith(pre)) out[k.slice(pre.length)] = v;
      return out;
    },
    /** A setting in another group (the main process only lets plugin groups be written). */
    setConfig: (group, key, value) => setCfg(group, key, value),
    sendToGame,
    toGamePoint,
    /** Screen pixels per game pixel (1 at fixed size, more when scaled up). */
    toGameScale: () => {
      const r = canvas && canvas.getBoundingClientRect();
      return r && r.width ? r.width / GAME_W : 1;
    },
    runtimeReady: () => runtimeReady,
    /** Listen to messages from the in-page runtime: fn(type, data). Returns an unsubscribe. */
    onRuntime: (fn) => {
      runtimeListeners.add(fn);
      return () => runtimeListeners.delete(fn);
    },
    /** Ask the app for something (only the channels listed here). */
    invoke: (channel, ...args) => (['login-screen-image', 'login-pass-get', 'login-pass-set', 'route-find', 'notify', 'worlds-get', 'worlds-ping', 'world-hop', 'screenshot-save', 'screenshot-open-folder'].includes(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.reject(new Error('not allowed'))),
    /** The game canvas element (for placing overlays), or null. */
    canvas: () => canvas,
    /** A bundled font as a data: URL, for use inside the game page. */
    fontUrl: (file) => {
      const fs = require('fs');
      const data = fs.readFileSync(path.join(__dirname, '..', 'ui', 'assets', 'fonts', file));
      return 'data:font/ttf;base64,' + data.toString('base64');
    },
    log: (msg) => ipcRenderer.send('game-event', { type: 'log', data: `[${p.id}] ${msg}` }),
    /** A desktop notification (if the user allows them; see LostLite > Notifications). */
    notify: (title, body) => {
      // like RuneLite's "game message notification": shown in the chat box even when the
      // window is in front (where the desktop one isn't by default)
      if (cfg('lostlite', 'notifications') && cfg('lostlite', 'gameMessageNotification')) sendToGame({ type: 'game-message', text: String(body || title || '') });
      const flash = cfg('lostlite', 'flash');
      if (cfg('lostlite', 'notifications') && flash && flash !== 'off') {
        const alpha = Math.round((Math.max(5, Math.min(100, Number(cfg('lostlite', 'flashOpacity')) || 27)) / 100) * 255);
        const rgb = /([0-9a-f]{6})$/i.exec(String(cfg('lostlite', 'flashColour') || '')) || [null, 'FF0000'];
        sendToGame({ type: 'flash', mode: flash, colour: `#${alpha.toString(16).padStart(2, '0')}${rgb[1]}` });
      }
      return ipcRenderer.invoke('notify', title, body).catch(() => false);
    },
    /** Whether the plugin is switched on (for the overlay core, which runs either way). */
    enabled: () => isEnabled(p.id),
    /** Live state for the plugin's sidebar panel (replaces what was reported before). */
    report: (data) => ipcRenderer.send('game-event', { type: 'plugin-state', data: { id: p.id, state: data } }),
  };
}

function isEnabled(id) {
  const d = descriptors.find((x) => x.id === id);
  if (!d) return false;
  if (d.alwaysOn) return true;
  const v = values[`lostlite.${id}Plugin`];
  return v === undefined ? d.enabledByDefault !== false : !!v;
}

/** Plugins only run in the frame that holds the game canvas. */
function startPlugins() {
  pluginsWanted = true;
  sync();
}

const coreEnabled = new Map();

function sync() {
  if (!initialised || !pluginsWanted) return;
  for (const [id, factory] of factories) {
    // the overlay core (OverlayManager / InfoBoxManager, hosted by Info Boxes) always runs; its
    // own boxes follow the plugin's switch, told through configChanged('pluginEnabled')
    const on = isEnabled(id) || !!factory.plugin.core;
    if (factory.plugin.core && running.has(id) && coreEnabled.get(id) !== isEnabled(id)) {
      const inst = running.get(id);
      if (inst.configChanged) safe(() => inst.configChanged('pluginEnabled'));
    }
    if (factory.plugin.core) coreEnabled.set(id, isEnabled(id));
    if (on && !running.has(id)) {
      safe(() => {
        const inst = factory.create(contextFor(factory.plugin));
        running.set(id, inst);
        if (inst.start) inst.start();
      });
    } else if (!on && running.has(id)) {
      const inst = running.get(id);
      running.delete(id);
      if (inst.stop) safe(() => inst.stop());
    }
  }
}

ipcRenderer.invoke('game-init').then((init) => {
  values = init.values;
  descriptors = init.descriptors;
  for (const p of init.plugins) {
    safe(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const create = require(path.join(__dirname, '..', 'plugins', p.game));
      factories.set(p.id, { create, plugin: p });
    });
  }
  initialised = true;
  applyWebsiteFrame();
  applyGameFrame();
  sync();
});

// a RuneLite clone's sidebar panel acting on the plugin (api.js: onPanelAction)
ipcRenderer.on('panel-action', (_e, m) => {
  if (m && typeof m.id === 'string') sendToGame({ type: 'plugin-panel', id: m.id, data: m.data });
});

ipcRenderer.on('config-changed', (_e, c) => {
  const k = `${c.group}.${c.key}`;
  if (c.value === undefined) delete values[k];
  else values[k] = c.value;
  if (c.group === 'lostlite') {
    if (/Plugin$/.test(c.key)) sync();
    if (['gameSize', 'pixelated', 'renderer', 'showFps', 'showChristmasSnow'].includes(c.key)) sendDisplay();
    if (['hideWebsite', 'gameSize', 'pixelated'].includes(c.key)) {
      applyWebsiteFrame();
      applyGameFrame();
    }
  }
  for (const [id, inst] of running) {
    const f = factories.get(id);
    if (f && f.plugin.group === c.group && inst.configChanged) safe(() => inst.configChanged(c.key));
  }
});
