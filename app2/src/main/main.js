'use strict';
// LostLite main process. Mirrors RuneLite's ClientUI: a frameless window with our own
// title bar, the game on the left, and on the right a tab strip that opens 242px-wide
// plugin panels. Two views share the window:
//   chromeView - fills the window and draws the title bar, tab strip and panels
//   gameView   - sits on top of chromeView in the game area and runs Lost City's client
const { app, BaseWindow, WebContentsView, session, ipcMain, shell, dialog, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { ConfigManager } = require('./config');
const { Logger } = require('./logger');
const { PluginManager } = require('./plugins');
const clientLoader = require('./clientLoader');
const worlds = require('./worlds');
const updater = require('./updater');
const { Secrets } = require('./secrets');
const { loginPasswordHandlers } = require('./loginPassword');

// RuneLite's ClientUI: FlatTitlePane (23 px: TitlePane.buttonSize 33 x 23), a 4 px DARKER_GRAY
// border round the content unless maximized, the sidebar JTabbedPane on the right with 26 px tabs
// plus the 1 px content separator, and plugin panels PluginPanel.PANEL_WIDTH (225) +
// SCROLLBAR_WIDTH (17) wide.
const TITLE_H = 23;
const BORDER = 4;
const TAB_W = 27;
const PANEL_W = 242;
const GAME_W = 765;
const GAME_H = 503;

let win;
let chromeView;
let gameView;
let config;
let log;
let plugins;
let secrets;
let loginPassword;
let closing = false;

const state = {
  world: null,
  client: null,
  hooked: false,
  loggedIn: false,
  stats: null,
  player: null,
  items: null,
  entities: null,
  activePanel: null,
  sidebarOpen: true,
  update: null,
};

// ------------------------------------------------------------------ helpers

function emit(type, data) {
  if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send('event', { type, data });
}

// The game runs in an iframe inside Lost City's page, so messages go to every frame.
function sendGame(channel, data) {
  if (!gameView || gameView.webContents.isDestroyed()) return;
  for (const frame of gameView.webContents.mainFrame.framesInSubtree) {
    try {
      frame.send(channel, data);
    } catch { /* frame navigating away */ }
  }
}

function core(key) {
  return plugins.value('lostlite', key);
}

function sideWidth() {
  if (!state.sidebarOpen) return 0;
  return TAB_W + (state.activePanel ? PANEL_W : 0);
}

function border() {
  return win && (win.isMaximized() || win.isFullScreen()) ? 0 : BORDER;
}

function layout() {
  if (!win) return;
  const { width, height } = win.getContentBounds();
  const b = border();
  chromeView.setBounds({ x: 0, y: 0, width, height });
  gameView.setBounds({ x: b, y: TITLE_H + b, width: Math.max(1, width - sideWidth() - 2 * b), height: Math.max(1, height - TITLE_H - 2 * b) });
}

function minContent() {
  return { width: GAME_W + sideWidth() + 2 * BORDER, height: GAME_H + TITLE_H + 2 * BORDER };
}

function updateMinSize() {
  const m = minContent();
  const b = win.getBounds();
  const c = win.getContentBounds();
  win.setMinimumSize(m.width + (b.width - c.width), m.height + (b.height - c.height));
}

function setTitle() {
  const t = `2006RS-2${state.world ? ` - World ${state.world}` : ''}`;
  if (!win || win.isDestroyed()) return;
  win.setTitle(t);
  emit('patch', { title: t });
}

/** Matches an input event against a hotkey string like "Ctrl+Shift+F11". */
function matchesHotkey(input, hotkey) {
  if (!hotkey || input.type !== 'keyDown') return false;
  const parts = hotkey.split('+');
  const key = parts.pop();
  const mods = new Set(parts);
  return input.key.toLowerCase() === key.toLowerCase()
    && input.control === mods.has('Ctrl')
    && input.shift === mods.has('Shift')
    && input.alt === mods.has('Alt')
    && input.meta === mods.has('Meta');
}

// ------------------------------------------------------------------ sidebar

/** The sidebar changed width: like RuneLite's ContainableFrame (expandResizeType KEEP_GAME_SIZE),
 *  the window grows or shrinks by the difference, to the right if there's room, otherwise left. */
function sideChanged(before) {
  const delta = sideWidth() - before;
  if (delta && !win.isMaximized() && !win.isFullScreen()) {
    const b = win.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    let x = b.x;
    if (delta > 0 && b.x + b.width + delta > area.x + area.width) x = Math.max(area.x, b.x - delta);
    updateMinSize();
    win.setBounds({ x, y: b.y, width: b.width + delta, height: b.height });
  }
  updateMinSize();
  layout();
}

function setActivePanel(id) {
  const before = sideWidth();
  state.activePanel = id || null;
  config.set('lostlite', 'activePanel', state.activePanel || '');
  sideChanged(before);
  emit('patch', { activePanel: state.activePanel });
}

/** The title bar's sidebar button (and the sidebar hotkey): hides or shows the whole sidebar,
 *  as ClientUI.toggleSidebar does (saved as "clientSidebarClosed"). */
function setSidebarOpen(open) {
  const before = sideWidth();
  state.sidebarOpen = !!open;
  config.set('lostlite', 'clientSidebarClosed', !state.sidebarOpen);
  sideChanged(before);
  emit('patch', { sidebarOpen: state.sidebarOpen });
}

function toggleSidebar() {
  setSidebarOpen(!state.sidebarOpen);
}

// ------------------------------------------------------------------ worlds

function loadWorld(id) {
  const w = worlds.WORLDS.find((x) => x.id === id) || worlds.WORLDS[0];
  state.world = w.id;
  state.hooked = false;
  state.loggedIn = false;
  state.client = null;
  state.stats = null;
  state.player = null;
  state.items = null;
  state.entities = null;
  config.set('lostlite', 'world', w.id);
  log.info(`Opening world ${w.id} (${w.region})`);
  setTitle();
  emit('patch', { world: w.id, hooked: false, loggedIn: false, client: null, stats: null, player: null, items: null });
  // LOSTLITE_GAME_URL lets developers point the game view at a test page.
  gameView.webContents.loadURL(process.env.LOSTLITE_GAME_URL || worlds.playUrl(w.id, 'high'));
}

async function confirmLeaveGame(message) {
  if (!state.loggedIn) return true;
  const r = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Yes', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: '2006RS-2',
    message,
    detail: 'You are logged in. Log out in game first to avoid leaving your character standing in the world.',
  });
  return r.response === 0;
}

