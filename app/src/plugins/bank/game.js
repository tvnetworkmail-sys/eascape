'use strict';
// Game-side half of the bank search. The in-page runtime does the filtering and has the
// game draw RuneLite's search prompt in the chatbox (with the game's own prompt code, so
// it sits on the real chatbox background); this draws the search button over the bank
// and handles typing (keys go to the search, not the game, while the prompt is showing).

// Positions in game pixels. The bank is drawn at (4, 4). EASCape: the search button and the
// Deposit inventory button sit bottom right, as in OSRS (your call, 31 Oct 2026); the bank's
// "Withdraw as: Item / Note" buttons were moved left 52 pixels to make room (bank_main.if),
// so they now span x 239-384 at y 291-327. The chatbox text area starts at (17, 357).
const BUTTON = { x: 4 + 400, y: 4 + 291, w: 36, h: 36 };
const DEPOSIT = { x: 4 + 437, y: 4 + 291, w: 36, h: 36 };
const MAX_LEN = 30;
const ICONS = require('./icons.js');

module.exports = function bankSearch(ctx) {
  let open = false;
  let typing = false;
  let query = '';
  let found = -1;
  let button = null;
  let deposit = null;
  let off = null;

  function send() {
    ctx.sendToGame({ type: 'bank-search', query });
  }

  // ---- placeholders: the bank's layout (item ids in order) per account, kept on this PC
  let account = null;
  function sendLayout(on = ctx.config('placeholders') !== false) {
    const all = ctx.state('layouts', {}) || {};
    ctx.sendToGame({ type: 'bank-layout', placeholders: on, layout: account && Array.isArray(all[account]) ? all[account] : [] });
  }
  function saveLayout(layout) {
    if (!account || !Array.isArray(layout)) return;
    const all = Object.assign({}, ctx.state('layouts', {}));
    all[account] = layout;
    ctx.setState('layouts', all);
  }

  function ensureStyle() {
    if (document.getElementById('lostlite-bank-style')) return;
    const st = document.createElement('style');
    st.id = 'lostlite-bank-style';
    st.textContent = `
      .ll-bank, .ll-bank * { visibility: visible !important; }
      .ll-bank { position: fixed; z-index: 2147483647; box-sizing: border-box; user-select: none; }
      .ll-bank-btn { cursor: pointer; image-rendering: pixelated; }
    `;
    (document.head || document.documentElement).appendChild(st);
  }

  function scale() {
    const c = ctx.canvas();
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { r, s: r.width / 765 };
  }

  function place(el, box, g) {
    el.style.left = `${g.r.left + box.x * g.s}px`;
    el.style.top = `${g.r.top + box.y * g.s}px`;
    el.style.width = `${box.w * g.s}px`;
    el.style.height = `${box.h * g.s}px`;
  }

  // the buttons' pictures (icons.js), loaded once; render again when they arrive
  const pics = {};
  function pic(name) {
    if (!pics[name]) {
      const img = new Image();
      img.onload = () => render();
      img.src = ICONS[name];
      pics[name] = img;
    }
    return pics[name].complete && pics[name].naturalWidth ? pics[name] : null;
  }

  function drawButton(on) {
    const g = button.getContext('2d');
    g.clearRect(0, 0, BUTTON.w, BUTTON.h);
    const img = pic('search');
    if (img) g.drawImage(img, 0, 0);
    if (on) {
      // while searching, the button glows red like the bank's selected buttons
      g.fillStyle = 'rgba(160, 30, 20, 0.45)';
      g.fillRect(3, 3, BUTTON.w - 6, BUTTON.h - 6);
    }
  }

  function drawDeposit() {
    const g = deposit.getContext('2d');
    g.clearRect(0, 0, DEPOSIT.w, DEPOSIT.h);
    const img = pic('deposit');
    if (img) g.drawImage(img, 0, 0);
  }

  function blockGame(el, onClick = toggle) {
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click', 'contextmenu', 'mousemove', 'pointermove', 'wheel']) {
      el.addEventListener(t, (e) => {
        e.stopImmediatePropagation();
        if (t !== 'mousemove' && t !== 'pointermove') e.preventDefault();
        if (t === 'pointerdown' && e.button === 0) onClick();
      }, true);
    }
  }

  function render() {
    const g = scale();
    if (!open || !g) {
      if (button) button.style.display = 'none';
      if (deposit) deposit.style.display = 'none';
      showPrompt(false);
      return;
    }
    ensureStyle();
    if (!button) {
      button = document.createElement('canvas');
      button.className = 'll-bank ll-bank-btn';
      button.width = BUTTON.w;
      button.height = BUTTON.h;
      button.title = 'Search';
      blockGame(button);
      document.body.appendChild(button);
    }
    button.style.display = 'block';
    place(button, BUTTON, g);
    drawButton(typing || !!query);
    if (!deposit) {
      deposit = document.createElement('canvas');
      deposit.className = 'll-bank ll-bank-btn';
      deposit.width = DEPOSIT.w;
      deposit.height = DEPOSIT.h;
      deposit.title = 'Deposit inventory';
      blockGame(deposit, () => ctx.sendToGame({ type: 'bank-deposit-all' }));
      document.body.appendChild(deposit);
    }
    deposit.style.display = 'block';
    place(deposit, DEPOSIT, g);
    drawDeposit();

    showPrompt(typing);
  }

  let promptShown = '';
  function showPrompt(on) {
    const lines = on
      ? [`Show items whose names contain the following text:${query && found >= 0 ? ` (${found} found)` : ''}`, `${query}*`]
      : null;
    const key = JSON.stringify(lines);
    if (key === promptShown) return;
    promptShown = key;
    ctx.sendToGame({ type: 'chat-prompt', lines });
  }

  function startTyping() {
    typing = true;
    render();
  }

  function stopTyping() {
    typing = false;
    render();
  }

  function clear() {
    query = '';
    found = -1;
    typing = false;
    send();
    render();
  }

  function toggle() {
    if (typing || query) clear();
    else startTyping();
  }

  // the search hotkey (Ctrl+F) goes through the hotkey system, only while the bank is open
  let offHotkey = null;
  function onSearchKey() {
    query = '';
    send();
    startTyping();
  }

  function onKeyDown(e) {
    if (!open || !typing) return;
    // While the prompt shows, keys belong to the search, not the game.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') {
      clear();
    } else if (e.key === 'Enter') {
      stopTyping();
    } else if (e.key === 'Backspace') {
      query = query.slice(0, -1);
      send();
      render();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && query.length < MAX_LEN) {
      query += e.key;
      send();
      render();
    }
  }

  function onKeyOther(e) {
    if (open && typing) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  // Clicking anywhere else in the game finishes typing (the search stays applied), so the
  // game's own chatbox prompts (like Withdraw X) aren't covered.
  function onPointerDown(e) {
    if (typing && button && !button.contains(e.target)) stopTyping();
  }

  const onResize = () => render();

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data && data.name && String(data.name).toLowerCase() !== account) {
          account = String(data.name).toLowerCase();
          sendLayout();
        } else if (type === 'bank-layout') {
          saveLayout(data);
        } else if (type === 'bank-open') {
          open = !!data;
          if (!open) {
            query = '';
            found = -1;
            typing = false;
          }
          render();
        } else if (type === 'bank-count') {
          found = data;
          render();
        }
      });
      offHotkey = ctx.hotkey('searchHotkey', { when: () => open && !typing, pressed: onSearchKey });
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyOther, true);
      window.addEventListener('keypress', onKeyOther, true);
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('resize', onResize);
      sendLayout();
    },
    configChanged: () => sendLayout(),
    gameReady: () => sendLayout(),
    stop() {
      sendLayout(false);
      if (off) off();
      if (offHotkey) offHotkey();
      offHotkey = null;
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyOther, true);
      window.removeEventListener('keypress', onKeyOther, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onResize);
      if (button) button.remove();
      button = null;
      if (deposit) deposit.remove();
      deposit = null;
      query = '';
      typing = false;
      showPrompt(false);
      send();
    },
  };
};
