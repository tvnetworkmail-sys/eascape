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
// The bank's own 72 x 36 buttons, used as artwork for ours: Item and Note (one is red
// when selected, the other grey). Not Swap and Insert: the "Rearrange mode:" label above
// them has a descender (the g) that dips into the buttons' top row and showed up as an
// orange dot. "Withdraw as:" above Item and Note has none.
const ITEM = { x: 4 + 239, y: 4 + 291 };
const NOTE = { x: 4 + 312, y: 4 + 291 };
const BODY_TOP = 8;
const BODY_H = 23;
const MAX_LEN = 30;

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

  // ---- button artwork: cut from the bank's own buttons so it matches exactly

  let art = null; // { grey: canvas, red: canvas }

  function grab(src) {
    const c = ctx.canvas();
    const out = document.createElement('canvas');
    out.width = BUTTON.w;
    out.height = BUTTON.h;
    const g = out.getContext('2d');
    // Left and right 18 columns of the 72-wide button keep both bevelled ends. Only the
    // stone body (rows 8-30) is copied: the "Rearrange mode:" label overlaps the rows
    // above it, and outside the body the bank's own background shows through.
    g.drawImage(c, src.x, src.y + BODY_TOP, 18, BODY_H, 0, BODY_TOP, 18, BODY_H);
    g.drawImage(c, src.x + 54, src.y + BODY_TOP, 18, BODY_H, 18, BODY_TOP, 18, BODY_H);
    return out;
  }

  function isRed(src) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      const p = probe.getContext('2d');
      p.drawImage(ctx.canvas(), src.x + 8, src.y + 20, 1, 1, 0, 0, 1, 1);
      const [r, g] = p.getImageData(0, 0, 1, 1).data;
      return r > g * 1.6;
    } catch {
      return false;
    }
  }

  function captureArt() {
    if (!ctx.canvas()) return;
    const itemRed = isRed(ITEM);
    const noteRed = isRed(NOTE);
    if (itemRed === noteRed) return; // not drawn yet; try again on the next render
    art = { red: grab(itemRed ? ITEM : NOTE), grey: grab(itemRed ? NOTE : ITEM) };
  }

  function drawButton(on) {
    if (!art) captureArt();
    const g = button.getContext('2d');
    g.clearRect(0, 0, BUTTON.w, BUTTON.h);
    if (art) {
      g.drawImage(on ? art.red : art.grey, 0, 0);
    } else {
      g.fillStyle = on ? 'rgb(128, 30, 21)' : 'rgb(72, 64, 52)';
      g.fillRect(1, BODY_TOP + 1, 34, BODY_H - 2);
    }
    // Magnifying glass, drawn in the game's style: light grey with a black outline.
    const icon = (stroke, dx, dy, w) => {
      g.strokeStyle = stroke;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(16 + dx, 17 + dy, 4.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(19.3 + dx, 20.3 + dy);
      g.lineTo(23 + dx, 24 + dy);
      g.stroke();
    };
    icon('#000', 1, 1, 3);
    icon('#000', 0, 0, 4);
    icon('rgb(220, 220, 210)', 0, 0, 2);
  }

  // Deposit inventory: the same grey button with a small chest and a green arrow going in,
  // drawn after the OSRS button (your screenshot)
  function drawDeposit() {
    if (!art) captureArt();
    const g = deposit.getContext('2d');
    g.clearRect(0, 0, DEPOSIT.w, DEPOSIT.h);
    if (art) {
      g.drawImage(art.grey, 0, 0);
    } else {
      g.fillStyle = 'rgb(72, 64, 52)';
      g.fillRect(1, BODY_TOP + 1, 34, BODY_H - 2);
    }
    // chest: outline, lid and body, a gold clasp
    g.fillStyle = '#000';
    g.fillRect(12, 15, 16, 13);
    g.fillStyle = 'rgb(120, 72, 32)';
    g.fillRect(13, 16, 14, 4);
    g.fillStyle = 'rgb(96, 56, 24)';
    g.fillRect(13, 21, 14, 6);
    g.fillStyle = '#000';
    g.fillRect(12, 20, 16, 1);
    g.fillStyle = 'rgb(220, 180, 60)';
    g.fillRect(19, 19, 2, 3);
    // green arrow, down and to the right into the chest
    const arrow = (fill, dx, dy) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(5 + dx, 10 + dy);
      g.lineTo(9 + dx, 10 + dy);
      g.lineTo(14 + dx, 15 + dy);
      g.lineTo(16 + dx, 13 + dy);
      g.lineTo(16 + dx, 20 + dy);
      g.lineTo(9 + dx, 20 + dy);
      g.lineTo(11 + dx, 18 + dy);
      g.lineTo(5 + dx, 12 + dy);
      g.closePath();
      g.fill();
    };
    arrow('#000', 1, 1);
    arrow('rgb(40, 200, 40)', 0, 0);
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
          art = null; // re-cut the artwork each time the bank opens
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