// ------------------------------------------------------------------ window

function createWindow() {
  const gameSession = session.fromPartition('persist:eascape-game');
  // EASCape: the server gives the app's extras only to a connection that says it's the app
  gameSession.setUserAgent(`${gameSession.getUserAgent()} EASCapeApp/${app.getVersion()}`);
  clientLoader.install(gameSession, (status) => {
    state.client = status;
    if (status.type === 'client-patched') {
      // 2007RS: the client says what it has once it starts (runtime-ready)
      log.info(`Client from ${status.host}: the app's runtime and plugins added in front of it`);
      for (const w of status.warnings || []) log.warn(w);
    } else {
      log.error(`Client from ${status.host} NOT hooked: ${status.error}`);
    }
    emit('patch', { client: status });
  }, () => ({
    drawDistance: plugins.isEnabled('camera') ? plugins.value('camera', 'drawDistance') : 25,
  }));

  state.activePanel = config.get('lostlite', 'activePanel', 'info') || null;
  state.sidebarOpen = !config.get('lostlite', 'clientSidebarClosed', false);
  let saved = core('rememberWindow') ? config.get('lostlite', 'windowBounds', null) : null;
  // Ignore a saved position that is no longer on any screen (monitor unplugged etc.).
  if (saved) {
    const area = screen.getDisplayMatching(saved).workArea;
    const visible = saved.x < area.x + area.width - 50 && saved.x + saved.width > area.x + 50
      && saved.y >= area.y - 10 && saved.y < area.y + area.height - 50;
    if (!visible) saved = { ...saved, x: undefined, y: undefined };
    saved.width = Math.min(saved.width, area.width);
    saved.height = Math.min(saved.height, area.height);
  }
  const min = minContent();

  win = new BaseWindow({
    width: saved ? saved.width : min.width,
    height: saved ? saved.height : min.height,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    useContentSize: !saved,
    frame: false,
    show: false,
    backgroundColor: '#1e1e1e', // ColorScheme.DARKER_GRAY_COLOR
    title: '2006RS-2',
    icon: path.join(__dirname, '..', 'ui', 'assets', 'icons', 'logo_256.png'),
  });
  if (saved && saved.maximized) win.maximize();
  win.setAlwaysOnTop(!!core('alwaysOnTop'));

  chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'chrome.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  gameView = new WebContentsView({
    webPreferences: {
      session: gameSession,
      preload: path.join(__dirname, '..', 'preload', 'game.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // the preload loads plugin modules from the app
      nodeIntegrationInSubFrames: true, // run the preload in the game's iframe too
      backgroundThrottling: false,
    },
  });
  gameView.setBackgroundColor('#000000');
  win.contentView.addChildView(chromeView);
  win.contentView.addChildView(gameView);
  updateMinSize();
  layout();

  win.on('resize', () => {
    layout();
    rememberBounds();
  });
  win.on('move', rememberBounds);
  for (const ev of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    win.on(ev, () => {
      layout();
      rememberBounds();
      emit('patch', { maximized: win.isMaximized() });
    });
  }
  win.on('focus', () => {
    win.flashFrame(false);
    emit('patch', { focused: true });
  });
  win.on('blur', () => emit('patch', { focused: false }));
  win.on('close', async (e) => {
    if (closing || !core('confirmClose') || !state.loggedIn) return;
    e.preventDefault();
    if (await confirmLeaveGame('Are you sure you want to close 2006RS-2?')) {
      closing = true;
      win.close();
    }
  });
  win.on('closed', () => app.quit());

  // Sidebar hotkey works whichever view has focus.
  for (const wc of [chromeView.webContents, gameView.webContents]) {
    wc.on('before-input-event', (e, input) => {
      if (matchesHotkey(input, core('sidebarToggleKey'))) {
        e.preventDefault();
        toggleSidebar();
      }
    });
  }

  // Links that try to open new windows (hiscores, forums) go to the system browser.
  const external = ({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  };
  gameView.webContents.setWindowOpenHandler(external);
  chromeView.webContents.setWindowOpenHandler(external);
  chromeView.webContents.on('will-navigate', (e) => e.preventDefault());

  const gwc = gameView.webContents;
  // EASCape: the game has the keyboard from the start, so you can type without clicking it
  gwc.on('did-finish-load', () => gwc.focus());
  gwc.on('did-navigate', (_e, url) => log.info(`Game page: ${url}`));
  gwc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    log.error(`Failed to load ${url}: ${desc} (${code})`);
    // EASCape: the server may still be starting (start.bat opens the app straight away), so
    // show a waiting page and try again every few seconds
    if (!isMain || code === -3) return;
    const html = '<body style="margin:0;background:#000;color:#ff981f;font:16px Arial;display:flex;align-items:center;justify-content:center;height:100vh">'
      + 'Waiting for the 2006RS server at ' + worlds.SITE + ' ...</body>';
    gwc.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
    // (the app may have been closed while it waited)
    setTimeout(() => {
      if (gameView && win && !win.isDestroyed() && !gameView.webContents.isDestroyed()) loadWorld(state.world || worlds.WORLDS[0].id);
    }, 3000);
  });
  gwc.on('render-process-gone', (_e, d) => log.error(`Game page crashed: ${d.reason}`));
  gwc.on('console-message', (...args) => {
    const ev = args[0];
    const level = typeof args[1] === 'number' ? args[1] : ev.level;
    const message = typeof args[2] === 'string' ? args[2] : ev.message;
    if (level === 3 || level === 'error') log.warn(`Game console: ${message}`);
  });

  chromeView.webContents.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  chromeView.webContents.once('did-finish-load', () => win.show());
  loadWorld(worlds.WORLDS[0].id);
  setTitle();
}

