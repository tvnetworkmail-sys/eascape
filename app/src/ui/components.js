'use strict';
// Small UI kit standing in for RuneLite's Swing components (IconTextField, MaterialTab,
// PluginToggleButton, HotkeyButton, ColorJButton, popup menus and tooltips).
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

  // ---- tooltip
  let tipEl = null;
  function tip(el, text) {
    if (!text) return;
    el.addEventListener('mouseenter', (e) => {
      hideTip();
      tipEl = h('div.tooltip', {}, ...String(text).split('\n').flatMap((l, i) => (i ? [h('br'), l] : [l])));
      document.body.append(tipEl);
      place(tipEl, e.clientX + 12, e.clientY + 16);
    });
    el.addEventListener('mousemove', (e) => tipEl && place(tipEl, e.clientX + 12, e.clientY + 16));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('mousedown', hideTip);
  }
  function hideTip() {
    if (tipEl) tipEl.remove();
    tipEl = null;
  }
  function place(el, x, y) {
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(0, Math.min(x, window.innerWidth - r.width - 2)) + 'px';
    el.style.top = Math.max(0, Math.min(y, window.innerHeight - r.height - 2)) + 'px';
  }

  // ---- popup menu
  const menu = document.getElementById('menu');
  function popup(e, items) {
    e.preventDefault();
    menu.replaceChildren(...items.map(([label, fn]) => h('button', { text: label, onclick: () => { closeMenu(); fn(); } })));
    menu.hidden = false;
    place(menu, e.clientX, e.clientY);
  }
  function closeMenu() {
    menu.hidden = true;
  }
  window.addEventListener('mousedown', (e) => { if (!menu.contains(e.target)) closeMenu(); });
  window.addEventListener('blur', closeMenu);

  // ---- RuneLite-style controls

  function searchField(value, oninput, placeholder = 'Search') {
    const input = h('input', { type: 'text', placeholder, spellcheck: 'false' });
    input.value = value || '';
    const wrap = h('div.text-field', {}, icon('search.png'), input,
      h('span.clear', { text: '×', onclick: () => { input.value = ''; sync(); input.focus(); } }));
    function sync() {
      wrap.classList.toggle('has-text', !!input.value);
      oninput(input.value);
    }
    input.addEventListener('input', sync);
    wrap.classList.toggle('has-text', !!input.value);
    wrap.input = input;
    return wrap;
  }

  function toggle(on, onchange, tipText) {
    const b = h('button.icon-btn.toggle', { tip: tipText, 'aria-pressed': String(!!on) }, icon(on ? 'switcher_on.png' : 'switcher_off.png'));
    b.addEventListener('click', () => onchange(!on));
    return b;
  }

  function checkbox(on, onchange) {
    const b = h('button.checkbox', { role: 'checkbox', 'aria-checked': String(!!on) });
    b.innerHTML = '<svg viewBox="0 0 14 14"><path d="M2 7.5l3.2 3.2L12 3.5"/></svg>';
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(v));
      onchange(v);
    });
    return b;
  }

  function spinner(value, { min = 0, max = 2147483647, unit }, onchange) {
    const input = h('input', { type: 'number', min, max, step: 1 });
    input.value = value;
    const commit = (v) => {
      const n = Math.max(min, Math.min(max, Math.round(Number(v))));
      if (!Number.isFinite(n)) { input.value = value; return; }
      input.value = n;
      if (n !== value) { value = n; onchange(n); }
    };
    input.addEventListener('change', () => commit(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return h('div.spinner', {}, input, unit ? h('span.unit', { text: unit }) : null,
      h('div.arrows', {}, h('button', { text: '▲', onclick: () => commit(value + 1) }), h('button', { text: '▼', onclick: () => commit(value - 1) })));
  }

  function combo(value, options, onchange) {
    const s = h('select.combo', {}, ...options.map((o) => h('option', { value: o.value, text: o.label })));
    s.value = value;
    s.addEventListener('change', () => onchange(s.value));
    return s;
  }

  function hexOf(c) {
    return c ? '#' + c.replace(/^#/, '').slice(-6).toUpperCase() : null;
  }

  function colorButton(value, onchange) {
    const picker = h('input', { type: 'color', style: 'position:absolute;opacity:0;width:0;height:0;pointer-events:none' });
    const b = h('button.color-btn');
    function show(v) {
      const hex = hexOf(v);
      b.textContent = hex || 'Pick a color';
      b.style.background = hex || 'var(--control)';
      if (hex) {
        const n = parseInt(hex.slice(1), 16);
        const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
        b.style.color = lum > 140 ? '#000' : '#fff';
        picker.value = hex.toLowerCase();
      }
    }
    show(value);
    b.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => { show(picker.value); onchange(picker.value.toUpperCase()); });
    return h('span', { style: 'position:relative' }, b, picker);
  }

  const MOD_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  function hotkeyButton(value, onchange) {
    const b = h('button.hotkey-btn', { text: value || 'Not set' });
    let listening = false;
    b.addEventListener('click', () => {
      listening = true;
      b.classList.add('listening');
      b.textContent = 'Press a key...';
    });
    b.addEventListener('blur', () => { if (listening) { listening = false; b.classList.remove('listening'); b.textContent = value || 'Not set'; } });
    let lone = null; // a modifier pressed on its own, like Alt for Ground Items
    const finish = (v) => {
      listening = false;
      lone = null;
      b.classList.remove('listening');
      value = v;
      b.textContent = v || 'Not set';
      onchange(v);
      b.blur();
    };
    b.addEventListener('keyup', (e) => {
      if (!listening || !lone || e.key !== lone) return;
      e.preventDefault();
      finish({ Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' }[lone]);
    });
    b.addEventListener('keydown', (e) => {
      if (!listening) return;
      e.preventDefault();
      if (MOD_KEYS.has(e.key)) {
        lone = e.key;
        return;
      }
      lone = null;
      let v;
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') v = '';
      else {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.shiftKey) parts.push('Shift');
        if (e.altKey) parts.push('Alt');
        if (e.metaKey) parts.push('Meta');
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
        v = parts.join('+');
      }
      finish(v);
    });
    return b;
  }

  return { h, icon, tip, hideTip, popup, closeMenu, searchField, toggle, checkbox, spinner, combo, colorButton, hotkeyButton };
})();
