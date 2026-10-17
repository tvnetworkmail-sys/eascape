'use strict';
// Game-side half of the Login Screen plugin. Draws three tick boxes under the Login and
// Cancel buttons of the 2004 login box (which the client draws at 202,171, 360 x 200) and
// passes the remembered details to the in-page runtime, which fills them in.

const BOX = { x: 202, y: 171, w: 360 };
// Local to the login box: one centred row along the top, above the message lines (the
// highest message line is drawn at y 45).
const ROW_Y = 14;
const GAP = 14; // game pixels between the three items
const ITEMS = [
  { key: 'rememberUsername', label: 'Remember username' },
  { key: 'rememberPassword', label: 'Remember password' },
  { key: 'hideUsername', label: 'Hide username' },
];

module.exports = function loginScreen(ctx) {
  let el = null;
  let screen = -1;
  let loggedIn = false;
  let off = null;
  let fontLoaded = false;

  async function push() {
    let pass = '';
    if (ctx.config('rememberPassword')) {
      try {
        pass = await ctx.invoke('login-pass-get');
      } catch {
        pass = '';
      }
    }
    ctx.sendToGame({
      type: 'login-config',
      hideUser: !!ctx.config('hideUsername'),
      rememberUser: !!ctx.config('rememberUsername'),
      rememberPass: !!ctx.config('rememberPassword'),
      user: ctx.config('rememberUsername') ? ctx.state('username', '') : '',
      pass,
    });
  }

  function loadFont() {
    if (fontLoaded) return;
    fontLoaded = true;
    try {
      // The Lost City page blocks fonts loaded by URL, so hand the font over as raw data.
      const fs = require('fs');
      const path = require('path');
      const data = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'assets', 'fonts', 'runescape_small.ttf'));
      const face = new FontFace('LostLiteRSSmall', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      face.load().then((f) => document.fonts.add(f)).catch(() => {});
    } catch { /* falls back to Arial */ }
  }

  function tick(on) {
    return `<svg viewBox="0 0 12 12" width="1em" height="1em" style="flex:none">
      <circle cx="6" cy="6" r="5.3" fill="#262626" stroke="#000" stroke-width="1"/>
      ${on ? '<path d="M3.2 6.2l1.9 1.9 3.8-4.2" fill="none" stroke="#4cc93f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
    </svg>`;
  }

  function build() {
    if (el) el.remove();
    loadFont();
    if (!document.getElementById('lostlite-login-style')) {
      // The game frame hides everything but the canvas; let the tick boxes (and their
      // contents) show.
      const st = document.createElement('style');
      st.id = 'lostlite-login-style';
      st.textContent = '.ll-login, .ll-login * { visibility: visible !important; }';
      (document.head || document.documentElement).appendChild(st);
    }
    el = document.createElement('div');
    el.className = 'll-login';
    el.style.cssText = 'position:fixed;z-index:2147483647;visibility:visible !important;pointer-events:none;'
      + "font-family:'LostLiteRSSmall',Arial,sans-serif;color:#ff0;text-shadow:1px 1px 0 #000;user-select:none";
    for (const it of ITEMS) {
      const row = document.createElement('div');
      row.dataset.key = it.key;
      row.style.cssText = 'display:flex;align-items:center;gap:0.3em;cursor:pointer;pointer-events:auto;visibility:visible !important;white-space:nowrap';
      if (it.key === 'rememberPassword') {
        row.title = 'Stored encrypted with your Windows account. Don\'t use on a shared computer.';
      }
      for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click', 'contextmenu', 'mousemove', 'pointermove']) {
        row.addEventListener(t, (e) => {
          e.stopImmediatePropagation();
          if (t !== 'mousemove' && t !== 'pointermove') e.preventDefault();
          if (t === 'pointerdown' && e.button === 0) {
            ctx.setState(it.key, !ctx.config(it.key));
            if (it.key === 'rememberUsername' && !ctx.config(it.key)) ctx.setState('username', '');
            render();
            push();
          }
        }, true);
      }
      el.appendChild(row);
    }
    document.body.appendChild(el);
  }

  function render() {
    const show = ctx.config('showOnLoginScreen') && screen === 2 && !loggedIn && ctx.canvas();
    if (!show) {
      if (el) el.style.display = 'none';
      return;
    }
    if (!el) build();
    const r = ctx.canvas().getBoundingClientRect();
    const scale = r.width / 765;
    // One centred row across the top of the login box.
    el.style.display = 'flex';
    el.style.justifyContent = 'center';
    el.style.alignItems = 'center';
    el.style.gap = `${GAP * scale}px`;
    el.style.left = `${r.left + BOX.x * scale}px`;
    el.style.top = `${r.top + (BOX.y + ROW_Y) * scale}px`;
    el.style.width = `${BOX.w * scale}px`;
    el.style.fontSize = `${Math.round(13 * scale)}px`;
    for (const row of el.children) {
      const it = ITEMS.find((x) => x.key === row.dataset.key);
      row.innerHTML = `${tick(!!ctx.config(it.key))}<span>${it.label}</span>`;
    }
  }

  async function onSave(data) {
    if (ctx.config('rememberUsername') && data.user) ctx.setState('username', data.user);
    if (ctx.config('rememberPassword') && data.pass) {
      try {
        await ctx.invoke('login-pass-set', data.pass);
      } catch (e) {
        ctx.log(`Could not remember password: ${e && e.message}`);
      }
    }
    push();
  }

  const onResize = () => render();

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'login-screen') {
          screen = data;
          render();
        } else if (type === 'login-state') {
          loggedIn = !!data;
          render();
        } else if (type === 'login-save' && data) {
          onSave(data);
        }
      });
      window.addEventListener('resize', onResize);
      push();
      render();
    },
    stop() {
      if (off) off();
      window.removeEventListener('resize', onResize);
      if (el) el.remove();
      el = null;
      ctx.sendToGame({ type: 'login-config', hideUser: false, rememberUser: false, rememberPass: false });
    },
    configChanged() {
      push();
      render();
    },
    gameReady: push,
  };
};