function rememberBounds() {
  if (!core('rememberWindow') || !win) return;
  const maximized = win.isMaximized();
  const b = maximized ? (config.get('lostlite', 'windowBounds', null) || win.getNormalBounds()) : win.getBounds();
  config.set('lostlite', 'windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height, maximized });
}

// ------------------------------------------------------------------ IPC: game page

ipcMain.on('game-event', (e, ev) => {
  if (!gameView || e.sender !== gameView.webContents) return;
  switch (ev.type) {
    case 'hooked':
      state.hooked = true;
      log.info('Live client captured - 2006RS-2 is connected to the game');
      emit('patch', { hooked: true });
      break;
    case 'login-state':
      state.loggedIn = !!ev.data;
      log.info(state.loggedIn ? 'Logged in' : 'Logged out');
      if (!state.loggedIn) {
        state.stats = null;
        state.player = null;
        state.items = null;
        state.entities = null;
      }
      emit('patch', { loggedIn: state.loggedIn, stats: state.stats, player: state.player, items: state.items, entities: state.entities });
      break;
    case 'stats':
      state.stats = ev.data;
      emit('patch', { stats: state.stats });
      break;
    case 'player':
      state.player = ev.data;
      emit('patch', { player: state.player });
      break;
    case 'items':
      state.items = ev.data;
      emit('patch', { items: state.items });
      break;
    case 'entities':
      state.entities = ev.data;
      emit('patch', { entities: state.entities });
      break;
    case 'runtime-ready': {
      for (const w of (ev.data && ev.data.warnings) || []) log.warn(w);
      // 2007RS: the client's own account of its hooks, for the log and the Info panel
      const f = (ev.data && ev.data.features) || {};
      state.client = Object.assign({ type: 'client-patched', host: (state.client && state.client.host) || '' }, ev.data || {});
      log.info(`Client hooked (${(ev.data && ev.data.readMethod) || 'built in'}): zoom ${f.zoom ? 'yes' : 'no'}, draw distance up to ${f.drawDistance || 25} tiles, menu ${f.menu ? 'yes' : 'no'}, overlays ${f.overlay ? 'yes' : 'no'}, HD ${f.hd ? 'yes' : 'no'}`);
      emit('patch', { client: state.client });
      break;
    }
    case 'runtime-error':
      log.warn(`Runtime error: ${ev.data}`);
      break;
    case 'chat':
      state.chat = [...(state.chat || []), ev.data].slice(-30);
      emit('patch', { chat: state.chat });
      break;
    case 'plugin-state':
      if (ev.data && typeof ev.data.id === 'string' && plugins.get(ev.data.id)) {
        state.pluginState = { ...(state.pluginState || {}), [ev.data.id]: ev.data.state };
        emit('patch', { pluginState: state.pluginState });
      }
      break;
    case 'log':
      log.info(String(ev.data));
      break;
    default:
  }
});

ipcMain.handle('game-init', () => ({
  plugins: plugins.list().filter((d) => d.game).map((d) => ({ id: d.id, game: d.game, group: d.config.group, core: !!d.overlayCore })),
  descriptors: plugins.snapshot(),
  values: config.all(),
}));

// Login Screen (RuneLite's): the custom background, RuneLite's login.png in the app's data folder (RUNELITE_DIR)
ipcMain.handle('login-screen-image', (e) => {
  if (!gameView || e.sender !== gameView.webContents) return null;
  try {
    return fs.readFileSync(path.join(app.getPath('userData'), 'login.png')).toString('base64');
  } catch {
    return null;
  }
});

// Login Screen, 2007RS section (the user's own Remember password, kept by request): the remembered password. Only
// the game page's login plugin asks for it, only when "Remember password" is ticked (rules in loginPassword.js).
ipcMain.handle('login-pass-get', (e) => (loginPassword ? loginPassword.get(e) : ''));
ipcMain.handle('login-pass-set', (e, pass) => (loginPassword ? loginPassword.set(e, pass) : false));

// Desktop notifications (3.4), like RuneLite's Notifier: only while the window isn't in
// front unless you ask, with the system sound and a flashing taskbar button.
function notify(title, body) {
  if (!core('notifications')) return false;
  const focused = win && win.isFocused() && !win.isMinimized();
  if (focused && !core('notifyWhenFocused')) {
    log.info(`Notification not shown (2006RS-2 is in front; see Notify when focused): ${body || title}`);
    return false;
  }
  try {
    if (Notification.isSupported()) {
      const n = new Notification({ title: String(title || '2006RS-2').slice(0, 80), body: String(body || '').slice(0, 300), silent: !core('notificationSound') });
      n.on('click', () => {
        if (win) {
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      });
      n.show();
    } else {
      // no desktop notifications on this system: show it in the window
      emit('toast', { title: String(title || '2006RS-2').slice(0, 80), body: String(body || '').slice(0, 300) });
    }
    if (core('flashTaskbar') && win && !focused) win.flashFrame(true);
    log.info(`Notification: ${title}${body ? ` - ${body}` : ''}`);
    return true;
  } catch (e) {
    log.warn(`Notification failed: ${e.message}`);
    return false;
  }
}

ipcMain.handle('notify', (e, title, body) => {
  if (!gameView || e.sender !== gameView.webContents) return false;
  return notify(title, body);
});

// RuneLite's ImageCapture.saveScreenshot (Screenshot plugin): <userData>/screenshots/<player>/<subDir>/<name> <date>.png,
// "(n)" added while the file exists; optionally also put on the clipboard. Only the game view may save.
const SCREENSHOT_DIR = () => path.join(app.getPath('userData'), 'screenshots');
const safePart = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/^\.+/, '').trim().slice(0, 120);
ipcMain.handle('screenshot-save', (e, req) => {
  if (!gameView || e.sender !== gameView.webContents || !req || typeof req.png !== 'string') return null;
  try {
    let dir = SCREENSHOT_DIR();
    if (req.player) dir = path.join(dir, safePart(req.player), safePart(req.subDir));
    fs.mkdirSync(dir, { recursive: true });
    const name = safePart(req.fileName) || 'screenshot';
    let file = path.join(dir, `${name}.png`);
    for (let i = 1; fs.existsSync(file); i++) file = path.join(dir, `${name}(${i}).png`);
    const buf = Buffer.from(req.png.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(file, buf);
    if (req.clipboard) {
      const { clipboard, nativeImage } = require('electron');
      clipboard.writeImage(nativeImage.createFromBuffer(buf));
    }
    return file;
  } catch (err) {
    log.warn(`Screenshot failed: ${err.message}`);
    return null;
  }
});
ipcMain.handle('screenshot-open-folder', (e) => {
  if (!gameView || e.sender !== gameView.webContents) return false;
  fs.mkdirSync(SCREENSHOT_DIR(), { recursive: true });
  shell.openPath(SCREENSHOT_DIR());
  return true;
});

// Quest Helper routes, worked out in a worker thread (so the game never waits on them).
let routeWorker = null;
let routeSeq = 0;
const routeWaiting = new Map();
function findRoute(args) {
  if (!routeWorker) {
    const { Worker } = require('worker_threads');
    // (unpacked from the app archive, so the worker can load it and the route data)
    routeWorker = new Worker(path.join(__dirname, 'routeWorker.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`));
    routeWorker.on('message', (m) => {
      const done = routeWaiting.get(m.id);
      routeWaiting.delete(m.id);
      if (m.error) log.warn(`Route: ${m.error}`);
      if (done) done(m);
    });
    routeWorker.on('error', (e) => {
      log.error(`Route worker: ${e.message}`);
      for (const done of routeWaiting.values()) done({ tiles: [], pts: [] });
      routeWaiting.clear();
      routeWorker = null;
    });
  }
  const id = ++routeSeq;
  return new Promise((resolve) => {
    routeWaiting.set(id, resolve);
    routeWorker.postMessage({ id, ...args });
  });
}

// World Hopper (RuneLite's WorldService, Ping, Client.hopToWorld) from the game view
ipcMain.handle('worlds-get', (e) => {
  if (!gameView || e.sender !== gameView.webContents) return null;
  return { worlds: worlds.WORLDS, current: state.world };
});
ipcMain.handle('worlds-ping', (e, id) => {
  if (!gameView || e.sender !== gameView.webContents) return -1;
  return worlds.ping(Number(id));
});
ipcMain.handle('world-hop', async (e, id) => {
  if (!gameView || e.sender !== gameView.webContents) return false;
  const w = worlds.WORLDS.find((x) => x.id === Number(id));
  if (!w || w.id === state.world) return false;
  if (!(await confirmLeaveGame(`Switch to world ${w.id}?`))) return false;
  loadWorld(w.id);
  return true;
});

ipcMain.handle('route-find', (e, args) => {
  if (!gameView || e.sender !== gameView.webContents || !args || !args.from || !args.to) return { tiles: [], pts: [] };
  // (vars: the Quest Helper's live quest variables, { varp id: value }, for the links a quest locks)
  let vars = null;
  if (args.vars && typeof args.vars === 'object') {
    vars = {};
    for (const [k, v] of Object.entries(args.vars).slice(0, 400)) if (/^\d+$/.test(k) && Number.isFinite(v)) vars[k] = v | 0;
  }
  // (have: the levels and items some links need, { stats: { skill: level }, inv: { id: n }, worn: { id: true } })
  let have = null;
  const h = args.have;
  if (h && typeof h === 'object') {
    const nums = (o, max) => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).slice(0, max).filter(([k, v]) => /^\w+$/.test(k) && (Number.isFinite(v) || v === true)).map(([k, v]) => [k, v === true ? true : v | 0])) : null);
    have = { stats: nums(h.stats, 30), inv: nums(h.inv, 200), worn: nums(h.worn, 50) };
  }
  return findRoute({ from: args.from, to: args.to, near: args.near | 0, allow: Array.isArray(args.allow) ? args.allow.slice(0, 8) : [], vars, have });
});

// Plugins running in the game page may only store values in their own config group.
ipcMain.on('game-set-config', (e, group, key, value) => {
  if (!gameView || e.sender !== gameView.webContents) return;
  if (!plugins.list().some((d) => d.game && d.config.group === group)) return;
  config.set(group, key, value);
});

// ------------------------------------------------------------------ IPC: chrome (title bar + sidebar)

function fromChrome(e) {
  return chromeView && e.sender === chromeView.webContents;
}

ipcMain.handle('get-state', (e) => {
  if (!fromChrome(e)) return null;
  return {
    version: app.getVersion(),
    title: win.getTitle(),
    worlds: worlds.WORLDS,
    world: state.world,
    client: state.client,
    hooked: state.hooked,
    loggedIn: state.loggedIn,
    stats: state.stats,
    player: state.player,
    items: state.items,
    entities: state.entities,
    pluginState: state.pluginState || {},
    chat: state.chat || [],
    activePanel: state.activePanel,
    sidebarOpen: state.sidebarOpen,
    maximized: win.isMaximized(),
    plugins: plugins.snapshot(),
    config: config.all(),
    profiles: config.profiles(),
    log: log.recent,
    update: state.update,
    logsDir: log.dir,
  };
});

let dragTimer = null;
function startDrag() {
  if (win.isMaximized()) return;
  const start = screen.getCursorScreenPoint();
  const b = win.getBounds();
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    win.setPosition(b.x + p.x - start.x, b.y + p.y - start.y);
  }, 10);
}

