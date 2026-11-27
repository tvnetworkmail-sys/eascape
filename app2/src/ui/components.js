'use strict';
// RuneLite's Swing components in HTML: tooltips (ToolTipManager: 300 ms in, 10 s out), popup
// menus, IconTextField, PluginToggleButton, JCheckBox, JSpinner, JComboBox, ColorJButton with
// RuneliteColorPicker, HotkeyButton, JTextArea - with RuneLiteLAF's sizes and colours (see
// chrome.css).
/* exported UI */

const UI = (() => {
  const ICON = 'assets/icons/';

  /** h('div.cls', { attrs }, ...children) */
  function h(tag, attrs, ...children) {
    const [name, ...classes] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (classes.length) el.className = classes.join(' ');
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'text') el.textContent = v;
      else if (k === 'tip') tip(el, v);
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'class') el.className = [...classes, ...String(v).split(' ')].filter((c, i, a) => c && a.indexOf(c) === i).join(' ');
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function icon(name, extra = {}) {
    return h('img', { src: ICON + name, alt: '', draggable: 'false', ...extra });
  }

  // ---- tooltip (JToolTip): shown 300 ms after the mouse stops on a component, at the mouse
  // plus the cursor's height, for 10 s; "<br>"-style line breaks from "\n"
  let tipEl = null;
  let tipTimer = null;
  let tipDismiss = null;
  function tip(el, text) {
    if (!text) return;
    el._tip = text;
    if (el._tipBound) return;
    el._tipBound = true;
    let last = null;
    const schedule = (e) => {
      last = e;
      if (tipEl) return place(tipEl, e.clientX, e.clientY + 20);
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => show(el, last), 300);
    };
    el.addEventListener('mouseenter', schedule);
    el.addEventListener('mousemove', schedule);
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('mousedown', hideTip);
  }
  function show(el, e) {
    hideTip();
    if (!el.isConnected) return;
    const lines = String(el._tip).split('\n');
    tipEl = h('div.tooltip', {}, ...lines.flatMap((l, i) => (i ? [h('br'), l] : [l])));
    document.body.append(tipEl);
    place(tipEl, e.clientX, e.clientY + 20);
    tipDismiss = setTimeout(hideTip, 10000);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    clearTimeout(tipDismiss);
    if (tipEl) tipEl.remove();
    tipEl = null;
  }
  function place(el, x, y) {
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(x, window.innerWidth - r.width)) + 'px';
    el.style.top = Math.max(0, Math.min(y, window.innerHeight - r.height)) + 'px';
  }

  // ---- popup menu (JPopupMenu)
  let menu = null;
  function popup(e, items, cls) {
    e.preventDefault();
    closeMenu();
    hideTip();
    menu = h('div.popup', { class: cls || null }, ...items.filter(Boolean).map(([label, fn]) => h('button', { text: label, onclick: () => { closeMenu(); fn(); } })));
    document.body.append(menu);
    place(menu, e.clientX, e.clientY);
  }
  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
  }
  window.addEventListener('mousedown', (e) => {
    if (menu && !menu.contains(e.target)) closeMenu();
    if (comboList && !comboList.contains(e.target) && !comboList._owner.contains(e.target)) closeCombo();
    if (picker && !picker.contains(e.target) && !(picker._owner && picker._owner.contains(e.target))) closePicker();
  }, true);
  window.addEventListener('blur', () => { closeMenu(); closeCombo(); hideTip(); });

  // ---- IconTextField (search box)

  function searchField(value, oninput, placeholder = '') {
    const input = h('input', { type: 'text', placeholder, spellcheck: 'false' });
    input.value = value || '';
    const clear = h('button.clear', { text: '×', tip: 'Clear', onclick: () => { input.value = ''; sync(); input.focus(); } });
    const wrap = h('div.text-field', {}, h('span.tf-icon', {}, icon('search.png')), input, clear);
    function sync() {
      wrap.classList.toggle('has-text', !!input.value);
      oninput(input.value);
    }
    input.addEventListener('input', sync);
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; sync(); } });
    wrap.classList.toggle('has-text', !!input.value);
    wrap.input = input;
    return wrap;
  }

  // ---- PluginToggleButton: switcher_on.png, or it greyed, darkened and flipped
  function toggle(on, onchange, tipText) {
    const b = h('button.icon-btn.toggle', { tip: tipText || (on ? 'Disable plugin' : 'Enable plugin'), 'aria-pressed': String(!!on) },
      icon(on ? 'switcher_on.png' : 'switcher_off.png'));
    b.addEventListener('click', () => onchange(!on));
    return b;
  }

  // ---- JCheckBox
  function checkbox(on, onchange) {
    const b = h('button.checkbox', { role: 'checkbox', 'aria-checked': String(!!on) });
    // FlatCheckBoxIcon's checkmark, scaled from 15 to 22 px (inside the 1 px border)
    const s = 22 / 15;
    b.innerHTML = `<svg viewBox="0 0 20 20"><path d="M${4.5 * s - 1} ${7.5 * s - 1}L${6.6 * s - 1} ${10 * s - 1}L${11.25 * s - 1} ${3.5 * s - 1}"/></svg>`;
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(v));
      onchange(v);
    });
    return b;
  }

  // ---- JSpinner with SpinnerNumberModel(value, min, max, 1); the unit is shown after the number
  // as RuneLite's UnitFormatterFactory does
  const CHEVRON_UP = '<svg viewBox="0 0 8 5"><path d="M0.5 4.5L4 1L7.5 4.5"/></svg>';
  const CHEVRON_DOWN = '<svg viewBox="0 0 8 5"><path d="M0.5 0.5L4 4L7.5 0.5"/></svg>';
  function spinner(value, { min = 0, max = 2147483647, unit, step = 1 }, onchange) {
    const input = h('input', { type: 'text', spellcheck: 'false' });
    const fmt = (v) => `${v}${unit || ''}`;
    input.value = fmt(value);
    const commit = (v) => {
      let n = Number(String(v).replace(unit || '\u0000', '').trim());
      if (!Number.isFinite(n)) { input.value = fmt(value); return; }
      n = step < 1 ? Math.round(n / step) * step : Math.round(n);
      n = Math.max(min, Math.min(max, n));
      if (step < 1) n = Number(n.toFixed(4));
      input.value = fmt(n);
      if (n !== value) { value = n; onchange(n); }
    };
    input.addEventListener('change', () => commit(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      else if (e.key === 'ArrowUp') { e.preventDefault(); commit(value + step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); commit(value - step); }
    });
    const box = h('div.spinner', {}, input);
    input.addEventListener('focus', () => box.classList.add('focus'));
    input.addEventListener('blur', () => box.classList.remove('focus'));
    const arrow = (svg, d) => {
      const b = h('button', { tabindex: '-1' });
      b.innerHTML = svg;
      // held down: repeats like Swing's spinner (500 ms, then every 60 ms)
      let t = null;
      const stop = () => { clearTimeout(t); clearInterval(t); };
      b.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        commit(value + d);
        t = setTimeout(() => { t = setInterval(() => commit(value + d), 60); }, 500);
      });
      b.addEventListener('mouseup', stop);
      b.addEventListener('mouseleave', stop);
      return b;
    };
    box.append(h('div.arrows', {}, arrow(CHEVRON_UP, step), arrow(CHEVRON_DOWN, -step)));
    box.addEventListener('wheel', (e) => {
      if (document.activeElement !== input) return;
      e.preventDefault();
      commit(value + (e.deltaY < 0 ? step : -step));
    }, { passive: false });
    return box;
  }

  // ---- JComboBox: shows the item in title case like TitleCaseListCellRenderer
  let comboList = null;
  function closeCombo() {
    if (comboList) comboList.remove();
    comboList = null;
  }
  function combo(value, options, onchange) {
    const label = () => (options.find((o) => String(o.value) === String(value)) || { label: String(value) }).label;
    const cv = h('span.cv', { text: label() });
    const cb = h('span.cb');
    cb.innerHTML = CHEVRON_DOWN;
    const b = h('button.combo', { tip: label() }, cv, cb);
    b.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (comboList && comboList._owner === b) { closeCombo(); return; }
      closeCombo();
      const r = b.getBoundingClientRect();
      comboList = h('div.combo-list', {}, ...options.map((o) => h('div', {
        class: String(o.value) === String(value) ? 'sel' : null,
        text: o.label,
        onmousedown: (ev) => {
          ev.preventDefault();
          value = o.value;
          cv.textContent = o.label;
          b._tip = o.label;
          closeCombo();
          onchange(o.value);
        },
      })));
      comboList._owner = b;
      comboList.style.minWidth = r.width + 'px';
      document.body.append(comboList);
      const lr = comboList.getBoundingClientRect();
      const below = r.bottom + lr.height <= window.innerHeight;
      comboList.style.left = Math.min(r.left, window.innerWidth - lr.width) + 'px';
      comboList.style.top = (below ? r.bottom : Math.max(0, r.top - lr.height)) + 'px';
    });
    b.addEventListener('keydown', (e) => {
      const i = options.findIndex((o) => String(o.value) === String(value));
      const j = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -2;
      if (j === -2 || j < 0 || j >= options.length) return;
      e.preventDefault();
      value = options[j].value;
      cv.textContent = options[j].label;
      onchange(value);
    });
    return b;
  }

  // ---- ColorJButton + RuneliteColorPicker

  function hexOf(c) {
    if (c === null || c === undefined || c === '') return null;
    const m = /^#?([0-9a-f]{6,8})$/i.exec(String(c).trim());
    return m ? '#' + m[1].toUpperCase() : null;
  }
  function rgbOf(hex) {
    const s = hex.replace('#', '');
    const rgb = s.slice(-6);
    const n = parseInt(rgb, 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: s.length === 8 ? parseInt(s.slice(0, 2), 16) : 255 };
  }
  function toHex({ r, g, b, a }, alpha) {
    const p = (v) => Math.round(v).toString(16).padStart(2, '0');
    return ('#' + (alpha ? p(a) : '') + p(r) + p(g) + p(b)).toUpperCase();
  }
  function hsv2rgb(hh, s, v) {
    const f = (n) => {
      const k = (n + hh / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
  }
  function rgb2hsv({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    let hh = 0;
    if (d) {
      if (mx === r) hh = ((g - b) / d) % 6;
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh = (hh * 60 + 360) % 360;
    }
    return { h: hh, s: mx ? d / mx : 0, v: mx };
  }

  let picker = null;
  function closePicker() {
    if (picker) {
      const p = picker;
      picker = null;
      p.remove();
      if (p._onclose) p._onclose();
    }
  }

  /** value: '#RRGGBB' or '#AARRGGBB'; opts.alpha shows the alpha slider (RuneLite's @Alpha) */
  function colorButton(value, onchange, opts = {}) {
    const b = h('button.color-btn');
    function show(v) {
      const hex = hexOf(v);
      b.textContent = hex || 'Pick a color';
      const c = hex ? rgbOf(hex) : { r: 0, g: 0, b: 0, a: 255 };
      b.style.background = hex ? `rgba(${c.r},${c.g},${c.b},${c.a / 255})` : '#000';
      const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
      b.style.color = lum > 0.5 || c.a < 120 ? '#000' : '#fff';
    }
    show(value);
    b.addEventListener('click', () => {
      if (picker && picker._owner === b) { closePicker(); return; }
      closePicker();
      const start = hexOf(value) || '#FF000000'.slice(opts.alpha ? 0 : 3);
      const c0 = rgbOf(start);
      let hsv = rgb2hsv(c0);
      let alpha = c0.a;
      const SQ = 150;
      const sv = h('canvas', { width: SQ, height: SQ });
      const hue = h('canvas', { width: 18, height: SQ });
      const swatch = h('div.cp-swatch');
      const hexIn = h('input.cp-hex', { type: 'text', spellcheck: 'false' });
      const alphaIn = opts.alpha ? h('input', { type: 'range', min: 0, max: 255, value: alpha }) : null;
      const current = () => ({ ...hsv2rgb(hsv.h, hsv.s, hsv.v), a: alpha });
      function paint() {
        const g = sv.getContext('2d');
        const base = hsv2rgb(hsv.h, 1, 1);
        g.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
        g.fillRect(0, 0, SQ, SQ);
        let gr = g.createLinearGradient(0, 0, SQ, 0);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, SQ, SQ);
        gr = g.createLinearGradient(0, 0, 0, SQ);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000');
        g.fillStyle = gr; g.fillRect(0, 0, SQ, SQ);
        g.strokeStyle = hsv.v > 0.5 ? '#000' : '#fff';
        g.beginPath(); g.arc(hsv.s * SQ, (1 - hsv.v) * SQ, 4, 0, Math.PI * 2); g.stroke();
        const hg = hue.getContext('2d');
        for (let y = 0; y < SQ; y++) {
          const c = hsv2rgb((y / SQ) * 360, 1, 1);
          hg.fillStyle = `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`;
          hg.fillRect(0, y, 18, 1);
        }
        const hy = Math.round((hsv.h / 360) * SQ);
        hg.fillStyle = '#fff'; hg.fillRect(0, hy - 1, 18, 3);
        hg.fillStyle = '#000'; hg.fillRect(0, hy, 18, 1);
        const c = current();
        swatch.style.background = `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${c.a / 255})`;
        if (document.activeElement !== hexIn) hexIn.value = toHex(c, opts.alpha);
      }
      function changed() {
        paint();
        value = toHex(current(), opts.alpha);
        show(value);
        onchange(value);
      }
      const dragOn = (cv, fn) => cv.addEventListener('mousedown', (e) => {
        const move = (ev) => {
          const r = cv.getBoundingClientRect();
          fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)));
          changed();
        };
        move(e);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
      dragOn(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
      dragOn(hue, (x, y) => { hsv.h = Math.min(359.9, y * 360); });
      hexIn.addEventListener('change', () => {
        const hx = hexOf(hexIn.value);
        if (!hx) return;
        const c = rgbOf(hx);
        hsv = rgb2hsv(c);
        if (opts.alpha && hx.length === 9) alpha = c.a;
        changed();
      });
      if (alphaIn) alphaIn.addEventListener('input', () => { alpha = Number(alphaIn.value); changed(); });
      picker = h('div.colorpicker', {},
        h('div.cp-title', { text: opts.title || 'Pick a color' }),
        h('div.cp-main', {}, sv, hue),
        alphaIn ? h('div.cp-alpha', {}, h('span', { text: 'Alpha' }), alphaIn) : null,
        h('div.cp-row', {}, swatch, h('span', { text: 'Hex' }), hexIn));
      picker._owner = b;
      document.body.append(picker);
      const r = b.getBoundingClientRect();
      const pr = picker.getBoundingClientRect();
      picker.style.left = Math.max(0, Math.min(r.right - pr.width, window.innerWidth - pr.width)) + 'px';
      picker.style.top = (r.bottom + pr.height + 2 <= window.innerHeight ? r.bottom + 2 : Math.max(0, r.top - pr.height - 2)) + 'px';
      paint();
    });
    return b;
  }

  // ---- HotkeyButton: a click clears it ("Not set"), then the next key (with modifiers) is the
  // keybind; a modifier pressed and released on its own is a keybind too (ModifierlessKeybind)
  const MOD_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  const MOD_NAME = { Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' };
  function hotkeyButton(value, onchange) {
    const b = h('button.hotkey-btn', { text: value || 'Not set' });
    let listening = false;
    let lone = null;
    const finish = (v) => {
      listening = false;
      lone = null;
      b.classList.remove('listening');
      if (v !== value) { value = v; onchange(v); }
      b.textContent = v || 'Not set';
    };
    b.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      listening = true;
      b.classList.add('listening');
      value = '';
      onchange('');
      b.textContent = 'Not set';
      b.focus();
    });
    b.addEventListener('blur', () => { if (listening) finish(value); });
    b.addEventListener('keyup', (e) => {
      if (!listening || !lone || e.key !== lone) return;
      e.preventDefault();
      finish(MOD_NAME[lone]);
    });
    b.addEventListener('keydown', (e) => {
      if (!listening) return;
      e.preventDefault();
      e.stopPropagation();
      if (MOD_KEYS.has(e.key)) { lone = e.key; return; }
      lone = null;
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');
      parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
      finish(parts.join('+'));
    });
    return b;
  }

  // ---- JTextArea with line wrap; saves when it loses the focus, like ConfigPanel
  function textArea(value, onchange, secret) {
    const t = secret ? h('input.cfg-text', { type: 'password', spellcheck: 'false' }) : h('textarea.cfg-text', { rows: '1', spellcheck: 'false' });
    t.value = value || '';
    const fit = () => {
      if (secret) return;
      t.style.height = 'auto';
      t.style.height = t.scrollHeight + 'px';
    };
    t.addEventListener('input', fit);
    t.addEventListener('blur', () => onchange(t.value));
    requestAnimationFrame(fit);
    return t;
  }

  // ---- notification fallback (shown in the window when the OS has no notifications)
  function toast(title, body) {
    const el = h('div.toast', {}, h('div.t-title', { text: title || '2006RS-2' }), body ? h('div.t-body', { text: body }) : null);
    document.body.append(el);
    setTimeout(() => el.remove(), 5000);
    el.addEventListener('click', () => el.remove());
  }

  return { h, icon, tip, hideTip, popup, closeMenu, searchField, toggle, checkbox, spinner, combo, colorButton, hotkeyButton, textArea, toast, hexOf };
})();
