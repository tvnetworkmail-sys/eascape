'use strict';
// World map (3.5): opens over the game from the globe by the minimap (or its hotkey).
// The map pictures are drawn ahead of time from EASCape's 377 map data by
// tools/worldmap/render.py (the 2004 minimap's own colours, walls and scenery), one picture
// per 64 x 64 region and floor. This draws them with place names, map icons and you.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'ui', 'assets', 'worldmap');
const ZOOMS = [0.25, 0.375, 0.5, 0.75, 1, 1.5, 2, 3, 4]; // x the minimap's 4 px per tile
const ICON = 15; // map function icons are 15 x 15
const VIEW = { x: 4, y: 4, w: 512, h: 334 }; // the game's 3D view, in game pixels

module.exports = function worldMap(ctx) {
  let index = null;
  let icons = [];
  let labels = [];
  let iconSheet = null;
  const images = new Map(); // "level/rx_rz" -> Image (or null while loading / missing)

  let root = null;
  let canvas = null;
  let info = null;
  let open = false;
  let level = 0;
  let zoom = 4; // index into ZOOMS
  let cx = 3222; // view centre, in tiles
  let cz = 3218;
  let player = null;
  let follow = true;
  let drag = null;
  let mouse = null;
  let off = null;
  let raf = 0;
  let youIcon = null;
  let arrowIcon = null;
  const markers = new Map(); // source plugin -> [{ x, z, level, label }]
  const lines = new Map(); // source plugin -> [[{ x, z, level }]] (the Quest Helper's route)
  let pulseTimer = 0;

  /** Keeps the marker's glow moving while the map is open. */
  function pulse() {
    if (pulseTimer) return;
    pulseTimer = setTimeout(() => { pulseTimer = 0; draw(); }, 50);
  }

  // ---------------------------------------------------------------- data

  function load() {
    if (index) return;
    index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
    icons = JSON.parse(fs.readFileSync(path.join(DIR, 'icons.json'), 'utf8'));
    labels = JSON.parse(fs.readFileSync(path.join(DIR, 'labels.json'), 'utf8'));
    index.have = {};
    for (const [lv, list] of Object.entries(index.levels)) index.have[lv] = new Set(list.map(([x, z]) => `${x}_${z}`));
    iconSheet = picture(path.join(DIR, 'mapfunction.png'));
    youIcon = picture(path.join(__dirname, '..', '..', 'ui', 'assets', 'game', 'map_you.png'));
    arrowIcon = picture(path.join(__dirname, '..', '..', 'ui', 'assets', 'game', 'map_arrow.png'));
    loadFonts();
  }

  /** An <img> from a file's bytes (the game page blocks file: URLs). */
  function picture(file) {
    const img = new Image();
    img.onload = () => draw();
    img.src = URL.createObjectURL(new Blob([fs.readFileSync(file)], { type: 'image/png' }));
    return img;
  }

  function region(lv, rx, rz) {
    const key = `${lv}/${rx}_${rz}`;
    if (images.has(key)) return images.get(key);
    let img = null;
    if (index.have[lv] && index.have[lv].has(`${rx}_${rz}`)) img = picture(path.join(DIR, String(lv), `${rx}_${rz}.png`));
    images.set(key, img);
    return img;
  }

  function loadFonts() {
    for (const [family, file] of [['LostLiteRSBold', 'runescape_bold.ttf'], ['LostLiteRSSmall', 'runescape_small.ttf'], ['LostLiteRS', 'runescape.ttf']]) {
      try {
        const data = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'assets', 'fonts', file));
        const face = new FontFace(family, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        face.load().then((f) => { document.fonts.add(f); draw(); }).catch(() => {});
      } catch { /* system font */ }
    }
  }

  // ---------------------------------------------------------------- window

  function ensureStyle() {
    if (document.getElementById('lostlite-worldmap-style')) return;
    const st = document.createElement('style');
    st.id = 'lostlite-worldmap-style';
    st.textContent = `
      .ll-map, .ll-map * { visibility: visible !important; box-sizing: border-box; }
      .ll-map { position: fixed; z-index: 2147483647; background: #000; border: 2px solid #3e3529;
        box-shadow: inset 0 0 0 1px #6b5d48; display: flex; flex-direction: column; user-select: none;
        font-family: 'LostLiteRS', Arial, sans-serif; color: #ff981f; }
      .ll-map-bar { display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: #3e3529;
        border-bottom: 1px solid #1d1913; font-size: 16px; }
      .ll-map-bar .title { font-family: 'LostLiteRSBold', Arial, sans-serif; margin-right: auto; }
      .ll-map-bar button { font: inherit; font-size: 15px; color: #ff981f; background: #5a4d3b; border: 1px solid #1d1913;
        padding: 0 7px; cursor: pointer; line-height: 18px; }
      .ll-map-bar button.on { color: #fff; background: #7b6a4f; }
      .ll-map-bar button:hover { color: #fff; }
      .ll-map canvas { flex: 1; width: 100%; min-height: 0; cursor: grab; display: block; }
      .ll-map canvas.dragging { cursor: grabbing; }
      .ll-map-info { position: absolute; left: 8px; bottom: 6px; font-family: 'LostLiteRSSmall', Arial, sans-serif;
        font-size: 16px; color: #ff0; text-shadow: 1px 1px 0 #000; pointer-events: none; }
    `;
    (document.head || document.documentElement).appendChild(st);
  }

  function build() {
    ensureStyle();
    root = document.createElement('div');
    root.className = 'll-map';
    const bar = document.createElement('div');
    bar.className = 'll-map-bar';
    bar.innerHTML = '<span class="title">World Map</span>';
    for (let lv = 0; lv < 4; lv++) {
      const b = document.createElement('button');
      b.textContent = lv === 0 ? 'Ground' : `Floor ${lv}`;
      b.dataset.level = String(lv);
      b.title = lv === 0 ? 'Ground floor' : `Floor ${lv} (upstairs)`;
      b.addEventListener('click', () => { level = lv; follow = false; refreshBar(); draw(); });
      bar.appendChild(b);
    }
    const me = document.createElement('button');
    me.textContent = 'Me';
    me.title = 'Centre on you';
    me.addEventListener('click', () => { follow = true; if (player) { cx = player.x; cz = player.y; level = player.plane; } refreshBar(); draw(); });
    bar.appendChild(me);
    const close = document.createElement('button');
    close.textContent = 'X';
    close.title = 'Close (Esc)';
    close.addEventListener('click', hide);
    bar.appendChild(close);
    canvas = document.createElement('canvas');
    info = document.createElement('div');
    info.className = 'll-map-info';
    root.append(bar, canvas, info);
    // Nothing on the map reaches the game.
    for (const t of ['mousedown', 'mouseup', 'click', 'contextmenu', 'pointerdown', 'pointerup', 'wheel', 'mousemove', 'pointermove']) {
      root.addEventListener(t, (e) => e.stopPropagation());
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, cx, cz };
      follow = false;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (drag) {
        const s = scale();
        cx = drag.cx - (e.clientX - drag.x) / s;
        cz = drag.cz + (e.clientY - drag.y) / s;
      }
      draw();
    });
    const end = () => {
      drag = null;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('pointerleave', () => { mouse = null; draw(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const before = toTile(e.clientX - r.left, e.clientY - r.top);
      zoom = Math.max(0, Math.min(ZOOMS.length - 1, zoom + (e.deltaY < 0 ? 1 : -1)));
      const after = toTile(e.clientX - r.left, e.clientY - r.top);
      cx += before.x - after.x;
      cz += before.z - after.z;
      draw();
    }, { passive: false });
    document.body.appendChild(root);
  }

  function refreshBar() {
    if (!root) return;
    for (const b of root.querySelectorAll('[data-level]')) b.classList.toggle('on', Number(b.dataset.level) === level);
  }

  function placeWindow() {
    const c = ctx.canvas();
    if (!c || !root) return;
    // Over the 3D view only (4, 4, 512 x 334), so the minimap, tabs and chat stay usable.
    const r = c.getBoundingClientRect();
    const k = r.width / 765;
    root.style.left = `${r.left + VIEW.x * k}px`;
    root.style.top = `${r.top + VIEW.y * k}px`;
    root.style.width = `${VIEW.w * k}px`;
    root.style.height = `${VIEW.h * k}px`;
  }

  function show() {
    load();
    if (!root) build();
    open = true;
    if (player && follow) {
      cx = player.x;
      cz = player.y;
      level = player.plane;
    }
    refreshBar();
    root.style.display = 'flex';
    placeWindow();
    draw();
  }

  function hide() {
    open = false;
    if (root) root.style.display = 'none';
  }

  // ---------------------------------------------------------------- drawing

  function scale() {
    return index.pxPerTile * ZOOMS[zoom]; // CSS pixels per tile
  }

  function toTile(sx, sy) {
    const s = scale();
    return { x: cx + (sx - canvas.clientWidth / 2) / s, z: cz - (sy - canvas.clientHeight / 2) / s };
  }

  function toScreen(tx, tz) {
    const s = scale();
    return { x: (tx - cx) * s + canvas.clientWidth / 2, y: (cz - tz) * s + canvas.clientHeight / 2 };
  }

  function draw() {
    if (!open || !canvas) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  }

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const s = scale();
    g.imageSmoothingEnabled = ZOOMS[zoom] < 1;
    // Regions in view
    const tl = toTile(0, 0);
    const br = toTile(W, H);
    for (let rx = Math.floor(tl.x / 64); rx <= Math.floor(br.x / 64); rx++) {
      for (let rz = Math.floor(br.z / 64); rz <= Math.floor(tl.z / 64); rz++) {
        // Upper floors draw over the ground floor dimmed, so you can see where you are.
        if (level > 0) {
          const base = region(0, rx, rz);
          if (base && base.complete && base.naturalWidth) {
            const p = toScreen(rx * 64, rz * 64 + 64);
            g.globalAlpha = 0.35;
            g.drawImage(base, Math.floor(p.x), Math.floor(p.y), Math.ceil(64 * s), Math.ceil(64 * s));
            g.globalAlpha = 1;
          }
        }
        const img = region(level, rx, rz);
        if (img && img.complete && img.naturalWidth) {
          const p = toScreen(rx * 64, rz * 64 + 64);
          g.drawImage(img, Math.floor(p.x), Math.floor(p.y), Math.ceil(64 * s), Math.ceil(64 * s));
        }
      }
    }
    // Map icons (banks, shops, altars ...)
    if (ctx.config('showIcons') && iconSheet && iconSheet.complete) {
      const cols = Math.floor(iconSheet.naturalWidth / ICON);
      for (const [lv, x, z, f] of icons) {
        if (lv !== level || x < tl.x - 2 || x > br.x + 2 || z > tl.z + 2 || z < br.z - 2) continue;
        const p = toScreen(x + 0.5, z + 0.5);
        g.drawImage(iconSheet, (f % cols) * ICON, Math.floor(f / cols) * ICON, ICON, ICON, Math.round(p.x - ICON / 2), Math.round(p.y - ICON / 2), ICON, ICON);
      }
    }
    // Place names
    if (ctx.config('showLabels') && level === 0) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const l of labels) {
        const p = toScreen(l.x, l.z);
        if (p.x < -200 || p.y < -50 || p.x > W + 200 || p.y > H + 50) continue;
        if (l.size === 0 && ZOOMS[zoom] < 0.5) continue;
        const size = [13, 16, 20][l.size] || 16;
        g.font = `${size}px ${l.size === 2 ? "'LostLiteRSBold'" : l.size === 1 ? "'LostLiteRS'" : "'LostLiteRSSmall'"}, Arial, sans-serif`;
        const colour = l.size === 2 ? '#ffaa00' : '#ffffff';
        l.text.forEach((line, i) => {
          const y = p.y + (i - (l.text.length - 1) / 2) * size;
          g.fillStyle = '#000';
          g.fillText(line, p.x + 1, y + 1);
          g.fillStyle = colour;
          g.fillText(line, p.x, y);
        });
      }
    }
    // Routes from other plugins (the Quest Helper's walk): a line along the way.
    for (const list of lines.values()) {
      for (const line of list) {
        g.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        g.lineWidth = Math.max(2, Math.min(5, s * 1.2));
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.beginPath();
        let drawing = false;
        let prev = null;
        for (const pt of line) {
          // Stairs, ladders and trapdoors jump (to a dungeon far away on the map): no line.
          const jump = !prev || prev.via || Math.max(Math.abs(pt.x - prev.x), Math.abs(pt.z - prev.z)) > 64;
          prev = pt;
          if (pt.level !== level) {
            drawing = false;
            continue;
          }
          const p = toScreen(pt.x + 0.5, pt.z + 0.5);
          if (drawing && !jump) g.lineTo(p.x, p.y);
          else g.moveTo(p.x, p.y);
          drawing = true;
        }
        g.stroke();
      }
    }
    // Markers from other plugins (the Clue Helper's spot): the game's yellow map arrow.
    for (const list of markers.values()) {
      for (const m of list) {
        if (m.level !== level) continue;
        const p = toScreen(m.x + 0.5, m.z + 0.5);
        if (p.x < -20 || p.y < -20 || p.x > W + 20 || p.y > H + 20) continue;
        if (arrowIcon && arrowIcon.complete && arrowIcon.naturalWidth) {
          g.imageSmoothingEnabled = false;
          g.drawImage(arrowIcon, Math.round(p.x - 15), Math.round(p.y - 30), 30, 30);
        }
        if (m.label) {
          g.font = "16px 'LostLiteRSSmall', Arial, sans-serif";
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.fillStyle = '#000';
          g.fillText(m.label, p.x + 1, p.y - 30);
          g.fillStyle = '#ffff00';
          g.fillText(m.label, p.x, p.y - 31);
        }
      }
    }
    // You
    if (player && player.plane === level) {
      // "You are here": the game's own yellow click cross, with a soft pulsing glow.
      const p = toScreen(player.x + 0.5, player.y + 0.5);
      const t = (performance.now() % 1200) / 1200;
      const glow = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, 16 + 6 * Math.sin(t * Math.PI * 2));
      glow.addColorStop(0, 'rgba(255, 230, 80, 0.75)');
      glow.addColorStop(1, 'rgba(255, 200, 0, 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(p.x, p.y, 24, 0, Math.PI * 2);
      g.fill();
      if (youIcon && youIcon.complete && youIcon.naturalWidth) {
        g.imageSmoothingEnabled = false;
        g.drawImage(youIcon, Math.round(p.x - 12), Math.round(p.y - 12), 24, 24);
      }
      pulse();
    }
    // Tile under the mouse
    if (mouse) {
      const t = toTile(mouse.x, mouse.y);
      info.textContent = `${Math.floor(t.x)}, ${Math.floor(t.z)}${level ? `, floor ${level}` : ''}`;
    } else if (player) {
      info.textContent = `You: ${player.x}, ${player.y}${player.plane ? `, floor ${player.plane}` : ''}`;
    } else {
      info.textContent = '';
    }
  }

  // ---------------------------------------------------------------- input

  // Esc closes the open map; the map hotkey (Ctrl+M) goes through the hotkey system
  function onKey(e) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      hide();
    }
  }
  let offHotkey = null;

  // A click anywhere else in the game (minimap, tabs, chat) closes the map and still
  // does what it normally does.
  function onOutside(e) {
    if (open && root && !root.contains(e.target)) hide();
  }

  const onToggle = () => (open ? hide() : show());
  const onMarkers = (e) => {
    const d = e.detail || {};
    if (!d.source) return;
    markers.set(d.source, Array.isArray(d.markers) ? d.markers : []);
    lines.set(d.source, Array.isArray(d.lines) ? d.lines : []);
    draw();
  };
  const onResize = () => { placeWindow(); draw(); };

  return {
    start() {
      off = ctx.onRuntime((type, data) => {
        if (type === 'player' && data) {
          player = data;
          if (open) {
            if (follow) {
              cx = player.x;
              cz = player.y;
              level = player.plane;
              refreshBar();
            }
            draw();
          }
        } else if (type === 'login-state' && !data) {
          player = null;
        }
      });
      window.addEventListener('keydown', onKey, true);
      offHotkey = ctx.hotkey('hotkey', { pressed: onToggle });
      window.addEventListener('lostlite-worldmap', onToggle);
      window.addEventListener('resize', onResize);
      window.addEventListener('pointerdown', onOutside, true);
      window.addEventListener('lostlite-map-markers', onMarkers);
    },
    stop() {
      if (off) off();
      window.removeEventListener('keydown', onKey, true);
      if (offHotkey) offHotkey();
      offHotkey = null;
      window.removeEventListener('lostlite-worldmap', onToggle);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('lostlite-map-markers', onMarkers);
      hide();
      if (root) root.remove();
      root = null;
    },
    configChanged: () => draw(),
  };
};