ipcMain.on('window', (e, action) => {
  if (!fromChrome(e)) return;
  if (action === 'drag-start') startDrag();
  else if (action === 'drag-end') { clearInterval(dragTimer); dragTimer = null; }
  else if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

// EASCape: a key pressed while the sidebar has the focus: the game gets the focus and the key
ipcMain.on('type-to-game', (e, key, shift) => {
  if (!gameView) return;
  const wc = gameView.webContents;
  wc.focus();
  const modifiers = shift ? ['shift'] : [];
  wc.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers });
  if (key.length === 1 || key === 'Space' || key === 'Enter') {
    wc.sendInputEvent({ type: 'char', keyCode: key === 'Space' ? ' ' : key === 'Enter' ? '\r' : key, modifiers });
  }
  wc.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers });
});

ipcMain.on('set-panel', (e, id) => {
  if (fromChrome(e)) setActivePanel(id);
});

ipcMain.on('set-sidebar', (e, open) => {
  if (fromChrome(e)) setSidebarOpen(open);
});

ipcMain.handle('hop', async (e, id) => {
  if (!fromChrome(e) || id === state.world) return false;
  if (!(await confirmLeaveGame(`Switch to world ${id}?`))) return false;
  loadWorld(id);
  return true;
});

ipcMain.on('reload-game', (e) => {
  if (fromChrome(e)) loadWorld(state.world);
});

