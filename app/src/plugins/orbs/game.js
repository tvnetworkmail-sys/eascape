'use strict';
// Status orbs, drawn over the game canvas by the minimap (game coordinates, scaled with the
// game). Values come from the runtime's player data; clicks ask the runtime to press the
// game's own buttons (see runtime.orb()).
const fs = require('fs');
const path = require('path');

// The minimap circle is centred at about (637, 82) with a radius of about 63. The orbs sit
// on an arc just outside it, down its left side (like the minimap orbs in RuneLite), above
// the side tab icons (which start at y 168). The world map button sits in the stone to the
// right of the minimap.
const ORB = { w: 60, h: 28, r: 13 };
const ARC = { x: 637, y: 82, radius: 79 };
const at = (deg) => ({ cx: Math.round(ARC.x + ARC.radius * Math.cos((deg * Math.PI) / 180)), cy: Math.round(ARC.y + ARC.radius * Math.sin((deg * Math.PI) / 180)) });
const ORBS = [
  { key: 'hitpoints', setting: 'showHitpoints', ...at(202), fill: [200, 24, 24], icon: 'orb_hitpoints.png' },
  { key: 'prayer', setting: 'showPrayer', ...at(180), fill: [44, 170, 200], icon: 'orb_prayer.png', click: 'prayer', tip: 'Open prayers' },
  { key: 'run', setting: 'showRun', ...at(158), fill: [214, 176, 22], icon: 'orb_run.png', click: 'run', tip: 'Toggle run' },
  { key: 'special', setting: 'showSpecial', ...at(136), fill: [52, 160, 52], icon: 'orb_special.png', click: 'spec', tip: 'Special attack' },
];
const GLOBE = { x: 725, y: 128, w: 30, h: 30 };

module.exports = function statusOrbs(ctx) {
  let off = null;
  let player = null;
  let loggedIn = false;
  const els = new Map();
  const icons = new Map();

  function loadFont() {
    if (loadFont.done) return;
    loadFont.done = true;
    try {
      const data = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'assets', 'fonts', 'runescape_small.ttf'));
      const face = new FontFace('LostLiteRSSmall', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      face.load().then((f) => { document.fonts.add(f); render(); }).catch(() => {});
    } catch { /* falls back to Arial */ }
  }

  function icon(file) {
    if (!icons.has(file)) {
      // The game page blocks file: URLs, so load the picture from its bytes.
      const img = new Image();
      const data = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'assets', 'game', file));
      img.src = URL.createObjectURL(new Blob([data], { type: 'image/png' }));
      img.onload = () => render();
      icons.set(file, img);
    }
    return icons.get(file);
  }

  function ensureStyle() {
    if (document.getElementById('lostlite-orbs-style')) return;
    const st = document.createElement('style');
    st.id = 'lostlite-orbs-style';
    st.textContent = `
      .ll-orb, .ll-orb * { visibility: visible !important; }
      .ll-orb { position: fixed; z-index: 2147483647; image-rendering: auto; }
      .ll-orb.click { cursor: pointer; }
    `;
    (document.head || document.documentElement).appendChild(st);
  }

  function element(key, w, h, click, tip) {
    let el = els.get(key);
    if (!el) {
      el = document.createElement('canvas');
      el.className = click ? 'll-orb click' : 'll-orb';
      if (tip) el.title = tip;
      // Clicks on an orb go to the orb, never to the game underneath.
      for (const t of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click', 'contextmenu']) {
        el.addEventListener(t, (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          // pointerdown, not mousedown: cancelling pointerdown stops the mouse events firing.
          if (t === 'pointerdown' && e.button === 0 && el.llClick) el.llClick();
        }, true);
      }
      document.body.appendChild(el);
      els.set(key, el);
    }
    // the click can change (the hitpoints orb while you're poisoned)
    el.llClick = click;
    el.className = click ? 'll-orb click' : 'll-orb';
    el.title = tip || '';
    const scale = (ctx.toGameScale() || 1) * (window.devicePixelRatio || 1);
    const W = Math.round(w * scale);
    const H = Math.round(h * scale);
    if (el.width !== W || el.height !== H) {
      el.width = W;
      el.height = H;
    }
    return { el, scale };
  }

  function place(el, x, y, w, h) {
    const c = ctx.canvas();
    const r = c.getBoundingClientRect();
    const s = r.width / 765;
    el.style.left = `${r.left + x * s}px`;
    el.style.top = `${r.top + y * s}px`;
    el.style.width = `${w * s}px`;
    el.style.height = `${h * s}px`;
  }

  /** Number colour from full (green) through yellow to empty (red). */
  function numberColour(p) {
    const r = Math.round(255 * Math.min(1, 2 * (1 - p)));
    const g = Math.round(255 * Math.min(1, 2 * p));
    return `rgb(${r}, ${g}, 0)`;
  }

  // OSRS: the hitpoints orb fills green while you're poisoned
  const POISONED = [40, 160, 40];

  function drawOrb(def, value, max, active, fill = def.fill) {
    // the hitpoints orb, while you're poisoned: click to drink an antipoison
    const poisoned = def.key === 'hitpoints' && fill === POISONED;
    const which = poisoned ? 'antipoison' : def.click;
    const click = which ? () => ctx.sendToGame({ type: 'orb', which }) : null;
    const { el, scale } = element(def.key, ORB.w, ORB.h, click, poisoned ? 'Cure poison' : def.tip);
    place(el, def.cx - (ORB.w - ORB.r - 2), def.cy - ORB.h / 2, ORB.w, ORB.h);
    el.style.display = 'block';
    const g = el.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, ORB.w, ORB.h);
    const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    const cx = ORB.w - ORB.r - 2;
    const cy = ORB.h / 2;
    // Number, right-aligned against the orb, in the RuneScape small font with a shadow.
    g.font = "16px 'LostLiteRSSmall', Arial, sans-serif";
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    const text = String(value);
    g.fillStyle = '#000';
    g.fillText(text, cx - ORB.r - 2 + 1, cy + 1 + 1);
    g.fillStyle = numberColour(p);
    g.fillText(text, cx - ORB.r - 2, cy + 1);
    // Ring: dark outline, then a stone band like the 2004 frames.
    g.beginPath();
    g.arc(cx, cy, ORB.r, 0, Math.PI * 2);
    g.fillStyle = '#16120d';
    g.fill();
    g.beginPath();
    g.arc(cx, cy, ORB.r - 1, 0, Math.PI * 2);
    g.fillStyle = active ? '#d8c27a' : '#6b5d48';
    g.fill();
    g.beginPath();
    g.arc(cx, cy, ORB.r - 3, 0, Math.PI * 2);
    g.fillStyle = '#1d1913';
    g.fill();
    // Fill from the bottom up to the percentage.
    g.save();
    g.beginPath();
    g.arc(cx, cy, ORB.r - 3, 0, Math.PI * 2);
    g.clip();
    const inner = (ORB.r - 3) * 2;
    const top = cy + (ORB.r - 3) - inner * p;
    const [fr, fg, fb] = fill;
    const grad = g.createLinearGradient(0, cy - ORB.r, 0, cy + ORB.r);
    grad.addColorStop(0, `rgb(${Math.min(255, fr + 60)}, ${Math.min(255, fg + 60)}, ${Math.min(255, fb + 60)})`);
    grad.addColorStop(1, `rgb(${fr * 0.55 | 0}, ${fg * 0.55 | 0}, ${fb * 0.55 | 0})`);
    g.fillStyle = grad;
    g.fillRect(cx - ORB.r, top, ORB.r * 2, ORB.r * 2);
    g.restore();
    // The 2004 icon on top.
    const img = icon(def.icon);
    if (img.complete && img.naturalWidth) {
      const size = 15;
      const k = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      g.imageSmoothingEnabled = true;
      g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
  }

  function drawGlobe() {
    const { el, scale } = element('globe', GLOBE.w, GLOBE.h, openMap, 'World map');
    place(el, GLOBE.x, GLOBE.y, GLOBE.w, GLOBE.h);
    el.style.display = 'block';
    const g = el.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, GLOBE.w, GLOBE.h);
    const c = GLOBE.w / 2;
    const r = 12;
    g.beginPath();
    g.arc(c, c, r + 1, 0, Math.PI * 2);
    g.fillStyle = '#16120d';
    g.fill();
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fillStyle = '#6b5d48';
    g.fill();
    // Sea and land, drawn in the minimap's own colours.
    g.save();
    g.beginPath();
    g.arc(c, c, r - 2, 0, Math.PI * 2);
    g.clip();
    const sea = g.createRadialGradient(c - 3, c - 3, 1, c, c, r);
    sea.addColorStop(0, '#5b86c6');
    sea.addColorStop(1, '#22406e');
    g.fillStyle = sea;
    g.fillRect(0, 0, GLOBE.w, GLOBE.h);
    g.fillStyle = '#4f7a2a';
    g.beginPath();
    g.ellipse(c - 3, c - 2, 5, 4, -0.4, 0, Math.PI * 2);
    g.ellipse(c + 5, c + 4, 4, 3, 0.5, 0, Math.PI * 2);
    g.ellipse(c - 4, c + 6, 2.5, 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(c - 4, c - 5, 4, 2, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The World Map plugin listens for this.
  function openMap() {
    window.dispatchEvent(new Event('lostlite-worldmap'));
  }

  function hideAll() {
    for (const el of els.values()) el.style.display = 'none';
  }

  function render() {
    if (!loggedIn || !player || !ctx.canvas()) {
      hideAll();
      return;
    }
    ensureStyle();
    loadFont();
    const p = player;
    const values = {
      hitpoints: [p.hitpoints, p.maxHitpoints, false],
      prayer: [p.prayer, p.maxPrayer, false],
      run: [p.runEnergy, 100, !!p.runOn],
      special: [p.specialAttack, 100, !!p.specialAttackOn],
    };
    for (const def of ORBS) {
      const [value, max, active] = values[def.key];
      if (!ctx.config(def.setting) || value == null) {
        const el = els.get(def.key);
        if (el) el.style.display = 'none';
        continue;
      }
      drawOrb(def, value, max, active, def.key === 'hitpoints' && p.poisoned ? POISONED : def.fill);
    }
    if (ctx.config('showWorldMap')) drawGlobe();
    else if (els.get('globe')) els.get('globe').style.display = 'none';
  }

  const onResize = () => render();

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player') {
          player = data;
          loggedIn = true;
          render();
        } else if (type === 'login-state') {
          loggedIn = !!data;
          if (!loggedIn) player = null;
          render();
        }
      });
      window.addEventListener('resize', onResize);
    },
    stop() {
      if (off) off();
      window.removeEventListener('resize', onResize);
      for (const el of els.values()) el.remove();
      els.clear();
    },
    configChanged: () => render(),
  };
};