ipcMain.on('open-external', (e, url) => {
  if (fromChrome(e) && /^https?:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.on('ui-log', (e, msg) => {
  if (fromChrome(e)) log.info(`[ui] ${String(msg).slice(0, 300)}`);
});

ipcMain.on('open-logs', (e) => {
  if (fromChrome(e)) shell.openPath(log.dir);
});

ipcMain.on('set-config', (e, group, key, value) => {
  if (fromChrome(e)) config.set(group, key, value);
});

ipcMain.on('unset-config', (e, group, key) => {
  if (fromChrome(e)) config.unset(group, key);
});

ipcMain.on('set-plugin-enabled', (e, id, on) => {
  if (fromChrome(e)) plugins.setEnabled(id, on);
});

// A RuneLite clone's sidebar panel (its PluginPanel) acting on the plugin, which runs in the game page
ipcMain.on('panel-action', (e, id, data) => {
  if (!fromChrome(e) || typeof id !== 'string' || !plugins.get(id) || !gameView || gameView.webContents.isDestroyed()) return;
  sendGame('panel-action', { id, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) });
});

ipcMain.handle('profile', (e, action, a, b) => {
  if (!fromChrome(e)) return null;
  if (action === 'create') config.createProfile(a || 'New profile', b);
  else if (action === 'rename') config.renameProfile(a, b);
  else if (action === 'delete') config.deleteProfile(a);
  else if (action === 'switch') {
    config.switchProfile(a);
    log.info(`Switched to profile "${config.profiles().list.find((p) => p.id === a).name}"`);
  }
  emit('patch', { profiles: config.profiles(), config: config.all(), plugins: plugins.snapshot() });
  return config.profiles();
});

ipcMain.on('install-update', (e) => {
  if (fromChrome(e)) updater.install();
});

// ------------------------------------------------------------------ startup

// "Hardware acceleration" off (LostLite settings) leaves a marker file, read here because
// it has to be decided before the app is ready. Fixes a black game screen on some graphics
// drivers.
const NO_GPU = path.join(app.getPath('userData'), 'disable-gpu');
const gpuOff = fs.existsSync(NO_GPU);
if (gpuOff) app.disableHardwareAcceleration();

app.on('child-process-gone', (_e, d) => {
  if (log) log.error(`${d.type} process stopped: ${d.reason}${d.exitCode ? ` (exit ${d.exitCode})` : ''}`);
});

app.whenReady().then(() => {
  const dataDir = app.getPath('userData');
  log = new Logger(dataDir);
  log.info(`2006RS-2 ${app.getVersion()} on ${process.platform} ${process.arch}, Electron ${process.versions.electron}`);
  if (gpuOff) log.info('Hardware acceleration is off');
  try {
    const st = app.getGPUFeatureStatus();
    log.info(`Graphics: canvas ${st['2d_canvas']}, compositing ${st.gpu_compositing}, webgl ${st.webgl}`);
  } catch {}
  app.getGPUInfo('basic').then((info) => {
    const dev = (info.gpuDevice || []).map((d) => `${d.vendorString || d.vendorId}:${d.deviceString || d.deviceId}${d.active ? ' (active)' : ''}${d.driverVersion ? ' driver ' + d.driverVersion : ''}`);
    if (dev.length) log.info(`GPU: ${dev.join(', ')}`);
  }).catch(() => {});
  config = new ConfigManager(dataDir);
  plugins = new PluginManager(config);
  secrets = new Secrets(dataDir, log);
  loginPassword = loginPasswordHandlers({
    secrets,
    isGamePage: (sender) => !!gameView && sender === gameView.webContents,
    enabled: () => plugins.isEnabled('loginscreen'),
    ticked: () => !!plugins.value('loginscreen', 'rememberPassword'),
  });
  log.onLine((line) => emit('log', line));

  config.onChange((c) => {
    emit('config', c);
    sendGame('config-changed', c);
    // Unticking "Remember password" deletes the stored password straight away.
    loginPassword.configChanged(c);
    if (c.group === 'lostlite') {
      if (c.key === 'alwaysOnTop') win.setAlwaysOnTop(!!core('alwaysOnTop'));
      if (c.key === 'hardwareAcceleration') {
        try {
          if (core('hardwareAcceleration') === false) fs.writeFileSync(NO_GPU, 'Hardware acceleration turned off in 2006RS-2 settings\n');
          else fs.rmSync(NO_GPU, { force: true });
          log.info(`Hardware acceleration ${core('hardwareAcceleration') === false ? 'off' : 'on'} from the next start`);
        } catch (e) {
          log.warn(`Couldn't save the hardware acceleration setting: ${e.message}`);
        }
      }
      if (/Plugin$/.test(c.key)) {
        const id = c.key.slice(0, -'Plugin'.length);
        const d = plugins.get(id);
        if (d) {
          log.info(`${plugins.isEnabled(id) ? 'Enabled' : 'Disabled'} plugin ${d.name}`);
          emit('patch', { plugins: plugins.snapshot() });
        }
      }
    }
  });

  createWindow();
  // 2007RS: the installed app updates itself from package.json's build.publish address
  // (updater.js does nothing when run from the checkout: start.bat pulls updates there)
  updater.init({ log, onStatus: (u) => { state.update = u; emit('patch', { update: u }); } });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => config && config.save());
app.on('will-quit', () => config && config.save()); // again, for settings sent while the windows closed
