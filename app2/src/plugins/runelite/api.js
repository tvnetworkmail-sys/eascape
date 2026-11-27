// RuneLite's client core in the game page: the parts of net.runelite.api and net.runelite.client
// that its plugins use, translated from RuneLite's Java (BSD 2-Clause, Copyright (c) 2016-2018,
// Adam <Adam@sigterm.info> and RuneLite contributors; see the app's third-party notices).
//
//   Client facade      net.runelite.api.Client over the 2007 client's hook (window.__lostlite)
//   EventBus           @Subscribe methods (onGameTick, onChatMessage, onStatChanged, ...)
//   Overlays           Overlay, OverlayPanel, OverlayManager, OverlayRenderer (snap corners,
//                      Alt + drag, resize, reset, saved positions), OverlayUtil, Perspective
//   Components         PanelComponent, LineComponent, TitleComponent, TextComponent,
//                      BackgroundComponent, InfoBoxComponent, ProgressBarComponent,
//                      ImageComponent, TooltipComponent, SplitComponent
//   InfoBoxes          InfoBox, Counter, Timer, InfoBoxManager, InfoBoxOverlay
//   Tooltips           TooltipManager, TooltipOverlay
//   Plugins            Plugin base, PluginManager (each clone registers with rl.registerPlugin)
//
// Everything draws in canvas coordinates (765 x 503, as RuneLite's fixed mode) on one transparent
// canvas laid over the game canvas.
(() => {
  const ll = window.__lostlite;
  if (!ll) return;

  const CANVAS_W = 765;
  const CANVAS_H = 503;

  // ---------------------------------------------------------------- java.awt stand-ins

  class Color {
    constructor(r, g, b, a = 255) {
      if (typeof r === 'number' && g === undefined) {
        // new Color(rgb) / new Color(argb, true)
        const v = r >>> 0;
        this.r = (v >> 16) & 255; this.g = (v >> 8) & 255; this.b = v & 255; this.a = 255;
      } else {
        this.r = r | 0; this.g = g | 0; this.b = b | 0; this.a = a | 0;
      }
    }
    static decode(s) {
      return Color.parse(s) || Color.WHITE;
    }
    /** '#RRGGBB' / '#AARRGGBB' (RuneLite's config colours) -> Color, or null. */
    static parse(s) {
      if (s instanceof Color) return s;
      if (s === null || s === undefined || s === '') return null;
      if (typeof s === 'number') return new Color(s);
      const m = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(s).trim());
      if (!m) return null;
      const h = m[1];
      if (h.length === 6) return new Color(parseInt(h, 16));
      const n = parseInt(h, 16) >>> 0;
      return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, (n >>> 24) & 255);
    }
    getRed() { return this.r; }
    getGreen() { return this.g; }
    getBlue() { return this.b; }
    getAlpha() { return this.a; }
    getRGB() { return ((this.a << 24) | (this.r << 16) | (this.g << 8) | this.b) >>> 0; }
    brighter() {
      // java.awt.Color.brighter
      const F = 0.7;
      let { r, g, b } = this;
      const i = Math.floor(1.0 / (1.0 - F));
      if (r === 0 && g === 0 && b === 0) return new Color(i, i, i, this.a);
      if (r > 0 && r < i) r = i;
      if (g > 0 && g < i) g = i;
      if (b > 0 && b < i) b = i;
      return new Color(Math.min(Math.floor(r / F), 255), Math.min(Math.floor(g / F), 255), Math.min(Math.floor(b / F), 255), this.a);
    }
    darker() {
      const F = 0.7;
      return new Color(Math.max(Math.floor(this.r * F), 0), Math.max(Math.floor(this.g * F), 0), Math.max(Math.floor(this.b * F), 0), this.a);
    }
    css() { return `rgba(${this.r},${this.g},${this.b},${this.a / 255})`; }
    equals(o) { return o instanceof Color && o.getRGB() === this.getRGB(); }
  }
  Object.assign(Color, {
    WHITE: new Color(255, 255, 255), BLACK: new Color(0, 0, 0), RED: new Color(255, 0, 0), GREEN: new Color(0, 255, 0),
    BLUE: new Color(0, 0, 255), YELLOW: new Color(255, 255, 0), ORANGE: new Color(255, 200, 0), CYAN: new Color(0, 255, 255),
    MAGENTA: new Color(255, 0, 255), PINK: new Color(255, 175, 175), GRAY: new Color(128, 128, 128), LIGHT_GRAY: new Color(192, 192, 192),
    DARK_GRAY: new Color(64, 64, 64),
  });

  class Point {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    getX() { return this.x; }
    getY() { return this.y; }
    setLocation(x, y) { if (x instanceof Point) { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } }
    translate(dx, dy) { this.x += dx; this.y += dy; }
  }
  class Dimension {
    constructor(width = 0, height = 0) { this.width = width; this.height = height; }
  }
  class Rectangle {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      if (x instanceof Rectangle) { this.x = x.x; this.y = x.y; this.width = x.width; this.height = x.height; return; }
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
    contains(px, py) {
      if (px instanceof Point) { py = px.y; px = px.x; }
      return px >= this.x && py >= this.y && px < this.x + this.width && py < this.y + this.height;
    }
    intersects(o) { return o.x < this.x + this.width && o.x + o.width > this.x && o.y < this.y + this.height && o.y + o.height > this.y; }
    isEmpty() { return this.width <= 0 || this.height <= 0; }
    setBounds(x, y, w, h) { if (x instanceof Rectangle) { ({ x, y, width: w, height: h } = x); } this.x = x; this.y = y; this.width = w; this.height = h; }
    setLocation(x, y) { if (x instanceof Point) { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } }
    setSize(w, h) { if (w instanceof Dimension) { this.width = w.width; this.height = w.height; } else { this.width = w; this.height = h; } }
    getSize() { return new Dimension(this.width, this.height); }
    translate(dx, dy) { this.x += dx; this.y += dy; }
    getMaxX() { return this.x + this.width; }
    getMaxY() { return this.y + this.height; }
    getCenterX() { return this.x + this.width / 2; }
    getCenterY() { return this.y + this.height / 2; }
    getX() { return this.x; }
    getY() { return this.y; }
    getWidth() { return this.width; }
    getHeight() { return this.height; }
  }
  class Polygon {
    constructor(xs = [], ys = [], n = xs.length) { this.xpoints = Array.from(xs).slice(0, n); this.ypoints = Array.from(ys).slice(0, n); this.npoints = n; }
    addPoint(x, y) { this.xpoints.push(x); this.ypoints.push(y); this.npoints++; }
    getBounds() {
      const x0 = Math.min(...this.xpoints); const y0 = Math.min(...this.ypoints);
      return new Rectangle(x0, y0, Math.max(...this.xpoints) - x0, Math.max(...this.ypoints) - y0);
    }
    contains(px, py) {
      if (px instanceof Point) { py = px.y; px = px.x; }
      let inside = false;
      for (let i = 0, j = this.npoints - 1; i < this.npoints; j = i++) {
        const xi = this.xpoints[i]; const yi = this.ypoints[i]; const xj = this.xpoints[j]; const yj = this.ypoints[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
  }
  class BasicStroke {
    // (width, cap, join, miterlimit, dash, dashPhase): only the width and the dash pattern are drawn
    constructor(width = 1, cap, join, miter, dash, phase) { this.width = width; this.dash = Array.isArray(dash) ? dash : null; this.dashPhase = phase || 0; }
    getLineWidth() { return this.width; }
  }

  // FontManager: RuneScape (16), RuneScape Small (16), RuneScape Bold (16)
  class Font {
    constructor(family, size, ascent, descent) { this.family = family; this.size = size; this.ascent = ascent; this.descent = descent; }
    css() { return `${this.size}px ${this.family}, sans-serif`; }
    deriveFont(size) { return new Font(this.family, size, Math.round((this.ascent * size) / this.size), Math.round((this.descent * size) / this.size)); }
  }
  // ascent/descent from the TTFs' hhea tables (units per em 1024) at 16 px
  const FontManager = {
    runescape: new Font('RLRuneScape', 16, 14, 2),
    small: new Font('RLRuneScapeSmall', 16, 11, 1),
    bold: new Font('RLRuneScapeBold', 16, 14, 2),
    getRunescapeFont() { return this.runescape; },
    getRunescapeSmallFont() { return this.small; },
    getRunescapeBoldFont() { return this.bold; },
    // FontManager.getDefaultFont: Java's Dialog 12 (for glyphs the RuneScape fonts lack, e.g. \u2713)
    defaultFont: new Font('Dialog', 12, 11, 3),
    getDefaultFont() { return this.defaultFont; },
  };
  const FontType = {
    REGULAR: { getFont: () => FontManager.runescape },
    BOLD: { getFont: () => FontManager.bold },
    SMALL: { getFont: () => FontManager.small },
  };

  // ---------------------------------------------------------------- Graphics2D over a canvas

  const measureCtx = document.createElement('canvas').getContext('2d');
  function stringWidth(font, s) {
    measureCtx.font = font.css();
    return Math.round(measureCtx.measureText(String(s)).width);
  }
  class FontMetrics {
    constructor(font) { this.font = font; }
    stringWidth(s) { return stringWidth(this.font, s); }
    getHeight() { return this.font.ascent + this.font.descent; }
    getAscent() { return this.font.ascent; }
    getDescent() { return this.font.descent; }
  }

  const imageCache = new WeakMap();
  /** The 2007 client's sprites ({ w, h, px }) and data URLs as drawable images (BufferedImage). */
  function toImage(img) {
    if (!img) return null;
    if ((typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) || (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement)) return img;
    if (img.px && img.w) {
      let c = imageCache.get(img);
      if (c) return c;
      c = document.createElement('canvas');
      c.width = img.w; c.height = img.h;
      const cx = c.getContext('2d');
      const data = cx.createImageData(img.w, img.h);
      for (let i = 0; i < img.px.length; i++) {
        const p = img.px[i];
        data.data[i * 4] = (p >> 16) & 255; data.data[i * 4 + 1] = (p >> 8) & 255; data.data[i * 4 + 2] = p & 255; data.data[i * 4 + 3] = (p >>> 24) & 255;
      }
      cx.putImageData(data, 0, 0);
      imageCache.set(img, c);
      return c;
    }
    return null;
  }
  const imgW = (img) => (img ? img.width || img.w || 0 : 0);
  const imgH = (img) => (img ? img.height || img.h || 0 : 0);

  class Graphics2D {
    constructor(ctx) {
      this.ctx = ctx;
      this.color = Color.WHITE;
      this.font = FontManager.runescape;
      this.stroke = new BasicStroke(1);
      this.tx = 0; this.ty = 0;
      this.scale = 1; // < 1 for panel overlays drawn at UI scale over an enlarged game (see uiScale)
      this.clip = null;
    }
    setColor(c) { this.color = c instanceof Color ? c : Color.parse(c) || Color.WHITE; }
    getColor() { return this.color; }
    setPaint(c) { if (c) this.setColor(c); }
    getPaint() { return this.color; }
    setFont(f) { if (f) this.font = f; }
    getFont() { return this.font; }
    setStroke(s) { this.stroke = s || new BasicStroke(1); }
    getStroke() { return this.stroke; }
    getFontMetrics(f) { return new FontMetrics(f || this.font); }
    setRenderingHint() {}
    setComposite() {}
    getComposite() { return null; }
    translate(x, y) { this.tx += x; this.ty += y; }
    getTransform() { return { tx: this.tx, ty: this.ty, scale: this.scale }; }
    setTransform(t) { this.tx = t.tx; this.ty = t.ty; if (t.scale) this.scale = t.scale; }
    // (core) baseHoles: the renderer's holes for the overlay being drawn (UNDER_WIDGETS / ABOVE_SCENE under the open
    // interfaces), kept when the overlay sets its own clip
    setClip(r) { this.clip = r ? new Rectangle(r) : null; this.clipHoles = this.baseHoles || null; }
    /** (core) rectangles cut out of the clip: the open interfaces world overlays are drawn under */
    setClipHoles(list) { this.clipHoles = list && list.length ? list : null; }
    getClip() { return this.clip; }
    _begin() {
      const c = this.ctx;
      c.save();
      if (this.clip || this.clipHoles) {
        const r = this.clip || { x: 0, y: 0, width: c.canvas ? c.canvas.width : 4096, height: c.canvas ? c.canvas.height : 4096 };
        c.beginPath(); c.rect(r.x, r.y, r.width, r.height);
        if (this.clipHoles) { for (const h of this.clipHoles) c.rect(h.x, h.y, h.width, h.height); c.clip('evenodd'); } else c.clip();
      }
      c.translate(this.tx, this.ty);
      if (this.scale !== 1) c.scale(this.scale, this.scale);
    }
    drawString(s, x, y) {
      if (s === null || s === undefined || s === '') return;
      this._begin();
      const c = this.ctx;
      c.font = this.font.css();
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.fillStyle = this.color.css();
      c.fillText(String(s), Math.round(x), Math.round(y));
      c.restore();
    }
    fillRect(x, y, w, h) { this._begin(); this.ctx.fillStyle = this.color.css(); this.ctx.fillRect(x, y, w, h); this.ctx.restore(); }
    clearRect(x, y, w, h) { this._begin(); this.ctx.clearRect(x, y, w, h); this.ctx.restore(); }
    /** Java: outline covering w + 1 by h + 1 pixels */
    drawRect(x, y, w, h) {
      this._begin();
      const c = this.ctx;
      c.strokeStyle = this.color.css();
      c.lineWidth = this.stroke.width;
      if (this.stroke.dash && c.setLineDash) { c.setLineDash(this.stroke.dash); c.lineDashOffset = this.stroke.dashPhase; }
      const o = this.stroke.width % 2 ? 0.5 : 0;
      c.strokeRect(x + o, y + o, w, h);
      c.restore();
    }
    drawLine(x0, y0, x1, y1) {
      this._begin();
      const c = this.ctx;
      c.strokeStyle = this.color.css();
      c.lineWidth = this.stroke.width;
      c.beginPath(); c.moveTo(x0 + 0.5, y0 + 0.5); c.lineTo(x1 + 0.5, y1 + 0.5); c.stroke();
      c.restore();
    }
    _path(shape) {
      const c = this.ctx;
      c.beginPath();
      if (shape instanceof Rectangle) { c.rect(shape.x, shape.y, shape.width, shape.height); return true; }
      if (shape instanceof Polygon || (shape && shape.xpoints)) {
        if (!shape.npoints) return false;
        c.moveTo(shape.xpoints[0], shape.ypoints[0]);
        for (let i = 1; i < shape.npoints; i++) c.lineTo(shape.xpoints[i], shape.ypoints[i]);
        c.closePath();
        return true;
      }
      if (shape && shape.ellipse) { const e = shape.ellipse; c.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); return true; }
      if (shape && shape.arc) { const a = shape.arc; c.moveTo(a.cx, a.cy); c.arc(a.cx, a.cy, a.r, a.start, a.end, a.ccw); c.closePath(); return true; }
      return false;
    }
    fill(shape) { this._begin(); if (this._path(shape)) { this.ctx.fillStyle = this.color.css(); this.ctx.fill(); } this.ctx.restore(); }
    draw(shape) {
      if (shape instanceof Rectangle) { this.drawRect(shape.x, shape.y, shape.width, shape.height); return; }
      this._begin();
      if (this._path(shape)) { this.ctx.strokeStyle = this.color.css(); this.ctx.lineWidth = this.stroke.width; this.ctx.stroke(); }
      this.ctx.restore();
    }
    fillPolygon(p) { this.fill(p); }
    drawPolygon(p) { this.draw(p); }
    fillOval(x, y, w, h) { this.fill({ ellipse: { x, y, w, h } }); }
    drawOval(x, y, w, h) { this.draw({ ellipse: { x: x + 0.5, y: y + 0.5, w, h } }); }
    drawImage(img, x, y, w, h) {
      const el = toImage(img);
      if (!el) return;
      this._begin();
      this.ctx.imageSmoothingEnabled = false;
      if (typeof w === 'number' && typeof h === 'number') this.ctx.drawImage(el, Math.round(x), Math.round(y), w, h);
      else this.ctx.drawImage(el, Math.round(x), Math.round(y));
      this.ctx.restore();
    }
  }

  // the 2007 client's named colour tags ("@or1@")
  const AT_COLOURS = { red: 0xff0000, gre: 0x00ff00, blu: 0x0000ff, yel: 0xffff00, cya: 0x00ffff, mag: 0xff00ff, whi: 0xffffff, bla: 0x000000, lre: 0xff9040,
    dre: 0x800000, dbl: 0x000080, or1: 0xffb000, or2: 0xff7000, or3: 0xff3000, gr1: 0xc0ff00, gr2: 0x80ff00, gr3: 0x40ff00 };
  const AT_NAMES = new Map(Object.entries(AT_COLOURS).map(([k, v]) => [v, k]));
  const Text = {
    fromCSV: (input) => String(input == null ? '' : input).split(',').map((x) => x.trim()).filter((x) => x.length),
    toCSV: (input) => [...input].filter((x) => x != null).join(','),
    /** Text.standardize: no tags, no-break spaces as spaces, trimmed, lower case */
    standardize: (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\u00a0/g, ' ').trim().toLowerCase(),
    removeTags: (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/@[a-z0-9~]{3}@/gi, ''),
    /** "@whi@" style game tags -> RuneLite's "<col=ffffff>" */
    fromGameTags(s) {
      return String(s == null ? '' : s).replace(/@([a-z0-9~]{3})@/gi, (m, t) => {
        const n = t.toLowerCase();
        const rgb = n in AT_COLOURS ? AT_COLOURS[n] : ll.tagColour ? ll.tagColour(n) : -1;
        return typeof rgb === 'number' && rgb >= 0 ? `<col=${(rgb & 0xffffff).toString(16).padStart(6, '0')}>` : '';
      });
    },
    titleCase: (s) => String(s).toLowerCase().replace(/(^|[\s_])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/_/g, ' '),
  };
  const ColorUtil = {
    wrapWithColorTag: (s, c) => `<col=${(c.getRGB() & 0xffffff).toString(16).padStart(6, '0')}>${s}</col>`,
    prependColorTag: (s, c) => `<col=${(c.getRGB() & 0xffffff).toString(16).padStart(6, '0')}>${s}`,
    colorWithAlpha: (c, a) => new Color(c.r, c.g, c.b, a),
    colorToHexCode: (c) => (c.getRGB() & 0xffffff).toString(16).padStart(6, '0'),
    colorTag: (c) => `<col=${(c.getRGB() & 0xffffff).toString(16).padStart(6, '0')}>`,
  };

  // ---------------------------------------------------------------- components

  const ComponentConstants = { STANDARD_BORDER: 4, STANDARD_WIDTH: 129, STANDARD_BACKGROUND_COLOR: new Color(70, 61, 50, 156) };
  const ComponentOrientation = { VERTICAL: 'VERTICAL', HORIZONTAL: 'HORIZONTAL' };

  class BackgroundComponent {
    constructor(backgroundColor = ComponentConstants.STANDARD_BACKGROUND_COLOR, rectangle = new Rectangle(), fill = true) {
      this.backgroundColor = backgroundColor; this.rectangle = rectangle; this.fill = fill;
    }
    setBackgroundColor(c) { this.backgroundColor = c; }
    setRectangle(r) { this.rectangle = r; }
    setFill(f) { this.fill = f; }
    render(graphics) {
      const c = this.backgroundColor;
      const outside = new Color(Math.floor(c.r * 0.8), Math.floor(c.g * 0.8), Math.floor(c.b * 0.8), Math.min(255, Math.floor(c.a * 1.4)));
      const inside = new Color(Math.min(255, Math.floor(c.r * 1.2)), Math.min(255, Math.floor(c.g * 1.2)), Math.min(255, Math.floor(c.b * 1.2)), Math.min(255, Math.floor(c.a * 1.4)));
      const r = this.rectangle;
      if (this.fill) { graphics.setColor(c); graphics.fill(r); }
      graphics.setColor(outside);
      graphics.draw(new Rectangle(r.x, r.y, r.width - 1, r.height - 1));
      graphics.setColor(inside);
      graphics.draw(new Rectangle(r.x + 1, r.y + 1, r.width - 3, r.height - 3));
      return new Dimension(r.width, r.height);
    }
  }

  class TextComponent {
    constructor() { this.text = ''; this.x = 0; this.y = 0; this.color = Color.WHITE; this.outline = false; this.font = null; }
    setText(t) { this.text = t == null ? '' : String(t); }
    setPosition(x, y) { if (x instanceof Point) { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } }
    setColor(c) { this.color = c; }
    setOutline(o) { this.outline = o; }
    setFont(f) { this.font = f; }
    render(graphics) {
      let orig = null;
      if (this.font) { orig = graphics.getFont(); graphics.setFont(this.font); }
      const fm = graphics.getFontMetrics();
      const re = /<col=([0-9a-fA-F]{2,6})>/g;
      const text = Text.fromGameTags(this.text).replace(/<\/col>/g, '<col=ffffff>');
      let col = this.color;
      let idx = 0;
      let width = 0;
      let m;
      while ((m = re.exec(text))) {
        const s = text.substring(idx, m.index).replace(/<[^>]*>/g, '');
        idx = re.lastIndex;
        this._text(graphics, col, this.x + width, this.y, s);
        width += fm.stringWidth(s);
        col = Color.decode('#' + m[1].padStart(6, '0'));
      }
      const s = text.substring(idx).replace(/<[^>]*>/g, '');
      this._text(graphics, col, this.x + width, this.y, s);
      width += fm.stringWidth(s);
      const height = fm.getHeight();
      if (orig) graphics.setFont(orig);
      return new Dimension(width, height);
    }
    _text(graphics, color, x, y, text) {
      if (!text) return;
      graphics.setColor(Color.BLACK);
      if (this.outline) {
        graphics.drawString(text, x, y + 1); graphics.drawString(text, x, y - 1);
        graphics.drawString(text, x + 1, y); graphics.drawString(text, x - 1, y);
      } else {
        graphics.drawString(text, x + 1, y + 1);
      }
      graphics.setColor(color);
      graphics.drawString(text, x, y);
    }
  }

  class LayoutableRenderableEntity {
    constructor() { this.preferredLocation = new Point(); this.preferredSize = new Dimension(ComponentConstants.STANDARD_WIDTH, 0); this.bounds = new Rectangle(); }
    setPreferredLocation(p) { this.preferredLocation = p; }
    setPreferredSize(d) { this.preferredSize = d; }
    getBounds() { return this.bounds; }
  }

  class TitleComponent extends LayoutableRenderableEntity {
    constructor(o = {}) { super(); this.text = o.text || ''; this.color = o.color || Color.WHITE; }
    static builder() { return builder(TitleComponent); }
    render(graphics) {
      const fm = graphics.getFontMetrics();
      const t = new TextComponent();
      t.setText(this.text);
      t.setColor(this.color);
      t.setPosition(this.preferredLocation.x + Math.trunc((this.preferredSize.width - fm.stringWidth(Text.removeTags(this.text))) / 2), this.preferredLocation.y + fm.getHeight());
      const r = t.render(graphics);
      const d = new Dimension(this.preferredSize.width, r.height);
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  function lineBreakText(text, maxWidth, fm) {
    const words = text.split(' ');
    if (!words.length) return [];
    let wrapped = words[0];
    let spaceLeft = maxWidth - fm.stringWidth(wrapped);
    for (let i = 1; i < words.length; i++) {
      const wl = fm.stringWidth(words[i]);
      const sw = fm.stringWidth(' ');
      if (wl + sw > spaceLeft) { wrapped += '\n' + words[i]; spaceLeft = maxWidth - wl; } else { wrapped += ' ' + words[i]; spaceLeft -= sw + wl; }
    }
    return wrapped.split('\n');
  }

  class LineComponent extends LayoutableRenderableEntity {
    constructor(o = {}) {
      super();
      this.left = o.left; this.right = o.right; this.leftColor = o.leftColor || Color.WHITE; this.rightColor = o.rightColor || Color.WHITE;
      this.leftFont = o.leftFont || null; this.rightFont = o.rightFont || null;
    }
    static builder() { return builder(LineComponent); }
    render(graphics) {
      const left = this.left == null ? '' : String(this.left);
      const right = this.right == null ? '' : String(this.right);
      const lf = this.leftFont || graphics.getFont();
      const rf = this.rightFont || graphics.getFont();
      const lfm = graphics.getFontMetrics(lf); const rfm = graphics.getFontMetrics(rf);
      const fmh = Math.max(lfm.getHeight(), rfm.getHeight());
      const x = this.preferredLocation.x;
      const baseY = this.preferredLocation.y + fmh;
      let y = baseY;
      const lw = lfm.stringWidth(Text.removeTags(left));
      const rw = rfm.stringWidth(Text.removeTags(right));
      const tc = new TextComponent();
      const W = this.preferredSize.width;
      if (W < lw + rw) {
        let lsw = W; let rsw = 0;
        if (right) { rsw = Math.trunc(W / 3); lsw -= rsw; }
        const ls = lineBreakText(left, lsw, lfm); const rs = lineBreakText(right, rsw, rfm);
        const n = Math.max(ls.length, rs.length);
        for (let i = 0; i < n; i++) {
          if (i < ls.length) { tc.setPosition(x, y); tc.setText(ls[i]); tc.setColor(this.leftColor); tc.setFont(lf); tc.render(graphics); }
          if (i < rs.length) { tc.setPosition(x + W - rfm.stringWidth(Text.removeTags(rs[i])), y); tc.setText(rs[i]); tc.setColor(this.rightColor); tc.setFont(rf); tc.render(graphics); }
          y += fmh;
        }
      } else {
        if (left) { tc.setPosition(x, y); tc.setText(left); tc.setColor(this.leftColor); tc.setFont(lf); tc.render(graphics); }
        if (right) { tc.setPosition(x + W - rw, y); tc.setText(right); tc.setColor(this.rightColor); tc.setFont(rf); tc.render(graphics); }
        y += fmh;
      }
      const d = new Dimension(W, y - baseY);
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  class ProgressBarComponent extends LayoutableRenderableEntity {
    constructor() {
      super();
      this.minimum = 0; this.maximum = 100; this.value = 0; this.labelDisplayMode = 'PERCENTAGE';
      this.foregroundColor = new Color(82, 161, 82); this.backgroundColor = new Color(255, 255, 255, 127);
      this.fontColor = Color.WHITE; this.left = ''; this.right = ''; this.center = '';
      this.preferredSize = new Dimension(ComponentConstants.STANDARD_WIDTH, 16);
    }
    setMinimum(v) { this.minimum = v; }
    setMaximum(v) { this.maximum = v; }
    setValue(v) { this.value = v; }
    setForegroundColor(c) { this.foregroundColor = c; }
    setBackgroundColor(c) { this.backgroundColor = c; }
    setFontColor(c) { this.fontColor = c; }
    setLabelDisplayMode(m) { this.labelDisplayMode = m; }
    setLeftLabel(s) { this.left = s; }
    setRightLabel(s) { this.right = s; }
    setCenterLabel(s) { this.center = s; }
    render(graphics) {
      const fm = graphics.getFontMetrics();
      const bx = this.preferredLocation.x; const by = this.preferredLocation.y;
      const span = this.maximum - this.minimum;
      const current = Math.min(this.value, this.maximum) - this.minimum;
      const pc = span ? current / span : 0;
      let text;
      if (this.labelDisplayMode === 'FULL') text = `${Math.trunc(current)}/${Math.trunc(span)}`;
      else if (this.labelDisplayMode === 'BOTH') text = `${Math.trunc(current)}/${Math.trunc(span)} (${(pc * 100).toFixed(1)}%)`;
      else if (this.labelDisplayMode === 'TEXT_ONLY') text = this.center;
      else text = `${(pc * 100).toFixed(1)}%`;
      const width = this.preferredSize.width;
      const height = Math.max(this.preferredSize.height, 16);
      const progressX = Math.trunc(width * pc);
      graphics.setColor(this.backgroundColor); graphics.fillRect(bx + progressX, by, width - progressX, height);
      graphics.setColor(this.foregroundColor); graphics.fillRect(bx, by, progressX, height);
      const ty = by + Math.trunc(height / 2) + Math.trunc(fm.getHeight() / 2) - 1;
      const tc = new TextComponent();
      tc.setColor(this.fontColor);
      if (this.left) { tc.setPosition(bx + 2, ty); tc.setText(this.left); tc.render(graphics); }
      if (this.right) { tc.setPosition(bx + width - fm.stringWidth(this.right) - 2, ty); tc.setText(this.right); tc.render(graphics); }
      if (text) { tc.setPosition(bx + Math.trunc((width - fm.stringWidth(text)) / 2), ty); tc.setText(text); tc.render(graphics); }
      const d = new Dimension(width, height);
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  // ProgressPieComponent: a pie from 12 o'clock, counter-clockwise by progress (Arc2D start 90, extent progress * 360)
  class ProgressPieComponent {
    constructor() { this.diameter = 25; this.borderColor = Color.WHITE; this.fill = Color.WHITE; this.stroke = new BasicStroke(1); this.progress = 0; this.position = null; }
    setDiameter(d) { this.diameter = d; } setBorderColor(c) { this.borderColor = c; } setFill(c) { this.fill = c; }
    setStroke(s) { this.stroke = s; } setProgress(p) { this.progress = p; } setPosition(p) { this.position = p; }
    setBorder(border, size) { this.borderColor = border; this.stroke = new BasicStroke(size); }
    render(graphics) {
      const d = this.diameter; const x = this.position.getX() - Math.trunc(d / 2); const y = this.position.getY() - Math.trunc(d / 2);
      const r = d / 2; const start = -Math.PI / 2;
      graphics.setColor(this.fill);
      graphics.fill({ arc: { cx: x + r, cy: y + r, r, start, end: start - this.progress * Math.PI * 2, ccw: true } });
      graphics.setStroke(this.stroke);
      graphics.setColor(this.borderColor);
      graphics.drawOval(x, y, d, d);
      return new Dimension(d, d);
    }
  }

  class ImageComponent extends LayoutableRenderableEntity {
    constructor(image) { super(); this.image = image; }
    render(graphics) {
      if (!this.image) return null;
      graphics.drawImage(this.image, this.preferredLocation.x, this.preferredLocation.y);
      const d = new Dimension(imgW(this.image), imgH(this.image));
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  class SplitComponent extends LayoutableRenderableEntity {
    constructor(o = {}) { super(); this.first = o.first; this.second = o.second; this.orientation = o.orientation || ComponentOrientation.VERTICAL; this.gap = o.gap || new Point(0, 0); }
    static builder() { return builder(SplitComponent); }
    render(graphics) {
      this.first.setPreferredLocation(this.preferredLocation);
      this.first.setPreferredSize(this.preferredSize);
      const fd = this.first.render(graphics);
      let x = 0; let y = 0;
      if (this.orientation === ComponentOrientation.VERTICAL) y = fd.height + this.gap.y; else x = fd.width + this.gap.x;
      this.second.setPreferredLocation(new Point(x + this.preferredLocation.x, y + this.preferredLocation.y));
      this.second.setPreferredSize(new Dimension(this.preferredSize.width - x, this.preferredSize.height - y));
      const sd = this.second.render(graphics);
      const d = this.orientation === ComponentOrientation.VERTICAL
        ? new Dimension(Math.max(fd.width, sd.width), y + sd.height)
        : new Dimension(x + sd.width, Math.max(fd.height, sd.height));
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  class PanelComponent extends LayoutableRenderableEntity {
    constructor() {
      super();
      this.backgroundColor = ComponentConstants.STANDARD_BACKGROUND_COLOR;
      this.children = [];
      this.orientation = ComponentOrientation.VERTICAL;
      this.wrap = false;
      const b = ComponentConstants.STANDARD_BORDER;
      this.border = new Rectangle(b, b, b, b);
      this.gap = new Point(0, 0);
      this.childDimensions = new Dimension();
    }
    getChildren() { return this.children; }
    setBackgroundColor(c) { this.backgroundColor = c; }
    setOrientation(o) { this.orientation = o; }
    setWrap(w) { this.wrap = w; }
    setBorder(r) { this.border = r; }
    setGap(p) { this.gap = p; }
    getPreferredSize() { return this.preferredSize; }
    render(graphics) {
      if (!this.children.length) return null;
      const b = this.border;
      const dim = new Dimension(b.x + this.childDimensions.width + b.width, b.y + this.childDimensions.height + b.height);
      if (this.backgroundColor) {
        const bg = new BackgroundComponent(this.backgroundColor, new Rectangle(this.preferredLocation.x, this.preferredLocation.y, dim.width, dim.height));
        bg.render(graphics);
      }
      const baseX = this.preferredLocation.x + b.x;
      const baseY = this.preferredLocation.y + b.y;
      let width = 0; let height = 0; let x = baseX; let y = baseY;
      const cps = new Dimension(this.preferredSize.width - b.x - b.width, this.preferredSize.height - b.y - b.height);
      let totalHeight = 0; let totalWidth = 0;
      for (const child of this.children) {
        if (!this.wrap) {
          if (this.orientation === ComponentOrientation.VERTICAL) child.setPreferredSize(new Dimension(cps.width, 0));
          else child.setPreferredSize(new Dimension(0, cps.height));
        }
        child.setPreferredLocation(new Point(x, y));
        const cd = child.render(graphics) || new Dimension();
        if (this.orientation === ComponentOrientation.VERTICAL) { height += cd.height + this.gap.y; y = baseY + height; width = Math.max(width, cd.width); }
        else { width += cd.width + this.gap.x; x = baseX + width; height = Math.max(height, cd.height); }
        totalWidth = Math.max(totalWidth, width);
        totalHeight = Math.max(totalHeight, height);
        if (!this.wrap) continue;
        if (this.orientation === ComponentOrientation.VERTICAL) {
          if (cps.height > 0 && height >= cps.height) { height = 0; y = baseY; const diff = cd.width + this.gap.x; x += diff; width += diff; }
        } else if (cps.width > 0 && width >= cps.width) { width = 0; x = baseX; const diff = cd.height + this.gap.y; y += diff; height += diff; }
      }
      if (this.orientation === ComponentOrientation.HORIZONTAL) totalWidth -= this.gap.x; else totalHeight -= this.gap.y;
      this.childDimensions = new Dimension(totalWidth, totalHeight);
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(dim);
      return dim;
    }
  }

  class InfoBoxComponent extends LayoutableRenderableEntity {
    constructor() {
      super();
      this.preferredSize = new Dimension(32, 32);
      this.text = ''; this.color = Color.WHITE; this.font = FontManager.runescape; this.outline = false;
      this.backgroundColor = ComponentConstants.STANDARD_BACKGROUND_COLOR; this.image = null; this.tooltip = null; this.infoBox = null;
    }
    getTooltip() { return this.tooltip; }
    size() { return Math.max(this.preferredSize.width, this.preferredSize.height); }
    render(graphics) {
      if (!this.image) return new Dimension();
      graphics.setFont(this.size() < 32 ? FontManager.small : this.font);
      const bx = this.preferredLocation.x; const by = this.preferredLocation.y;
      const fm = graphics.getFontMetrics();
      const size = this.size();
      const r = new Rectangle(bx, by, size, size);
      new BackgroundComponent(this.backgroundColor, r).render(graphics);
      graphics.drawImage(this.image, bx + Math.trunc((size - imgW(this.image)) / 2), by + Math.trunc((size - imgH(this.image)) / 2));
      if (this.text) {
        const tc = new TextComponent();
        tc.setColor(this.color); tc.setOutline(this.outline); tc.setText(this.text);
        tc.setPosition(bx + Math.trunc((size - fm.stringWidth(this.text)) / 2), by + size - 3);
        tc.render(graphics);
      }
      this.bounds.setBounds(r);
      return r.getSize();
    }
  }

  class TooltipComponent extends LayoutableRenderableEntity {
    constructor() { super(); this.text = ''; this.backgroundColor = ComponentConstants.STANDARD_BACKGROUND_COLOR; }
    setText(t) { this.text = t; }
    setBackgroundColor(c) { this.backgroundColor = c; }
    render(graphics) {
      const OFFSET = 4;
      const fm = graphics.getFontMetrics();
      const desc = fm.getDescent(); const th = fm.getHeight();
      const lines = Text.fromGameTags(this.text).split(/<\/?br>|\n/i);
      let w = 0; let h = 0;
      for (const l of lines) { w = Math.max(w, fm.stringWidth(Text.removeTags(l))); h += th; }
      const x = this.preferredLocation.x; const y = this.preferredLocation.y;
      new BackgroundComponent(this.backgroundColor, new Rectangle(x, y, w + OFFSET * 2, h + OFFSET * 2)).render(graphics);
      lines.forEach((line, i) => {
        const tc = new TextComponent();
        tc.setText(line.replace(/<\/col>/g, '<col=ffffff>'));
        tc.setColor(Color.WHITE);
        tc.setPosition(x + OFFSET, y + OFFSET + (i + 1) * th - desc);
        tc.render(graphics);
      });
      const d = new Dimension(w + OFFSET * 2, h + OFFSET * 2);
      this.bounds.setLocation(this.preferredLocation); this.bounds.setSize(d);
      return d;
    }
  }

  /** Lombok-style builders: TitleComponent.builder().text('x').color(c).build() */
  function builder(Cls) {
    const o = {};
    const b = new Proxy({}, {
      get(_t, k) {
        if (k === 'build') return () => new Cls(o);
        return (v) => { o[k] = v; return b; };
      },
    });
    return b;
  }

  // ---------------------------------------------------------------- api: Skill, points, Perspective

  const SKILL_NAMES = ['ATTACK', 'DEFENCE', 'STRENGTH', 'HITPOINTS', 'RANGED', 'PRAYER', 'MAGIC', 'COOKING', 'WOODCUTTING', 'FLETCHING', 'FISHING',
    'FIREMAKING', 'CRAFTING', 'SMITHING', 'MINING', 'HERBLORE', 'AGILITY', 'THIEVING', 'SLAYER', 'FARMING', 'RUNECRAFT', 'HUNTER', 'CONSTRUCTION'];
  const Skill = {};
  SKILL_NAMES.forEach((n, i) => {
    Skill[n] = { name: n, ordinal: i, getName: () => (n === 'RUNECRAFT' ? 'Runecraft' : n[0] + n.slice(1).toLowerCase()), toString: () => n };
  });
  // Skill.isMembers (RuneLite's members flag per skill)
  for (const n of ['AGILITY', 'HERBLORE', 'THIEVING', 'FLETCHING', 'SLAYER', 'FARMING', 'HUNTER', 'CONSTRUCTION']) Skill[n].members = true;
  for (const n of SKILL_NAMES) Skill[n].isMembers = () => !!Skill[n].members;
  Skill.values = () => SKILL_NAMES.map((n) => Skill[n]);
  Skill.valueOf = (n) => { if (!SKILL_NAMES.includes(n)) throw new Error('IllegalArgumentException: ' + n); return Skill[n]; };

  // net.runelite.api.Experience
  const XP_FOR_LEVEL = [];
  for (let level = 1, xp = 0; level <= 126; ++level) {
    XP_FOR_LEVEL[level - 1] = Math.trunc(xp / 4);
    xp += Math.trunc(level + 300.0 * Math.pow(2.0, level / 7.0));
  }
  const Experience = {
    MAX_REAL_LEVEL: 99, MAX_VIRT_LEVEL: 126, MAX_SKILL_XP: 200000000,
    getXpForLevel(level) {
      if (level < 1 || level > 126) throw new Error(level + ' is not a valid level');
      return XP_FOR_LEVEL[level - 1];
    },
    getLevelForXp(xp) {
      if (xp < 0) throw new Error('XP (' + xp + ') must not be negative');
      let low = 0; let high = XP_FOR_LEVEL.length - 1;
      while (low <= high) {
        const mid = low + ((high - low) >> 1);
        const x = XP_FOR_LEVEL[mid];
        if (xp < x) high = mid - 1; else if (xp > x) low = mid + 1; else return mid + 1;
      }
      return high + 1;
    },
    MAX_COMBAT_LEVEL: 126,
    getMeleeRangeOrMagicCombatLevelContribution(attackLevel, strengthLevel, magicLevel, rangeLevel) {
      const melee = 0.325 * (attackLevel + strengthLevel);
      const range = 0.325 * (Math.trunc(rangeLevel / 2) + rangeLevel);
      const magic = 0.325 * (Math.trunc(magicLevel / 2) + magicLevel);
      return Math.max(melee, Math.max(range, magic));
    },
    getCombatLevelPrecise(attackLevel, strengthLevel, defenceLevel, hitpointsLevel, magicLevel, rangeLevel, prayerLevel) {
      const base = 0.25 * (defenceLevel + hitpointsLevel + Math.trunc(prayerLevel / 2));
      return base + Experience.getMeleeRangeOrMagicCombatLevelContribution(attackLevel, strengthLevel, magicLevel, rangeLevel);
    },
    getCombatLevel(a, s, d, h, m, r, p) { return Math.trunc(Experience.getCombatLevelPrecise(a, s, d, h, m, r, p)); },
    getNextCombatLevelMelee(a, s, d, h, m, r, p) {
      const next = Experience.getCombatLevel(a, s, d, h, m, r, p) + 1;
      return Math.ceil(-10 / 13 * (d + h + Math.trunc(p / 2) - 4 * next)) - s - a;
    },
    getNextCombatLevelHpDef(a, s, d, h, m, r, p) {
      const next = Experience.getCombatLevel(a, s, d, h, m, r, p) + 1;
      const type = Experience.getMeleeRangeOrMagicCombatLevelContribution(a, s, m, r);
      return Math.trunc(Math.ceil(4 * next - Math.trunc(p / 2) - 4 * type)) - h - d;
    },
    getNextCombatLevelMagic(a, s, d, h, m, r, p) {
      const next = Experience.getCombatLevel(a, s, d, h, m, r, p) + 1;
      return Math.ceil(2 / 3 * Math.ceil(-10 / 13 * (h + d - 4 * next + Math.trunc(p / 2)))) - m;
    },
    getNextCombatLevelRange(a, s, d, h, m, r, p) {
      const next = Experience.getCombatLevel(a, s, d, h, m, r, p) + 1;
      return Math.ceil(2 / 3 * Math.ceil(-10 / 13 * (h + d - 4 * next + Math.trunc(p / 2)))) - r;
    },
    getNextCombatLevelPrayer(a, s, d, h, m, r, p) {
      const next = Experience.getCombatLevel(a, s, d, h, m, r, p) + 1;
      const type = Experience.getMeleeRangeOrMagicCombatLevelContribution(a, s, m, r);
      return 2 * Math.ceil(-h - d + 4 * next - 4 * type) - p;
    },
  };

  // net.runelite.client.util.QuantityFormatter
  const QuantityFormatter = {
    SUFFIXES: ['', 'K', 'M', 'B'],
    /** DecimalFormat("#,###.#" / "#,###.###", RoundingMode.FLOOR) */
    _format(v, places) {
      const f = 10 ** places;
      const fl = Math.floor(Math.round(v * f * 1e6) / 1e6) / f;
      return fl.toLocaleString('en-US', { maximumFractionDigits: places, useGrouping: true });
    },
    quantityToRSDecimalStack(quantity, precise = false) {
      const s = String(quantity);
      if (s.length <= 4) return s;
      const power = quantity > 0 ? Math.trunc(Math.log10(quantity)) : 0;
      const places = precise && power >= 6 ? 3 : 1;
      return this._format(quantity / Math.pow(10, Math.trunc(power / 3) * 3), places) + this.SUFFIXES[Math.trunc(power / 3)];
    },
    formatNumber(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 }); },
    quantityToStackSize(quantity) {
      if (quantity < 0) return '-' + this.quantityToStackSize(-quantity);
      else if (quantity < 10000) return this.formatNumber(quantity);
      let suffix = this.SUFFIXES[0]; let divideBy = 1;
      for (let i = this.SUFFIXES.length - 1; i >= 0; i--) {
        divideBy = Math.pow(10, i * 3);
        if (quantity / divideBy >= 1) { suffix = this.SUFFIXES[i]; break; }
      }
      let formattedString = this.formatNumber(quantity / divideBy);
      formattedString = formattedString.length > 4 ? formattedString.substring(0, 4) : formattedString;
      return (formattedString.endsWith('.') ? formattedString.substring(0, 3) : formattedString) + suffix;
    },
  };

  // net.runelite.client.ui.SkillColor (Sailing left out: not in 2007)
  const SKILL_COLORS = { ATTACK: [155, 32, 7], DEFENCE: [98, 119, 190], STRENGTH: [4, 149, 90], HITPOINTS: [131, 126, 126], RANGED: [109, 144, 23],
    PRAYER: [159, 147, 35], MAGIC: [50, 80, 193], COOKING: [112, 35, 134], WOODCUTTING: [52, 140, 37], FLETCHING: [3, 141, 125], FISHING: [106, 132, 164],
    FIREMAKING: [189, 120, 25], CRAFTING: [151, 110, 77], SMITHING: [108, 107, 82], MINING: [93, 143, 167], HERBLORE: [7, 133, 9], AGILITY: [58, 60, 137],
    THIEVING: [108, 52, 87], SLAYER: [100, 100, 100], FARMING: [101, 152, 63], RUNECRAFT: [170, 141, 26], HUNTER: [92, 89, 65], CONSTRUCTION: [130, 116, 95] };
  const SkillColor = { find: (skill) => { const c = SKILL_COLORS[skill.name]; return { getColor: () => new Color(c[0], c[1], c[2]) }; } };
  const statIndex = (skill) => {
    const stats = ll.readStats ? ll.readStats() : null;
    if (!stats) return null;
    const key = skill.name === 'RUNECRAFT' ? 'runecraft' : skill.name.toLowerCase();
    return stats.find((s) => s.skill === key || (key === 'runecraft' && s.skill === 'runecrafting')) || null;
  };

  class WorldPoint {
    constructor(x, y, plane) { this.x = x; this.y = y; this.plane = plane; }
    getX() { return this.x; }
    getY() { return this.y; }
    getPlane() { return this.plane; }
    distanceTo(o) { return o.plane !== this.plane ? 2147483647 : Math.max(Math.abs(this.x - o.x), Math.abs(this.y - o.y)); }
    getRegionID() { return ((this.x >> 6) << 8) | (this.y >> 6); }
    getRegionX() { return this.x & 63; }
    getRegionY() { return this.y & 63; }
    dx(d) { return new WorldPoint(this.x + d, this.y, this.plane); }
    dy(d) { return new WorldPoint(this.x, this.y + d, this.plane); }
    static fromRegion(regionId, rx, ry, plane) { return new WorldPoint(((regionId >>> 8) << 6) + rx, ((regionId & 0xff) << 6) + ry, plane); }
    /** (no instances in 2007: the world point itself) */
    static fromLocalInstance(client, lp, plane) { const w = WorldPoint.fromLocal(client, lp); if (plane !== undefined) w.plane = plane; return w; }
    static toLocalInstance(wv, wp) { return [wp]; }
    equals(o) { return o && o.x === this.x && o.y === this.y && o.plane === this.plane; }
    static fromLocal(client, lp) { return new WorldPoint(client.getBaseX() + (lp.x >> 7), client.getBaseY() + (lp.y >> 7), client.getPlane()); }
  }
  class LocalPoint {
    constructor(x, y) { this.x = x; this.y = y; }
    getX() { return this.x; }
    getY() { return this.y; }
    getSceneX() { return this.x >> 7; }
    getSceneY() { return this.y >> 7; }
    distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y) | 0; }
    plus(dx, dy) { return new LocalPoint(this.x + dx, this.y + dy); }
    static fromWorld(client, wp, y) {
      let x = wp; let plane = null;
      if (wp instanceof WorldPoint) { x = wp.x; y = wp.y; plane = wp.plane; }
      if (plane !== null && plane !== client.getPlane()) return null;
      const sx = x - client.getBaseX(); const sy = y - client.getBaseY();
      if (sx < 0 || sy < 0 || sx >= 104 || sy >= 104) return null;
      return new LocalPoint((sx << 7) + 64, (sy << 7) + 64);
    }
    static fromScene(x, y) { return new LocalPoint((x << 7) + 64, (y << 7) + 64); }
  }

  const InventoryID = { INV: 93, WORN: 94, BANK: 95, TRAWLER_REWARDINV: 0, TRAIL_REWARDINV: 141, MISC_RESOURCES_COLLECTED: 415 };
  // (OSRS interface ids, which the 2007 client uses)
  // the 2007 client's interface ids (Com2007's INTERFACES_2007): the Barrows chest shows the clue reward window (364),
  // Managing Miscellania's resources collected is 392, the Fishing Trawler's catch 367; misc_collectinv is inv 415
  const InterfaceID = { BARROWS_REWARD: 364, TRAWLER_REWARD: 367, MISC_COLLECTION: 392, TRAIL_REWARD: 364 };
  class WorldArea {
    constructor(x, y, width, height, plane) { this.x = x; this.y = y; this.width = width; this.height = height; this.plane = plane; }
    getX() { return this.x; }
    getY() { return this.y; }
    getWidth() { return this.width; }
    getHeight() { return this.height; }
    getPlane() { return this.plane; }
    toWorldPoint() { return new WorldPoint(this.x, this.y, this.plane); }
  }
  class ItemStack {
    constructor(id, quantity) { this.id = id; this.quantity = quantity; }
    getId() { return this.id; }
    getQuantity() { return this.quantity; }
  }
  class TileItem {
    constructor(id, quantity) { this.id = id; this.quantity = quantity; }
    getId() { return this.id; }
    getQuantity() { return this.quantity; }
  }
  /** a scene tile, by world position */
  class Tile {
    constructor(wp) { this.worldPoint = wp; }
    getWorldLocation() { return this.worldPoint; }
    getPlane() { return this.worldPoint.plane; }
    getLocalLocation() { return LocalPoint.fromWorld(client, this.worldPoint.x, this.worldPoint.y); }
    getSceneLocation() { const l = this.getLocalLocation(); return l ? new Point(l.getSceneX(), l.getSceneY()) : null; }
    /** the tile's item pile (only its tile polygon: getCanvasTilePoly) */
    getItemLayer() { const lp = this.getLocalLocation(); return lp ? { getCanvasTilePoly: () => Perspective.getCanvasTilePoly(client, lp), getLocalLocation: () => lp, getPlane: () => this.getPlane() } : null; }
    equals(o) { return !!o && typeof o.getWorldLocation === 'function' && this.worldPoint.equals(o.getWorldLocation()); }
  }

  let frameG = null; // the runtime's per-frame drawing helper (projection etc.)
  const stretch = { enabled: false, fast: false, integerScaling: false, keepAspectRatio: false, scalingFactor: 50, increasedResolution: true };
  // (sent again from paint if the client's hooks weren't up yet)
  const pushStretch = () => {
    if (!stretch.dirty || !ll.api || !ll.api.stretch) return;
    stretch.dirty = false;
    const { enabled, fast, integerScaling, keepAspectRatio, scalingFactor, increasedResolution } = stretch;
    ll.api.stretch({ enabled, fast, integerScaling, keepAspectRatio, scalingFactor, increasedResolution });
  };
  const view = () => (ll.api && ll.api.view ? ll.api.view() : { x: 4, y: 4, w: 512, h: 334 });
  // A projected point (view-relative) counts as on screen within one view size around the 3D view. RuneLite's
  // localToCanvas returns null only behind the near plane (as the 2007 projection does), but its world overlays are
  // clipped to the viewport; ours aren't, so a point just past the near plane projects far off and stretches a tile
  // polygon across the screen. Those points are null here, and a polygon with one is not drawn.
  const onScreen = (q) => { if (!q) return false; const v = view(); return q.x >= -v.w && q.x <= 2 * v.w && q.y >= -v.h && q.y <= 2 * v.h; };
  const Perspective = {
    LOCAL_TILE_SIZE: 128,
    localToCanvas(client, lp, plane, zOffset = 0) {
      if (!frameG || !lp) return null;
      const p = frameG.project(lp.x, lp.y, zOffset);
      if (!onScreen(p)) return null;
      const v = view();
      return new Point(p.x + v.x, p.y + v.y);
    },
    getCanvasTilePoly(client, lp) { return Perspective.getCanvasTileAreaPoly(client, lp, 1); },
    /** the tiles of a size x size area centred on lp */
    getCanvasTileAreaPoly(client, lp, size) {
      if (!frameG || !lp) return null;
      const x0 = lp.x - (size * 128) / 2; const z0 = lp.y - (size * 128) / 2; const x1 = x0 + size * 128; const z1 = z0 + size * 128;
      const pts = [frameG.project(x0, z0, 0), frameG.project(x1, z0, 0), frameG.project(x1, z1, 0), frameG.project(x0, z1, 0)];
      if (!pts.every(onScreen)) return null;
      const v = view();
      const poly = new Polygon();
      for (const q of pts) poly.addPoint(q.x + v.x, q.y + v.y);
      return poly;
    },
    /** the minimap point of lp (the client's own test: within 80 minimap pixels) */
    localToMinimap(client, lp) {
      if (!lp || !ll.api || !ll.api.minimapPoint) return null;
      const p = ll.api.minimapPoint(lp.x, lp.y);
      return p ? new Point(p.x, p.y) : null;
    },
    getCanvasTextLocation(client, graphics, lp, text, zOffset) {
      const p = Perspective.localToCanvas(client, lp, client.getPlane(), zOffset);
      if (!p) return null;
      const w = graphics.getFontMetrics().stringWidth(Text.removeTags(text));
      return new Point(p.x - Math.trunc(w / 2), p.y);
    },
  };

  // ---------------------------------------------------------------- Client facade

  const GameState = { LOGIN_SCREEN: 'LOGIN_SCREEN', LOGGING_IN: 'LOGGING_IN', LOADING: 'LOADING', LOGGED_IN: 'LOGGED_IN', CONNECTION_LOST: 'CONNECTION_LOST', HOPPING: 'HOPPING' };
  const c0 = () => ll.client;
  const fld = (k) => ll.fields[k];

  class Actor {
    constructor(info) { this.info = info; }
    getName() { return this.info.name; }
    getCombatLevel() { return this.info.level | 0; }
    getAnimation() { return this.info.animation; }
    getPoseAnimation() { return this.info.poseAnimation === undefined ? -1 : this.info.poseAnimation; }
    getIndex() { return this.info.index; }
    /** the model's yaw (0-2047, 0 = south) */
    getOrientation() { return this.info.orientation | 0; }
    getGraphic() { return this.info.graphic === undefined ? -1 : this.info.graphic; }
    getMinimapLocation() { return Perspective.localToMinimap(client, this.getLocalLocation()); }
    getLocalLocation() { return new LocalPoint(this.info.x, this.info.z); }
    getWorldLocation() { return new WorldPoint(client.getBaseX() + (this.info.x >> 7), client.getBaseY() + (this.info.z >> 7), client.getPlane()); }
    getHealthRatio() { return this.info.totalHealth ? this.info.health : -1; }
    getHealthScale() { return this.info.totalHealth || -1; }
    getLogicalHeight() { return this.info.height || 200; }
    getInteracting() {
      const i = this.info.interacting;
      if (!i) return null;
      return i.type === 'npc' ? client.getNpcs().find((n) => n.info.index === i.index) || null : client.getPlayers().find((p) => p.info.index === i.index) || client.localPlayerIf(i.index);
    }
    getCanvasTilePoly() { return Perspective.getCanvasTilePoly(client, this.getLocalLocation()); }
    getCanvasTextLocation(graphics, text, zOffset) { return Perspective.getCanvasTextLocation(client, graphics, this.getLocalLocation(), text, zOffset); }
    getConvexHull() {
      if (!frameG) return null;
      const h = frameG.hull(this.info.typecode);
      if (!h) return null;
      const v = view();
      return new Polygon(h.map((q) => q.x + v.x), h.map((q) => q.y + v.y));
    }
    equals(o) { return o && o.info && o.info.typecode === this.info.typecode; }
  }
  class NPC extends Actor {
    getId() { return this.info.id; }
    getIndex() { return this.info.index; }
    getComposition() { return { getName: () => this.info.name, getId: () => this.info.id, getSize: () => this.info.size, getCombatLevel: () => this.info.level | 0, getActions: () => (this.info.actions || []).slice(),
      // (2007 has no follower flag or non-interactible NPCs in our data)
      isInteractible: () => true, isFollower: () => false }; }
    getTransformedComposition() { return this.getComposition(); }
    // RuneLite's isDead: the health bar has gone to 0
    isDead() { return this.getHealthRatio() === 0; }
    // the south-west tile and size (the 2007 position is the centre of the NPC's square)
    getWorldArea() {
      const n = this.info.size || 1;
      return new WorldArea(client.getBaseX() + ((this.info.x - n * 64) >> 7) + 0, client.getBaseY() + ((this.info.z - n * 64) >> 7) + 0, n, n, client.getPlane());
    }
  }
  // net.runelite.api.FriendsChatRank (the 2007 clan chat's rank byte is the same)
  const FriendsChatRank = {};
  [['UNRANKED', -1], ['FRIEND', 0], ['RECRUIT', 1], ['CORPORAL', 2], ['SERGEANT', 3], ['LIEUTENANT', 4], ['CAPTAIN', 5], ['GENERAL', 6], ['OWNER', 7], ['JMOD', 127]]
    .forEach(([n, v]) => { FriendsChatRank[n] = Object.freeze({ name: n, getValue: () => v, toString: () => n }); });
  FriendsChatRank.valueOf = (v) => Object.values(FriendsChatRank).find((r) => r && r.getValue && r.getValue() === v) || FriendsChatRank.UNRANKED;
  class Player extends Actor {
    // Player.getTeam: the 2007 client's player team (the worn cape's ObjType.team, as OSRS)
    getTeam() { const e = this.info.entity; return e ? e.team | 0 : 0; }
    isFriend() { return !!(this.info.name && ll.api && ll.api.isFriend && ll.api.isFriend(this.info.name)); }
    // 2007's clan chat is OSRS's friends chat (the members the client keeps); OSRS clans are 2021
    isFriendsChatMember() { const m = client.getFriendsChatManager(); return !!(m && this.info.name && m.findByName(Text.removeTags(this.info.name))); }
    isClanMember() { return false; }
  }

  const topLevelWorldView = {
    getId: () => -1, isInstance: () => false, isTopLevel: () => true, worldViews: () => [],
    getSelectedSceneTile: () => client.getSelectedSceneTile(),
    npcs() { const list = client.getNpcs(); return Object.assign(list, { byIndex: (i) => list.find((n) => n.getIndex() === i) || null }); },
    // (WorldView.players() has the local player too; client.getPlayers() here leaves it out, see the actor loops)
    players: () => { const me = client.getLocalPlayer(); const l = client.getPlayers(); return me ? [me, ...l] : l; },
    getPlane: () => client.getPlane(), getBaseX: () => client.getBaseX(), getBaseY: () => client.getBaseY(), getMapRegions: () => client.getMapRegions(),
    worldEntities: () => Object.assign([], { byIndex: () => null }),
    getScene: () => ({ getTiles: () => new Proxy([], { get: (_t, level) => new Proxy([], { get: (_u, x) => new Proxy([], { get: (_v, y) => sceneTile(Number(level), Number(x), Number(y)) }) }) }) }),
  };
  // ItemContainer.contains / count / find (items with id -1 are empty slots)
  const itemContainerOf = (c) => Object.assign(c, {
    contains(itemId) { return c.getItems().some((it) => it.getId() === itemId); },
    count(itemId) { const its = c.getItems(); return itemId === undefined ? its.filter((it) => it.getId() !== -1).length : its.filter((it) => it.getId() === itemId).reduce((n, it) => n + it.getQuantity(), 0); },
    find(itemId) { return c.getItems().findIndex((it) => it.getId() === itemId); },
    size() { return c.getItems().length; },
  });
  const client = {
    getGameState() { const c = c0(); return !c ? GameState.LOGIN_SCREEN : ll.loggedIn ? GameState.LOGGED_IN : GameState.LOGIN_SCREEN; },
    getLocalPlayer() {
      const c = c0(); const p = c && fld('localPlayer') && c[fld('localPlayer')];
      if (!p) return null;
      return new Player(ll.entityInfo(p, { index: 2047, typecode: 2047 << 14, kind: 'player', name: p[fld('playerName')], level: p[fld('combatLevel')] | 0 }));
    },
    localPlayerIf(index) { return index === 2047 ? client.getLocalPlayer() : null; },
    getNpcs() { const c = c0(); return c ? ll.readNpcs(c).map((n) => new NPC(n)) : []; },
    /** the one world view (no instances or world entities in 2007): npcs() with byIndex */
    getTopLevelWorldView() { return topLevelWorldView; },
    getWorldView(id) { return client.getTopLevelWorldView(); },
    isInInstancedRegion() { return false; },
    /** the 64x64 regions the scene covers (RuneLite's getMapRegions) */
    getMapRegions() {
      const bx = client.getBaseX(); const by = client.getBaseY(); const out = [];
      for (let rx = bx >> 6; rx <= (bx + 103) >> 6; rx++) for (let ry = by >> 6; ry <= (by + 103) >> 6; ry++) out.push((rx << 8) | ry);
      return out;
    },
    getScene() { return client.getTopLevelWorldView().getScene(); },
    getObjectDefinition(id) {
      const t = ll.api && ll.api.loc ? ll.api.loc(id) : null;
      const name = t && t.name != null ? String(t.name) : 'null';
      return { getId: () => id, getName: () => name, getActions: () => (t && t.op ? Array.from(t.op, (o) => (o == null ? null : String(o))) : [null, null, null, null, null]),
        getSizeX: () => (t ? t.width | 0 : 1), getSizeY: () => (t ? t.length | 0 : 1), getMapSceneId: () => -1,
        // (multilocs: the 2007 client's varbit-driven ones aren't resolved here)
        getImpostorIds: () => null, getImpostor: () => null,
        // the varbit a multiloc changes with (LocType.multivarbit; -1 for none)
        getVarbitId: () => (t && t.multivarbit != null ? t.multivarbit | 0 : -1) };
    },
    getPlayers() { const c = c0(); return c ? ll.readPlayers(c).map((p) => new Player(p)) : []; },
    getVarpValue(id) { const c = c0(); const v = c && c[fld('varps')]; return v ? v[id] | 0 : 0; },
    getBoostedSkillLevel(skill) { const s = statIndex(skill); return s ? s.boosted : 0; },
    getRealSkillLevel(skill) { const s = statIndex(skill); return s ? s.level : 0; },
    getSkillExperience(skill) { const s = statIndex(skill); return s ? s.xp : 0; },
    getOverallExperience() { const st = ll.readStats ? ll.readStats() : []; return (st || []).reduce((a, s) => a + s.xp, 0); },
    getTickCount() { return ll.api && ll.api.tickCount ? ll.api.tickCount() : 0; },
    getGameCycle() { return ll.api && ll.api.loopCycle ? ll.api.loopCycle() : 0; },
    getFPS() { return ll.api && ll.api.fps ? ll.api.fps() : 0; },
    getEnergy() { const c = c0(); return c ? (c[fld('runEnergy')] | 0) * 100 : 0; },
    // idle timers (client hook `idle`): client cycles of 20 ms (Constants.CLIENT_TICK_LENGTH); the 2007 client's idle
    // timeout is 4500 cycles (90 s), after which it sends IDLE_TIMER and the server logs you out
    getKeyboardIdleTicks() { const i = ll.api && ll.api.idle ? ll.api.idle() : null; return i ? i.keyboard | 0 : 0; },
    getMouseIdleTicks() { const i = ll.api && ll.api.idle ? ll.api.idle() : null; return i ? i.mouse | 0 : 0; },
    getMouseLastPressedMillis() { const i = ll.api && ll.api.idle ? ll.api.idle() : null; return i ? i.lastPressed : 0; },
    getWorld() { return ll.api && ll.api.world ? ll.api.world() : 1; }, // client hook `world`: Client.worldid (the page's worldid=)
    getIdleTimeout() { const i = ll.api && ll.api.idle ? ll.api.idle() : null; return i ? i.timeout : 4500; },
    getWeight() { const c = c0(); return c ? c[fld('runWeight')] | 0 : 0; },
    getPlane() { const c = c0(); return c ? c[fld('level')] | 0 : 0; },
    getBaseX() { const c = c0(); return c ? c[fld('baseX')] | 0 : 0; },
    getBaseY() { const c = c0(); return c ? c[fld('baseZ')] | 0 : 0; },
    getCanvasWidth() { return CANVAS_W; },
    getCanvasHeight() { return CANVAS_H; },
    // stretched mode (Client.setStretchedEnabled ...): the client sizes the canvas on screen (DisplayScale)
    isStretchedEnabled() { return stretch.enabled; },
    setStretchedEnabled(state) { stretch.enabled = !!state; },
    isStretchedFast() { return stretch.fast; },
    setStretchedFast(state) { stretch.fast = !!state; },
    setStretchedIntegerScaling(state) { stretch.integerScaling = !!state; },
    setStretchedKeepAspectRatio(state) { stretch.keepAspectRatio = !!state; },
    setScalingFactor(factor) { stretch.scalingFactor = factor | 0; },
    // 2007RS: SD increased resolution (the client's SdView), a Stretched Mode setting
    setStretchedIncreasedResolution(state) { stretch.increasedResolution = !!state; },
    invalidateStretching(resize) { stretch.dirty = true; pushStretch(); },
    getStretchedDimensions() { const d = ll.api && ll.api.stretchedDimensions ? ll.api.stretchedDimensions() : { width: CANVAS_W, height: CANVAS_H }; return new Dimension(d.width, d.height); },
    getRealDimensions() { return new Dimension(CANVAS_W, CANVAS_H); },
    getViewportXOffset() { return view().x; },
    getViewportYOffset() { return view().y; },
    getViewportWidth() { return view().w; },
    getViewportHeight() { return view().h; },
    getMouseCanvasPosition() { const v = view(); return new Point(ll.mouse.x + v.x, ll.mouse.y + v.y); },
    isMenuOpen() { const c = c0(); return !!(c && fld('menuOpen') && c[fld('menuOpen')]); },
    /** MenuEntry[] bottom (index 0) to top, as RuneLite's getMenuEntries */
    getMenuEntries() {
      const c = c0();
      if (!c || !fld('menuCount')) return [];
      const n = c[fld('menuCount')] | 0;
      const arr = ll.menuArrays(c);
      const out = [];
      for (let i = 0; i < n; i++) out.push(new MenuEntryImpl(arr, i, false));
      return out;
    },
    setMenuEntries(entries) { setMenuEntries(entries); },
    /** Client.getMenu(): the root menu, live entries (bottom first, the left-click entry last) */
    getMenu() {
      return {
        getMenuEntries() {
          const c = c0(); if (!c || !fld('menuCount')) return [];
          const n = c[fld('menuCount')] | 0; const arr = ll.menuArrays(c); const out = [];
          for (let i = 0; i < n; i++) out.push(new MenuEntryImpl(arr, i, true));
          return out;
        },
        setMenuEntries(entries) { setMenuEntries(entries); },
      };
    },
    /** KeyCode.KC_SHIFT / KC_CONTROL / KC_ALT */
    isKeyPressed(code) { return code === KeyCode.KC_SHIFT ? !!ll.shiftDown : code === KeyCode.KC_CONTROL ? !!ll.ctrlDown : code === KeyCode.KC_ALT ? !!ll.altDown : false; },
    getLocalDestinationLocation() {
      const d = ll.api && ll.api.dest ? ll.api.dest() : null;
      return d && d.x ? LocalPoint.fromScene(d.x, d.z) : null;
    },
    getSelectedSceneTile() {
      if (!frameG || !ll.mouse.inView) return null;
      const t = frameG.tileAt(ll.mouse.x, ll.mouse.y);
      return t ? { getLocalLocation: () => LocalPoint.fromScene(t.x, t.z), getWorldLocation: () => new WorldPoint(client.getBaseX() + t.x, client.getBaseY() + t.z, client.getPlane()) } : null;
    },
    getItemContainer(which) {
      // (by name, or by InventoryID: INV 93, WORN 94)
      // any other inv id (reward windows ...): the client's inv cache
      if (typeof which === 'number' && which !== InventoryID.INV && which !== InventoryID.WORN) {
        const v = ll.api && ll.api.inv ? ll.api.inv(which) : null;
        if (!v) return null;
        const its = v.ids.map((id, i) => ({ getId: () => (id >= 0 ? id : -1), getQuantity: () => (id >= 0 ? v.counts[i] : 0) }));
        return itemContainerOf({ getItems: () => its, getItem: (slot) => its[slot] || null });
      }
      const worn = which === 'EQUIPMENT' || which === InventoryID.WORN;
      const size = worn ? 14 : 28;
      const id = worn ? ll.ITEMS.equipment : ll.ITEMS.inventory;
      const items = ll.readContainer ? ll.readContainer(id, size) : null;
      const qty = (it) => (it.quantity !== undefined ? it.quantity : it.count) | 0; // (readContainer's items have quantity)
      if (!items) return null;
      return itemContainerOf({ getItems: () => items.map((it) => ({ getId: () => (it ? it.id : -1), getQuantity: () => (it ? qty(it) : 0) })), getItem: (slot) => (items[slot] ? { getId: () => items[slot].id, getQuantity: () => qty(items[slot]) } : null) });
    },
    addChatMessage(type, name, message) { ll.gameMessage(Text.removeTags(message)); },
    createMenuEntry(idx) { return createMenuEntry(idx); },
    /** our one world has no account hashes: the account's name stands in for it (-1 logged out) */
    getAccountHash() { const me = client.getGameState() === GameState.LOGGED_IN ? client.getLocalPlayer() : null; return me && me.getName() ? String(me.getName()).toLowerCase() : -1; },
    getItemDefinition(id) {
      const i = ll.itemInfo ? ll.itemInfo(id) : null;
      const name = (i && i.name) || 'null'; const price = (i && i.cost) | 0;
      // getHaPrice: the store value x Constants.HIGH_ALCHEMY_MULTIPLIER (0.6)
      let o = null;
      try { o = ll.api && ll.api.obj ? ll.api.obj(id) : null; } catch { o = null; }
      const note = o && o.certtemplate !== undefined ? o.certtemplate : -1; const linked = o && o.certlink !== undefined ? o.certlink : -1;
      // (isGeTradeable: no Grand Exchange in Sept 2007)
      return { getName: () => name, getMembersName: () => name, getId: () => id, getPrice: () => price, getHaPrice: () => Math.trunc(price * 0.6), isStackable: () => !!(i && i.stackable),
        getNote: () => note, getLinkedNoteId: () => linked, isGeTradeable: () => false, isTradeable: () => false,
        // the obj's iop (client hook `iop`); no shift-click drop in 2007, so no shift-click action index
        getInventoryActions: () => (ll.api && ll.api.iop ? Array.from(ll.api.iop(id)) : [null, null, null, null, null]), getShiftClickActionIndex: () => -1, getSubops: () => null };
    },
  };

  // ---------------------------------------------------------------- EventBus

  // TileObjects (RuneLite's WallObject, DecorativeObject, GameObject, GroundObject) from the client's loc events:
  // one object per loc while it is in the scene, so a despawn hands over the same object as its spawn.
  const LOC_KIND = ['WallObject', 'DecorativeObject', 'GameObject', 'GroundObject'];
  class TileObject {
    constructor(e) {
      this.kind = e.k; this.id = e.id; this.tag = e.tag; this.plane = e.level; this.wx = e.wx; this.wz = e.wz;
      this.shape = e.shape; this.orientation = e.angle;
      const t = ll.api && ll.api.loc ? ll.api.loc(e.id) : null;
      const rot = e.angle & 1;
      this.sizeX = t && e.k === 2 ? (rot ? t.length : t.width) | 0 || 1 : 1;
      this.sizeY = t && e.k === 2 ? (rot ? t.width : t.length) | 0 || 1 : 1;
    }
    getId() { return this.id; }
    getHash() { return this.tag; }
    getPlane() { return this.plane; }
    getWorldView() { return client.getTopLevelWorldView(); }
    getWorldLocation() { return new WorldPoint(this.wx, this.wz, this.plane); }
    /** the centre of its area (GameObject) or tile */
    getLocalLocation() {
      const sx = this.wx - client.getBaseX(); const sy = this.wz - client.getBaseY();
      return new LocalPoint((sx << 7) + this.sizeX * 64, (sy << 7) + this.sizeY * 64);
    }
    getX() { return this.getLocalLocation().x; }
    getY() { return this.getLocalLocation().y; }
    getSizeX() { return this.sizeX; }
    getSizeY() { return this.sizeY; }
    getOrientation() { return this.orientation; }
    getConfig() { return this.shape | (this.orientation << 6); }
    getSceneMinLocation() { return { getX: () => this.wx - client.getBaseX(), getY: () => this.wz - client.getBaseY() }; }
    getConvexHull() {
      if (!frameG) return null;
      const h = frameG.hull(this.tag);
      if (!h) return null;
      const v = view();
      return new Polygon(h.map((q) => q.x + v.x), h.map((q) => q.y + v.y));
    }
    getConvexHull2() { return null; }
    getClickbox() { return this.getConvexHull(); }
    getCanvasTilePoly() { return Perspective.getCanvasTileAreaPoly(client, this.getLocalLocation(), Math.max(this.sizeX, this.sizeY)); }
    getCanvasLocation(zOffset = 0) { return Perspective.localToCanvas(client, this.getLocalLocation(), this.plane, zOffset); }
    getCanvasTextLocation(graphics, text, zOffset) { return Perspective.getCanvasTextLocation(client, graphics, this.getLocalLocation(), text, zOffset); }
    getMinimapLocation() { return Perspective.localToMinimap(client, this.getLocalLocation()); }
  }
  class WallObject extends TileObject {}
  class DecorativeObject extends TileObject {}
  class GameObject extends TileObject {}
  class GroundObject extends TileObject {}
  const LOC_CLASSES = [WallObject, DecorativeObject, GameObject, GroundObject];
  const sceneLocs = new Map(); // "k:level:wx:wz" -> TileObject
  const locKey = (e) => `${e.k}:${e.level}:${e.wx}:${e.wz}`;
  /** the objects on a scene tile (Tile.getWallObject / getDecorativeObject / getGameObjects / getGroundObject) */
  function sceneTile(level, sx, sy) {
    const wx = client.getBaseX() + sx; const wz = client.getBaseY() + sy;
    const at = (k) => sceneLocs.get(`${k}:${level}:${wx}:${wz}`) || null;
    const games = [];
    for (const o of sceneLocs.values()) if (o.kind === 2 && o.plane === level && wx >= o.wx && wx < o.wx + o.sizeX && wz >= o.wz && wz < o.wz + o.sizeY) games.push(o);
    return { getWallObject: () => at(0), getDecorativeObject: () => at(1), getGameObjects: () => games, getGroundObject: () => at(3),
      getWorldLocation: () => new WorldPoint(wx, wz, level), getLocalLocation: () => LocalPoint.fromScene(sx, sy), getPlane: () => level };
  }
  let locsUnloaded = false;
  /** GameEventManager.simulateGameEvents: a plugin started while logged in gets the scene's spawns */
  function simulateGameEvents(subscriber) {
    if (client.getGameState() !== GameState.LOGGED_IN) return;
    const post = (name, ev) => { const m = 'on' + name; if (typeof subscriber[m] === 'function') { try { subscriber[m](ev); } catch (e) { ll.post && ll.post('runtime-error', `${m}: ${e && e.message}`); } } };
    for (const o of sceneLocs.values()) {
      const name = LOC_KIND[o.kind];
      const tile = sceneTile(o.plane, o.wx - client.getBaseX(), o.wz - client.getBaseY());
      post(name + 'Spawned', { ['get' + name]: () => o, getTile: () => tile });
    }
    for (const n of client.getNpcs()) post('NpcSpawned', { getNpc: () => n });
    for (const p of client.getPlayers()) post('PlayerSpawned', { getPlayer: () => p });
  }
  function pollLocs() {
    for (const e of (ll.api && ll.api.locEvents ? ll.api.locEvents() : [])) {
      if (e.reset) {
        if (!locsUnloaded) eventBus.post('WorldViewUnloaded', { getWorldView: () => topLevelWorldView });
        locsUnloaded = true;
        sceneLocs.clear();
        // (RuneLite's LOADING while the scene is rebuilt)
        if (derived.state === GameState.LOGGED_IN) { derived.state = GameState.LOADING; eventBus.post('GameStateChanged', { getGameState: () => GameState.LOADING }); }
        continue;
      }
      const key = locKey(e);
      const name = LOC_KIND[e.k];
      if (e.spawned) {
        if (locsUnloaded) { locsUnloaded = false; eventBus.post('WorldViewLoaded', { getWorldView: () => topLevelWorldView }); }
        const o = new LOC_CLASSES[e.k](e);
        sceneLocs.set(key, o);
        const tile = sceneTile(e.level, e.sx, e.sz);
        eventBus.post(name + 'Spawned', { ['get' + name]: () => o, getTile: () => tile });
      } else {
        const o = sceneLocs.get(key);
        if (!o) continue;
        sceneLocs.delete(key);
        const tile = sceneTile(e.level, e.sx, e.sz);
        eventBus.post(name + 'Despawned', { ['get' + name]: () => o, getTile: () => tile });
      }
    }
  }

  // core: run after the client draws the 3D view, before the interfaces over it (rl.viewDrawnHooks; e.g. text a
  // client script rewrites each cycle, written again just before it is drawn)
  const viewDrawnHooks = [];
  const eventBus = {
    subscribers: new Set(),
    register(o) { this.subscribers.add(o); },
    unregister(o) { this.subscribers.delete(o); },
    post(name, ev) {
      const m = 'on' + name;
      // (@Subscribe priority: higher first; a subscriber's subscribePriority, default 0)
      for (const s of [...this.subscribers].sort((x, y) => (y.subscribePriority | 0) - (x.subscribePriority | 0))) {
        if (typeof s[m] !== 'function') continue;
        try { s[m](ev); } catch (e) { ll.post && ll.post('runtime-error', `${s.constructor.name}.${m}: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`); }
      }
    },
  };

  // RuneLite's LootManager (net.runelite.client.game.LootManager), trimmed to 2007: NpcLootReceived when an NPC
  // that NpcUtil.isDying despawns, with the item stacks that spawned on its square that tick; PlayerLootReceived the
  // same for a player killed at 0 hitpoints. The OSRS bosses with special drop places and the loot script
  // (ServerNpcLoot) aren't in 2007.
  const lootManager = {
    itemSpawns: new Map(), // packed scene x << 8 | y -> [TileItem]
    killPoints: new Set(),
    isDying(npc) {
      // NpcUtil.isDying, default case: an attackable NPC whose health bar is at 0
      const comp = npc.getTransformedComposition();
      if (!comp) return false;
      return comp.getActions().includes('Attack') && npc.isDead();
    },
    onNpcDespawned(e) {
      const npc = e.getNpc();
      if (!this.isDying(npc)) return;
      this.processNpcLoot(npc);
    },
    onPlayerDespawned(e) {
      const player = e.getPlayer();
      if (player.getHealthRatio() !== 0) return;
      const worldPoint = player.getWorldLocation();
      const location = LocalPoint.fromWorld(client, worldPoint);
      const key = `${worldPoint.x},${worldPoint.y},${worldPoint.plane}`;
      if (location == null || this.killPoints.has(key)) return;
      const packed = (location.getSceneX() << 8) | location.getSceneY();
      const items = (this.itemSpawns.get(packed) || []).map((i) => new ItemStack(i.getId(), i.getQuantity()));
      if (!items.length) return;
      this.killPoints.add(key);
      eventBus.post('PlayerLootReceived', { getPlayer: () => player, getItems: () => items });
    },
    onItemSpawned(e) {
      const location = e.getTile().getLocalLocation();
      if (!location) return;
      const packed = (location.getSceneX() << 8) | location.getSceneY();
      if (!this.itemSpawns.has(packed)) this.itemSpawns.set(packed, []);
      this.itemSpawns.get(packed).push(e.getItem());
    },
    onGameTick() {
      this.itemSpawns.clear();
      this.killPoints.clear();
    },
    processNpcLoot(npc) {
      const allItems = this.getItemStacksFromAreas([npc.getWorldArea()]);
      if (allItems.length) eventBus.post('NpcLootReceived', { getNpc: () => npc, getItems: () => allItems });
    },
    getItemStacksFromAreas(areas) {
      const allItems = [];
      for (const dropLocation of areas) {
        const worldPoint = dropLocation.toWorldPoint();
        const location = LocalPoint.fromWorld(client, worldPoint);
        if (location == null) continue;
        const x = location.getSceneX(); const y = location.getSceneY();
        for (let i = 0; i < dropLocation.getWidth(); ++i) {
          for (let j = 0; j < dropLocation.getHeight(); ++j) {
            const key = `${worldPoint.x + i},${worldPoint.y + j},${worldPoint.plane}`;
            if (this.killPoints.has(key)) continue;
            this.killPoints.add(key);
            for (const item of this.itemSpawns.get(((x + i) << 8) | (y + j)) || []) allItems.push(new ItemStack(item.getId(), item.getQuantity()));
          }
        }
      }
      return allItems;
    },
    getItemSpawns(worldPoint) {
      const lp = LocalPoint.fromWorld(client, worldPoint);
      if (!lp) return [];
      return (this.itemSpawns.get((lp.getSceneX() << 8) | lp.getSceneY()) || []).map((ti) => new ItemStack(ti.getId(), ti.getQuantity()));
    },
  };
  eventBus.register(lootManager);

  // WidgetLoaded (client hook lostliteWidgetLoaded) and MenuOptionClicked (runtime.menuClick)
  ll.widgetLoaded = (groupId) => eventBus.post('WidgetLoaded', { getGroupId: () => groupId });
  // modal mode: the SubInterface's type (WidgetModalMode: 0 MODAL_NOCLICKTHROUGH, 1 NON_MODAL, 3 MODAL_CLICKTHROUGH)
  ll.widgetClosed = (groupId, unload, modalMode = 1) => eventBus.post('WidgetClosed', { getGroupId: () => groupId, getModalMode: () => modalMode, isUnload: () => unload });
  const ITEM_OPS = new Set([28, 9, 2, 21, 18]); // OPHELD1..5
  ll.menuClicked = (c, i) => {
    const e = menuEntryAt(c, i);
    let type = e.getType() | 0; if (type >= 2000) type -= 2000;
    const idRaw = e.getIdentifier();
    const id = typeof idRaw === 'bigint' ? Number(BigInt.asIntN(32, idRaw)) : Number(idRaw) | 0;
    const itemOp = ITEM_OPS.has(type);
    eventBus.post('MenuOptionClicked', {
      getMenuOption: () => e.getOption(), getMenuTarget: () => e.getTarget(), getMenuAction: () => type, getId: () => id,
      getParam0: () => e.getParam0(), getParam1: () => e.getParam1(), isItemOp: () => itemOp, getItemId: () => (itemOp ? id : -1),
      getRawId: () => idRaw, // (core) the entry's identifier as the client has it: a loc's scene tag (id in the high bits)
    });
  };

  // derived events, polled each frame (the client has no event hooks of its own)
  // varbits (the 2007 cache's VarBitType definitions through client hook varbitDefs)
  const varbitOf = (v, lsb, msb) => { const n = msb - lsb; return (v >> lsb) & (n >= 31 ? -1 : (1 << (n + 1)) - 1); };
  let varbitMap = null;
  const varbitsByVarp = () => {
    if (varbitMap && varbitMap.size) return varbitMap;
    const d = ll.api && ll.api.varbitDefs ? ll.api.varbitDefs() : null;
    const m = new Map();
    if (d) for (let i = 0; i + 3 < d.length; i += 4) { if (!m.has(d[i + 1])) m.set(d[i + 1], []); m.get(d[i + 1]).push([d[i], d[i + 2], d[i + 3]]); }
    varbitMap = m; return m;
  };
  const varbitChanged = (varpId, varbitId, value) => ({ getVarpId: () => varpId, getVarbitId: () => varbitId, getIndex: () => varpId,
    getValue: () => value, getLongValue: () => value });
  const derived = { tick: -1, stats: null, varps: null, npcs: new Map(), players: new Map(), containers: {}, state: null, anims: new Map(), interacting: new Map(), graphics: new Map(), hits: new Map() };
  function pollEvents() {
    pollLocs();
    const state = client.getGameState();
    if (state !== derived.state) {
      derived.state = state;
      eventBus.post('GameStateChanged', { getGameState: () => state });
      if (state !== GameState.LOGGED_IN) { derived.stats = null; derived.varps = null; derived.npcs.clear(); derived.players.clear(); derived.containers = {}; }
    }
    if (state !== GameState.LOGGED_IN) return;
    const t = client.getTickCount();
    if (t === derived.tick) return;
    derived.tick = t;
    // StatChanged
    const st = ll.readStats ? ll.readStats() : null;
    if (st) {
      for (const s of st) {
        const prev = derived.stats && derived.stats[s.skill];
        if (!prev || prev.xp !== s.xp || prev.boosted !== s.boosted || prev.level !== s.level) {
          const skill = Skill[s.skill === 'runecrafting' ? 'RUNECRAFT' : s.skill.toUpperCase()];
          if (skill) eventBus.post('StatChanged', { getSkill: () => skill, getXp: () => s.xp, getLevel: () => s.level, getBoostedLevel: () => s.boosted });
          // ActorDeath for the local player: its hitpoints reach 0 (the 2007 client has no death event)
          if (s.skill === 'hitpoints' && prev && prev.boosted > 0 && s.boosted === 0) {
            const me = client.getLocalPlayer();
            if (me) eventBus.post('ActorDeath', { getActor: () => me });
          }
        }
      }
      derived.stats = Object.fromEntries(st.map((s) => [s.skill, s]));
    }
    // VarbitChanged: one per changed varp (varbitId -1), then one per varbit on it whose value changed
    // (the 2007 cache's varbit definitions, client hook varbitDefs)
    const c = c0(); const vp = c && c[fld('varps')];
    if (vp) {
      if (derived.varps) {
        const byVarp = varbitsByVarp();
        for (let i = 0; i < vp.length; i++) {
          const nv = vp[i] | 0; const ov = derived.varps[i] | 0;
          if (nv === ov) continue;
          eventBus.post('VarbitChanged', varbitChanged(i, -1, nv));
          for (const [id, lsb, msb] of (byVarp.get(i) || [])) {
            const a = varbitOf(ov, lsb, msb); const b = varbitOf(nv, lsb, msb);
            if (a !== b) eventBus.post('VarbitChanged', varbitChanged(i, id, b));
          }
        }
      }
      derived.varps = Int32Array.from(vp);
    }
    // ItemSpawned / ItemDespawned / ItemQuantityChanged (the client's obj stacks, LostLite itemEvents)
    for (const e of (ll.api && ll.api.itemEvents ? ll.api.itemEvents() : [])) {
      const tile = new Tile(new WorldPoint(e.wx, e.wz, e.level));
      if (e.type === 'spawn') { const item = new TileItem(e.id, e.quantity); eventBus.post('ItemSpawned', { getTile: () => tile, getItem: () => item }); }
      else if (e.type === 'despawn') { const item = new TileItem(e.id, e.quantity); eventBus.post('ItemDespawned', { getTile: () => tile, getItem: () => item }); }
      else { const item = new TileItem(e.id, e.newQuantity); eventBus.post('ItemQuantityChanged', { getTile: () => tile, getItem: () => item, getOldQuantity: () => e.oldQuantity, getNewQuantity: () => e.newQuantity }); }
    }
    // ItemContainerChanged (inventory and worn items)
    for (const id of [InventoryID.INV, InventoryID.WORN, InventoryID.TRAIL_REWARDINV]) {
      const cont = client.getItemContainer(id);
      const sig = cont ? cont.getItems().map((it) => `${it.getId()}:${it.getQuantity()}`).join(',') : null;
      if (sig !== null && derived.containers[id] !== undefined && derived.containers[id] !== sig) {
        eventBus.post('ItemContainerChanged', { getContainerId: () => id, getItemContainer: () => cont });
      }
      derived.containers[id] = sig;
    }
    // FriendsChatSync / FriendsChatMemberJoined / Left: the 2007 clan chat's list (client hook `friendsChat`) compared each poll
    {
      const fc = client.getFriendsChatManager();
      const now = new Map(); if (fc) for (const m of fc.getMembers()) now.set(m.getName(), m);
      const before = derived.friendsChat;
      if (!!fc !== (before != null)) eventBus.post('FriendsChatSync', { isSync: () => !!fc });
      if (fc && before) {
        for (const [n, m] of now) if (!before.has(n)) eventBus.post('FriendsChatMemberJoined', { getMember: () => m });
        for (const [n, m] of before) if (!now.has(n)) eventBus.post('FriendsChatMemberLeft', { getMember: () => m });
      }
      derived.friendsChat = fc ? now : null;
    }
    // PlayerSpawned / PlayerDespawned
    const players = new Map();
    for (const p of client.getPlayers()) players.set(p.info.index, p);
    for (const [i, p] of players) if (!derived.players.has(i)) eventBus.post('PlayerSpawned', { getPlayer: () => p });
    for (const [i, p] of derived.players) if (!players.has(i)) eventBus.post('PlayerDespawned', { getPlayer: () => p });
    derived.players = players;
    // NpcSpawned / NpcDespawned, AnimationChanged, InteractingChanged
    const now = new Map();
    for (const n of client.getNpcs()) now.set(n.info.index, n);
    for (const [i, n] of now) if (!derived.npcs.has(i)) eventBus.post('NpcSpawned', { getNpc: () => n });
    for (const [i, n] of derived.npcs) if (!now.has(i)) eventBus.post('NpcDespawned', { getNpc: () => n });
    derived.npcs = now;
    const me = client.getLocalPlayer();
    const actors = [...now.values(), ...client.getPlayers(), me].filter(Boolean);
    for (const a of actors) {
      const k = a.info.typecode;
      if (derived.anims.has(k) && derived.anims.get(k) !== a.info.animation) eventBus.post('AnimationChanged', { getActor: () => a });
      derived.anims.set(k, a.info.animation);
      const it = a.info.interacting ? `${a.info.interacting.type}:${a.info.interacting.index}` : null;
      if (derived.interacting.has(k) && derived.interacting.get(k) !== it) eventBus.post('InteractingChanged', { getSource: () => a, getTarget: () => a.getInteracting() });
      derived.interacting.set(k, it);
      // GraphicChanged; HitsplatApplied from the entity's hitmark slots (damageCycles = loopCycle + 70 when shown)
      if (derived.graphics.has(k) && derived.graphics.get(k) !== a.getGraphic()) eventBus.post('GraphicChanged', { getActor: () => a });
      derived.graphics.set(k, a.getGraphic());
      const e = a.info.entity; const dc = e && fld('damageCycles') && e[fld('damageCycles')];
      if (dc) {
        const seen = derived.hits.get(k) || [];
        for (let h = 0; h < dc.length; h++) {
          if (dc[h] !== seen[h] && dc[h] > (ll.api && ll.api.loopCycle ? ll.api.loopCycle() : 0) && derived.hits.has(k)) {
            const amount = e[fld('damageValues')][h] | 0; const type = e[fld('damageTypes')][h] | 0;
            const mine = a.info.typecode === 2047 << 14;
            eventBus.post('HitsplatApplied', { getActor: () => a, getHitsplat: () => ({ getAmount: () => amount, getHitsplatType: () => type, isMine: () => mine, isOthers: () => !mine }) });
          }
        }
        derived.hits.set(k, Array.from(dc));
      }
    }
    eventBus.post('GameTick', {});
  }

  // ChatMessageType names for the 2007 client's chat types
  const CHAT_TYPES = { 0: 'GAMEMESSAGE', 1: 'MODCHAT', 2: 'PUBLICCHAT', 3: 'PRIVATECHAT', 4: 'TRADEREQ', 5: 'LOGINLOGOUTNOTIFICATION', 6: 'PRIVATECHATOUT',
    7: 'MODPRIVATECHAT', 8: 'CHALREQ_TRADE', 9: 'FRIENDSCHAT', 11: 'FRIENDSCHATNOTIFICATION', 18: 'PUBLICCHAT' };

  // ---------------------------------------------------------------- config, notifier, plugins

  const configValues = {}; // group -> { key: value } (sent by each plugin's app side)
  let rsProfileKey = null;
  const configManager = {
    // (group, key) or, for RuneScape-profile config, (group, profile, key): stored as "rsprofile.<profile>.<key>"
    getConfiguration(group, a, b) {
      const key = b === undefined ? a : `rsprofile.${a}.${b}`;
      const g = configValues[group]; return g ? g[key] : undefined;
    },
    setConfiguration(group, a, b, c) {
      const [key, value] = arguments.length >= 4 ? [`rsprofile.${a}.${b}`, c] : [a, b];
      if (!configValues[group]) configValues[group] = {};
      configValues[group][key] = value;
      window.postMessage({ __lostlite: true, type: 'rl-config', data: { group, key, value } }, '*');
    },
    unsetConfiguration(group, a, b) {
      if (b === undefined) this.setConfiguration(group, a, undefined); else this.setConfiguration(group, a, b, undefined);
    },
    /** ConfigManager.getConfigurationKeys(prefix): the set keys starting with "<group>.<key prefix>", as "group.key" */
    getConfigurationKeys(prefix) {
      const out = [];
      for (const [group, vals] of Object.entries(configValues)) {
        for (const [k, v] of Object.entries(vals)) if (v !== undefined && v !== null && `${group}.${k}`.startsWith(prefix)) out.push(`${group}.${k}`);
      }
      return out;
    },
    // ConfigManager.get/set/unsetRSProfileConfiguration: the current RuneScape profile's
    getRSProfileConfiguration(group, key) { const p = this.getRSProfileKey(); return p ? this.getConfiguration(group, p, key) : undefined; },
    setRSProfileConfiguration(group, key, value) { const p = this.getRSProfileKey(); if (p) this.setConfiguration(group, p, key, value); },
    unsetRSProfileConfiguration(group, key) { const p = this.getRSProfileKey(); if (p) this.unsetConfiguration(group, p, key); },
    getRSProfileConfigurationKeys(group, profile, keyPrefix) {
      const pre = `rsprofile.${profile}.${keyPrefix}`;
      return Object.keys(configValues[group] || {}).filter((k) => k.startsWith(pre) && configValues[group][k] !== undefined).map((k) => k.slice(`rsprofile.${profile}.`.length));
    },
    /** The RuneScape profile of the account logged in (or last logged in): its name, as our one-world game has no account hash */
    getRSProfileKey() {
      const me = client.getGameState() === GameState.LOGGED_IN ? client.getLocalPlayer() : null;
      if (me && me.getName()) rsProfileKey = String(me.getName()).toLowerCase().replace(/[^a-z0-9]+/g, '_');
      return rsProfileKey;
    },
  };
  const notifier = { notify(message) { window.postMessage({ __lostlite: true, type: 'rl-notify', data: String(message) }, '*'); } };

  /** Config proxy: config.showX() -> the saved value, else the descriptor default; colours as Color. */
  function configProxy(group, items) {
    const list = () => (typeof items === 'function' ? items() : items) || [];
    return new Proxy({}, {
      get(_t, k) {
        const it = list().find((i) => (i.method || i.key) === k) || list().find((i) => i.key === k);
        if (!it) return undefined;
        return (...args) => {
          // a setter (RuneLite's `void username(String key)`): config.key(value)
          if (args.length) { configManager.setConfiguration(group, it.key, args[0]); return undefined; }
          let v = configManager.getConfiguration(group, it.key);
          if (v === undefined) v = it.default;
          if (it.type === 'color') return Color.parse(v);
          if (it.type === 'int') return Number(v) | 0;
          if (it.type === 'double') return Number(v);
          if (it.type === 'boolean' || it.type === 'notification') return !!v;
          if (it.type === 'enumset') return new Set(String(v || '').split(',').filter(Boolean));
          return v;
        };
      },
    });
  }

  const plugins = new Map(); // id -> { plugin, enabled }
  const pluginManager = {
    register(id, plugin) { plugins.set(id, { plugin, enabled: false }); },
    setEnabled(id, on, config) {
      const p = plugins.get(id);
      if (!p) return;
      if (config) {
        configValues[p.plugin.configGroup] = Object.assign(configValues[p.plugin.configGroup] || {}, config);
        if (p.enabled && on && typeof p.plugin.onConfigChanged === 'function') {
          try { p.plugin.onConfigChanged({ getGroup: () => p.plugin.configGroup, getKey: () => null }); } catch { /* keep going */ }
        }
      }
      if (on === p.enabled) return;
      p.enabled = on;
      try {
        if (on) { eventBus.register(p.plugin); if (p.plugin.startUp) p.plugin.startUp(); simulateGameEvents(p.plugin); }
        else { eventBus.unregister(p.plugin); if (p.plugin.shutDown) p.plugin.shutDown(); }
      } catch (e) {
        ll.post && ll.post('runtime-error', `${id} ${on ? 'startUp' : 'shutDown'}: ${e && e.message}`);
      }
    },
  };

  // ---------------------------------------------------------------- overlays

  const OverlayPosition = { DYNAMIC: 'DYNAMIC', DETACHED: 'DETACHED', TOP_LEFT: 'TOP_LEFT', TOP_CENTER: 'TOP_CENTER', TOP_RIGHT: 'TOP_RIGHT',
    BOTTOM_LEFT: 'BOTTOM_LEFT', BOTTOM_RIGHT: 'BOTTOM_RIGHT', ABOVE_CHATBOX_RIGHT: 'ABOVE_CHATBOX_RIGHT', CANVAS_TOP_RIGHT: 'CANVAS_TOP_RIGHT', TOOLTIP: 'TOOLTIP' };
  const OverlayLayer = { UNDER_WIDGETS: 'UNDER_WIDGETS', ABOVE_SCENE: 'ABOVE_SCENE', ABOVE_WIDGETS: 'ABOVE_WIDGETS', ALWAYS_ON_TOP: 'ALWAYS_ON_TOP' };
  const OverlayPriority = { LOW: 0, MED: 50, HIGH: 100, HIGHEST: 200 };

  /** OverlayMenuEntry (Lombok @Value-like: equal by action, option, target) */
  class OverlayMenuEntry {
    constructor(menuAction, option, target) {
      this.menuAction = typeof menuAction === 'string' ? MenuAction[menuAction] : menuAction;
      this.option = option; this.target = target; this.callback = null;
    }
    getMenuAction() { return this.menuAction; }
    getOption() { return this.option; }
    getTarget() { return this.target; }
    equals(o) { return !!o && o.menuAction === this.menuAction && o.option === this.option && o.target === this.target; }
  }
  class Overlay {
    constructor(plugin) {
      this.plugin = plugin || null;
      this.position = OverlayPosition.TOP_LEFT;
      this.priority = 0;
      this.layer = OverlayLayer.UNDER_WIDGETS;
      this.bounds = new Rectangle();
      this.menuEntries = [];
      this.preferredLocation = null;
      this.preferredSize = null;
      this.preferredPosition = null;
      this.movable = true;
      this.resizable = false;
      this.resettable = true;
      this.snappable = true;
      this.dragTargetable = false;
      this.minimumSize = 32;
      this.menuEntries = [];
    }
    setPosition(p) { this.position = p; if (p === OverlayPosition.DYNAMIC || p === OverlayPosition.TOOLTIP) { this.movable = false; this.snappable = false; } }
    getPosition() { return this.position; }
    setPriority(p) { this.priority = typeof p === 'number' ? p : OverlayPriority[p] || 0; }
    setLayer(l) { this.layer = l; }
    setMovable(m) { this.movable = m; }
    setResizable(r) { this.resizable = r; }
    setResettable(r) { this.resettable = r; }
    setSnappable(s) { this.snappable = s; }
    setDragTargetable(d) { this.dragTargetable = d; }
    setMinimumSize(s) { this.minimumSize = s; }
    setPreferredSize(d) { this.preferredSize = d; }
    getPreferredSize() { return this.preferredSize; }
    setPreferredLocation(p) { this.preferredLocation = p; }
    setPreferredPosition(p) { this.preferredPosition = p; }
    getBounds() { return this.bounds; }
    getName() { return this.constructor.name; }
    /** RuneLite's Overlay.addMenuEntry: shown on the menu while Shift is held over the overlay (OverlayRenderer.onPostMenuSort) */
    addMenuEntry(action, option, target, callback) {
      const e = new OverlayMenuEntry(action, option, target);
      e.callback = callback || null;
      this.menuEntries.push(e);
      return e;
    }
    removeMenuEntry(action, option, target) {
      const i = this.menuEntries.findIndex((e) => e.equals(new OverlayMenuEntry(action, option, target)));
      if (i >= 0) this.menuEntries.splice(i, 1);
    }
    getMenuEntries() { return this.menuEntries; }
    isMovable() { return this.movable; }
    render() { return null; }
  }

  /** WidgetItem: an item an inventory component drew this frame (client hook widgetItems) */
  class WidgetItem {
    constructor(id, quantity, widgetId, slot, x, y) { this.id = id; this.quantity = quantity; this.widgetId = widgetId; this.slot = slot; this.x = x; this.y = y; }
    getId() { return this.id; }
    getQuantity() { return this.quantity; }
    getIndex() { return this.slot; }
    getWidget() { return client.getWidget(this.widgetId); }
    getCanvasBounds() { return new Rectangle(this.x, this.y, 32, 32); }
    getCanvasLocation() { return new Point(this.x, this.y); }
    getDraggingCanvasBounds() { return null; }
  }
  /** WidgetItemOverlay: renderItemOverlay for each item drawn by the interfaces it is shown on (2007 interface ids;
   *  drawn above the interfaces, no clipping: 2007's inventories don't scroll their items out of view but the bank's) */
  class WidgetItemOverlay extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.position = OverlayPosition.DYNAMIC;
      this.priority = OverlayPriority.LOW;
      this.layer = OverlayLayer.ABOVE_WIDGETS;
      this.interfaceIds = new Set();
    }
    renderItemOverlay() {}
    render(graphics) {
      const d = ll.api && ll.api.widgetItems ? ll.api.widgetItems() : null;
      if (!d) return null;
      for (let i = 0; i + 5 < d.length; i += 6) {
        if (!this.interfaceIds.has(d[i + 2] >>> 16)) continue;
        this.renderItemOverlay(graphics, d[i], new WidgetItem(d[i], d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5]));
      }
      return null;
    }
    // (InterfaceID: inventory 149, bank side 15, shop side 301, trade 335 / 336, deposit box 11; no GE, seed vault or POH in 2007)
    showOnInventory() { this.showOnInterfaces(11, 15, 301, 149, 335, 336); }
    showOnBank() { this.showOnInterfaces(12); }
    showOnEquipment() { this.showOnInterfaces(387); }
    showOnInterfaces(...ids) { for (const id of ids) this.interfaceIds.add(id); }
    setPosition() { throw new Error('IllegalStateException'); }
    setLayer() { throw new Error('IllegalStateException'); }
  }
  class OverlayPanel extends Overlay {
    constructor(plugin) {
      super(plugin);
      this.panelComponent = new PanelComponent();
      this.clearChildren = true;
      this.dynamicFont = false;
      this.preferredColor = null;
      this.setResizable(true);
    }
    render(graphics) {
      const old = this.panelComponent.getPreferredSize();
      if (this.getPreferredSize()) this.panelComponent.setPreferredSize(this.getPreferredSize());
      this.panelComponent.setBackgroundColor(this.preferredColor || rlConfig.overlayBackgroundColor());
      const d = this.panelComponent.render(graphics);
      if (this.clearChildren) this.panelComponent.getChildren().length = 0;
      this.panelComponent.setPreferredSize(old);
      return d;
    }
  }

  // RuneLite's core settings (RuneLiteConfig's overlay items, the "RuneLite" entry)
  const rlConfig = configProxy('runelite', [
    { key: 'overlayBackgroundColor', type: 'color', default: '#9C463D32' },
    { key: 'infoBoxSize', type: 'int', default: 35 },
    { key: 'infoBoxVertical', type: 'boolean', default: false },
    { key: 'infoBoxTextOutline', type: 'boolean', default: false },
    { key: 'infoboxFontType', method: 'infoboxFont', type: 'enum', default: 'REGULAR' },
    { key: 'interfaceFontType', method: 'interfaceFont', type: 'enum', default: 'REGULAR' },
    { key: 'tooltipFontType', method: 'tooltipFont', type: 'enum', default: 'SMALL' },
    { key: 'fontType', method: 'dynamicOverlayFont', type: 'enum', default: 'SMALL' },
    { key: 'tooltipPosition', type: 'enum', default: 'UNDER_CURSOR' },
  ]);

  // SnapCorners for the fixed-size client: the HUD container is the viewport (4, 4, 512 x 334),
  // the chat box starts at y 338 and is 519 wide
  const BORDER = 5;
  const SNAP = [
    { position: 'TOP_LEFT', mode: 0x80, x: () => view().x + BORDER, y: () => view().y + BORDER + 15 },
    { position: 'TOP_CENTER', mode: 0x04 | 0x80, x: () => view().x + (view().w >> 1), y: () => BORDER },
    { position: 'TOP_RIGHT', mode: 0x01 | 0x80, x: () => view().x + view().w - BORDER, y: () => BORDER },
    { position: 'BOTTOM_LEFT', mode: 0x02 | 0x20, x: () => BORDER, y: () => view().y + view().h - BORDER },
    { position: 'BOTTOM_RIGHT', mode: 0x01 | 0x02 | 0x10, x: () => view().x + view().w - BORDER, y: () => view().y + view().h - BORDER },
    { position: 'ABOVE_CHATBOX_RIGHT', mode: 0x01 | 0x02 | 0x40, x: () => 519 - BORDER, y: () => view().y + view().h - BORDER },
    { position: 'CANVAS_TOP_RIGHT', mode: 0x01 | 0x80, x: () => CANVAS_W, y: () => 0 },
  ];
  const lastSnapSize = {};
  function snapRect(s) {
    const ls = lastSnapSize[s.position] || { sx: 0, sy: 0 };
    const w = Math.max(ls.sx, 80) + 10; const h = Math.max(ls.sy, 80) + 10;
    let x = s.x(); let y = s.y();
    if (s.mode & 0x04) x -= Math.trunc(w / 2); else if (s.mode & 0x01) x -= w;
    if (s.mode & 0x02) y -= h;
    return new Rectangle(x, y, w, h);
  }

  const overlayManager = {
    overlays: [],
    add(o) {
      if (this.overlays.includes(o)) return false;
      this.overlays.push(o);
      this.load(o);
      this.sort();
      return true;
    },
    remove(o) { const i = this.overlays.indexOf(o); if (i >= 0) this.overlays.splice(i, 1); return i >= 0; },
    removeIf(fn) { this.overlays = this.overlays.filter((o) => !fn(o)); },
    sort() { this.overlays.sort((a, b) => (b.priority - a.priority)); },
    key(o, suffix) { return `${o.getName()}_${suffix}`; },
    load(o) {
      const loc = configManager.getConfiguration('runelite', this.key(o, 'preferredLocation'));
      const size = configManager.getConfiguration('runelite', this.key(o, 'preferredSize'));
      const pos = configManager.getConfiguration('runelite', this.key(o, 'preferredPosition'));
      if (loc) { const [x, y] = String(loc).split(':').map(Number); o.preferredLocation = new Point(x, y); }
      if (size) { const [w, h] = String(size).split('x').map(Number); o.preferredSize = new Dimension(w, h); }
      if (pos) o.preferredPosition = pos;
    },
    save(o) {
      const set = (k, v) => configManager.setConfiguration('runelite', this.key(o, k), v);
      set('preferredLocation', o.preferredLocation ? `${o.preferredLocation.x}:${o.preferredLocation.y}` : undefined);
      set('preferredSize', o.preferredSize && o.resizable && o.savedSize ? `${o.preferredSize.width}x${o.preferredSize.height}` : undefined);
      set('preferredPosition', o.preferredPosition || undefined);
    },
    resetOverlay(o) {
      o.preferredPosition = null; o.preferredLocation = null;
      if (o.savedSize) { o.preferredSize = null; o.savedSize = false; }
      this.save(o);
    },
  };

  // TooltipManager / TooltipOverlay
  const tooltipManager = {
    tooltips: [],
    add(t) { this.tooltips.push(typeof t === 'string' ? { text: t } : t); },
    addFront(t) { this.tooltips.unshift(typeof t === 'string' ? { text: t } : t); },
    clear() { this.tooltips = []; },
  };
  class Tooltip { constructor(text) { this.text = text; } }
  let tooltipPrev = { w: 0, h: 0 };
  let uiS = 1; // canvas units per UI pixel for panel overlays: 1 / the game's enlargement (never above 1)
  function renderTooltips(graphics) {
    const list = tooltipManager.tooltips;
    tooltipManager.clear();
    if (!list.length) return;
    const m = client.getMouseCanvasPosition();
    graphics.setFont(FontType[rlConfig.tooltipFont()] ? FontType[rlConfig.tooltipFont()].getFont() : FontManager.small);
    const s = uiS;
    const tx = Math.min(CANVAS_W - tooltipPrev.w, m.x);
    const ty = rlConfig.tooltipPosition() === 'ABOVE_CURSOR' ? Math.max(0, m.y - tooltipPrev.h) : Math.min(CANVAS_H - tooltipPrev.h, m.y + 24 * s);
    graphics.tx = tx; graphics.ty = ty; graphics.scale = s;
    let w = 0; let h = 0;
    for (const t of list) {
      const e = t.component || Object.assign(new TooltipComponent(), { text: t.text });
      if (e instanceof PanelComponent) e.setBackgroundColor(rlConfig.overlayBackgroundColor());
      else e.setBackgroundColor(rlConfig.overlayBackgroundColor());
      e.setPreferredLocation(new Point(0, h));
      const d = e.render(graphics) || new Dimension();
      h += d.height + 2;
      w = Math.max(w, d.width);
    }
    graphics.tx = 0; graphics.ty = 0; graphics.scale = 1;
    tooltipPrev = { w: w * s, h: h * s };
  }

  // InfoBoxManager / InfoBoxOverlay
  class InfoBox {
    constructor(image, plugin) { this.image = image; this.plugin = plugin; this.priority = 0; this.tooltip = null; }
    setImage(i) { this.image = i; }
    getImage() { return this.image; }
    setTooltip(t) { this.tooltip = t; }
    getTooltip() { return this.tooltip; }
    setPriority(p) { this.priority = typeof p === 'number' ? p : { LOW: 0, NONE: 0, MED: 50, HIGH: 100 }[p] || 0; }
    getText() { return ''; }
    getTextColor() { return Color.WHITE; }
    render() { return true; }
    cull() { return false; }
    getName() { return `${this.plugin ? this.plugin.constructor.name : 'Plugin'}_${this.constructor.name}`; }
  }
  class Counter extends InfoBox {
    constructor(image, plugin, count) { super(image, plugin); this.count = count; }
    getCount() { return this.count; }
    setCount(c) { this.count = c; }
    getText() { return String(this.count); }
  }
  class Timer extends InfoBox {
    constructor(periodMs, image, plugin) { super(image, plugin); this.start = Date.now(); this.duration = periodMs; this.end = this.start + periodMs; }
    left() { return this.end - Date.now(); }
    getText() { const s = Math.trunc(this.left() / 1000); return `${Math.trunc((s % 3600) / 60)}:${String(s % 60).padStart(2, '0')}`; }
    getTextColor() { return this.left() / 1000 < (this.duration / 1000) * 0.1 ? Color.RED.brighter() : Color.WHITE; }
    render() { return this.left() >= 0; }
    cull() { return this.left() <= 0; }
    setDuration(ms) { this.duration = ms; this.end = this.start + ms; }
    updateDuration(ms) { this.end = Date.now() + ms; this.duration = this.end - this.start; }
  }
  /** LoopTimer: counts through the period again and again (reverse: down) */
  class LoopTimer extends InfoBox {
    constructor(periodMs, image, plugin, reverse = false) { super(image, plugin); this.startTime = Date.now(); this.duration = periodMs; this.reverse = !!reverse; }
    getProgress() { const p = (Date.now() - this.startTime) % this.duration; return this.reverse ? this.duration - p : p; }
    getText() { const s = Math.trunc(this.getProgress() / 1000); return `${Math.trunc((s % 3600) / 60)}:${String(s % 60).padStart(2, '0')}`; }
    getTextColor() { return Math.trunc(this.getProgress() / 1000) < Math.trunc(this.duration / 1000) * 0.1 ? Color.RED.brighter() : Color.WHITE; }
  }
  const infoBoxManager = {
    boxes: [],
    addInfoBox(b) { if (!this.boxes.includes(b)) { this.boxes.push(b); this.boxes.sort((a, c) => c.priority - a.priority); } },
    removeInfoBox(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); return i >= 0; },
    removeIf(fn) { this.boxes = this.boxes.filter((b) => !fn(b)); },
    getInfoBoxes() { return this.boxes; },
    cull() { this.boxes = this.boxes.filter((b) => !b.cull()); },
  };
  // the app's own plugins not cloned from RuneLite add boxes and panels through the older hooks
  // (ll.addInfoBoxes / addOverlayPanel): shown here as InfoBoxes and panels
  class LegacyBox extends InfoBox {
    constructor(b) { super(b.image, null); this.b = b; this.tooltip = b.tooltip || null; this.priority = b.priority || 0; }
    getText() { return this.b.text || ''; }
    getTextColor() { return new Color(this.b.colour === undefined ? 0xffffff : this.b.colour); }
    getName() { return `Legacy_${this.b.name || 'box'}`; }
  }

  class InfoBoxOverlay extends OverlayPanel {
    constructor() {
      super(null);
      this.setPosition(OverlayPosition.TOP_LEFT);
      this.setPriority(OverlayPriority.LOW);
      this.panelComponent.setBackgroundColor(null);
      this.panelComponent.setBorder(new Rectangle());
      this.panelComponent.setGap(new Point(1, 1));
      this.panelComponent.setWrap(true);
    }
    getName() { return 'InfoBoxOverlay'; }
    render(graphics) {
      infoBoxManager.cull();
      const boxes = infoBoxManager.getInfoBoxes().slice();
      for (const [id, fn] of ll.infoBoxProviders || []) {
        const pl = ll.pagePlugins.get(id);
        if (pl && !pl.enabled) continue;
        try { for (const b of fn(performance.now()) || []) boxes.push(new LegacyBox(b)); } catch { /* skip */ }
      }
      if (!boxes.length) return null;
      const size = rlConfig.infoBoxSize();
      this.panelComponent.setPreferredSize(new Dimension(4 * (size + 1), 4 * (size + 1)));
      this.panelComponent.setOrientation(rlConfig.infoBoxVertical() ? ComponentOrientation.VERTICAL : ComponentOrientation.HORIZONTAL);
      const ft = FontType[rlConfig.infoboxFont()] || FontType.REGULAR;
      for (const box of boxes) {
        try { if (!box.render()) continue; } catch { continue; }
        const ic = new InfoBoxComponent();
        ic.text = box.getText(); ic.font = ft.getFont();
        const col = box.getTextColor(); if (col) ic.color = col;
        ic.outline = rlConfig.infoBoxTextOutline();
        ic.image = scaled(box.getImage(), size);
        ic.tooltip = box.getTooltip();
        ic.preferredSize = new Dimension(size, size);
        ic.backgroundColor = rlConfig.overlayBackgroundColor();
        ic.infoBox = box;
        this.panelComponent.getChildren().push(ic);
      }
      const old = this.panelComponent.getPreferredSize();
      const d = this.panelComponent.render(graphics);
      const m = client.getMouseCanvasPosition();
      for (const ic of this.panelComponent.getChildren()) {
        const b0 = ic.getBounds();
        const r = new Rectangle(this.bounds.x + b0.x * uiS, this.bounds.y + b0.y * uiS, b0.width * uiS, b0.height * uiS);
        if (r.contains(m)) { if (ic.getTooltip()) tooltipManager.add(new Tooltip(ic.getTooltip())); break; }
      }
      this.panelComponent.getChildren().length = 0;
      this.panelComponent.setPreferredSize(old);
      return d;
    }
  }
  // InfoBoxManager.updateInfoBoxImage: shrink to the box size (never grow)
  const scaledCache = new WeakMap();
  function scaled(img, size) {
    const el = toImage(img);
    if (!el) return null;
    const w = imgW(el); const h = imgH(el);
    if (w <= size && h <= size) return el;
    let m = scaledCache.get(el);
    if (!m) { m = new Map(); scaledCache.set(el, m); }
    if (m.has(size)) return m.get(size);
    const f = Math.min(size / w, size / h);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * f)); c.height = Math.max(1, Math.round(h * f));
    c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
    m.set(size, c);
    return c;
  }
  const infoBoxOverlay = new InfoBoxOverlay();
  overlayManager.add(infoBoxOverlay);

  // legacy panels (RuneLite's PanelComponent rows from the app's older plugins)
  class LegacyPanelOverlay extends OverlayPanel {
    constructor(name) { super(null); this.legacyName = name; this.data = null; this.setPosition(OverlayPosition.TOP_LEFT); }
    getName() { return `Legacy_${this.legacyName}`; }
    render(graphics) {
      const p = this.data;
      if (!p) return null;
      for (const r of p.rows) {
        if (r.type === 'title') this.panelComponent.getChildren().push(new TitleComponent({ text: r.text, color: new Color(r.colour === undefined ? 0xffffff : r.colour) }));
        else if (r.type === 'line') this.panelComponent.getChildren().push(new LineComponent({ left: r.left, right: r.right, leftColor: new Color(r.leftColour === undefined ? 0xffffff : r.leftColour), rightColor: new Color(r.rightColour === undefined ? 0xffffff : r.rightColour) }));
        else if (r.type === 'bar') {
          const b = new ProgressBarComponent();
          b.setMaximum(1000); b.setValue(Math.round(r.fraction * 1000)); b.setLabelDisplayMode('TEXT_ONLY'); b.setCenterLabel(r.text);
          b.setForegroundColor(Color.parse(r.fg) || Color.GREEN); b.setBackgroundColor(Color.parse(r.bg) || Color.RED);
          this.panelComponent.getChildren().push(b);
        }
      }
      return super.render(graphics);
    }
  }
  const legacyPanels = new Map();
  function syncLegacyPanels() {
    const seen = new Set();
    for (const [id, fn] of ll.overlayPanels || []) {
      const pl = ll.pagePlugins.get(id);
      if (pl && !pl.enabled) continue;
      let list = [];
      try { list = fn(performance.now()) || []; } catch { /* skip */ }
      for (const p of list) {
        seen.add(p.name);
        let o = legacyPanels.get(p.name);
        if (!o) { o = new LegacyPanelOverlay(p.name); legacyPanels.set(p.name, o); overlayManager.add(o); }
        o.data = p;
      }
    }
    for (const [n, o] of legacyPanels) if (!seen.has(n)) o.data = null;
  }

  // ---------------------------------------------------------------- OverlayRenderer

  let ui = null;
  function ensureCanvas() {
    if (ui && ui.canvas.isConnected) return ui;
    const canvas = document.createElement('canvas');
    canvas.id = 'rl-overlays';
    for (const [k, v] of Object.entries({ position: 'fixed', 'pointer-events': 'none', 'z-index': '2147483646', display: 'block', margin: '0' })) canvas.style.setProperty(k, v, 'important');
    document.body.appendChild(canvas);
    ui = { canvas, ctx: canvas.getContext('2d') };
    return ui;
  }
  // RuneLite draws tooltips over everything: their own canvas at the top of the page's stacking order (above our Status
  // Orbs' canvases, which sit at the highest z-index: equal z-index, so it is kept the body's last child)
  let tipUi = null;
  function ensureTipCanvas() {
    if (!tipUi || !tipUi.canvas.isConnected) {
      const canvas = document.createElement('canvas');
      canvas.id = 'rl-tooltips';
      for (const [k, v] of Object.entries({ position: 'fixed', 'pointer-events': 'none', 'z-index': '2147483647', display: 'block', margin: '0' })) canvas.style.setProperty(k, v, 'important');
      document.body.appendChild(canvas);
      tipUi = { canvas, ctx: canvas.getContext('2d') };
    }
    if (document.body.lastElementChild !== tipUi.canvas) document.body.appendChild(tipUi.canvas);
    return tipUi;
  }

  const R = {
    managing: false, dragging: false, resizing: false, current: null, hovered: null, lastHovered: null,
    offset: new Point(), managedBounds: null, cursor: null, dragTarget: null,
  };

  function setCursor(c) {
    if (c === R.cursor) return;
    R.cursor = c;
    const cv = document.getElementById('canvas');
    if (cv) cv.style.cursor = c || '';
  }

  /** the open modal sub-interfaces (WidgetModalMode MODAL_NOCLICKTHROUGH / MODAL_CLICKTHROUGH) inside the viewport, cut
   *  out of the world overlays' clip; holes must not overlap (evenodd), so only the disjoint ones are kept */
  function interfaceHoles(v) {
    const t = ll.api && ll.api.subRects ? ll.api.subRects() : [];
    const out = [];
    for (let i = 0; i + 5 < t.length; i += 6) {
      const mode = t[i + 1];
      if (mode !== 0 && mode !== 3) continue;
      const x1 = Math.max(v.x, t[i + 2]); const y1 = Math.max(v.y, t[i + 3]);
      const x2 = Math.min(v.x + v.w, t[i + 2] + t[i + 4]); const y2 = Math.min(v.y + v.h, t[i + 3] + t[i + 5]);
      if (x2 <= x1 || y2 <= y1) continue;
      const r = new Rectangle(x1, y1, x2 - x1, y2 - y1);
      if (!out.some((o) => o.intersects(r))) out.push(r);
    }
    return out;
  }
  function renderOverlays(gfx, layers) {
    // positions of the snap corners this frame
    const st = {};
    for (const s of SNAP) st[s.position] = { s, px: s.x(), py: s.y(), sx: 0, sy: 0 };
    const mouse = client.getMouseCanvasPosition();
    R.hovered = null;
    R.gfx = gfx; // (core) the graphics overlays draw on now: ModelOutlineRenderer (corea.js) draws there
    const v = view();
    for (const o of overlayManager.overlays) {
      if (!layers.includes(o.layer)) continue;
      const pos = o.preferredPosition || o.position;
      gfx.setFont(o.position === OverlayPosition.DYNAMIC || o.position === OverlayPosition.DETACHED
        ? (FontType[rlConfig.dynamicOverlayFont()] || FontType.SMALL).getFont()
        : (FontType[rlConfig.interfaceFont()] || FontType.REGULAR).getFont());
      gfx.setColor(Color.WHITE);
      gfx.setStroke(new BasicStroke(1));
      // (as RuneLite's OverlayRenderer: an overlay with a preferred location is drawn there, e.g. Screen Markers' DYNAMIC ones)
      if ((pos === OverlayPosition.DYNAMIC || pos === OverlayPosition.TOOLTIP) && !o.preferredLocation) {
        gfx.tx = 0; gfx.ty = 0;
        // world overlays are cut to the viewport, as RuneLite's
        const world = o.layer === OverlayLayer.ABOVE_SCENE || o.layer === OverlayLayer.UNDER_WIDGETS;
        gfx.setClip(world ? new Rectangle(v.x, v.y, v.w, v.h) : null);
        // and drawn under the open interfaces (RuneLite draws these layers before the widgets): the modal
        // sub-interfaces' rectangles are cut out (client hook `subRects`)
        if (world) { gfx.baseHoles = interfaceHoles(v); gfx.setClipHoles(gfx.baseHoles); }
        try { o.render(gfx); } catch (e) { reportError(o, e); }
        gfx.baseHoles = null;
        gfx.setClip(null);
        continue;
      }
      // panel overlays: UNDER_WIDGETS ones are drawn under the open main-area interfaces too (RuneLite draws that layer
      // before the widgets), ABOVE_WIDGETS / ALWAYS_ON_TOP ones on top of them
      const holes = o.layer === OverlayLayer.UNDER_WIDGETS ? interfaceHoles(v) : [];
      gfx.baseHoles = holes.length ? holes : null;
      gfx.setClip(null);
      const b = o.bounds;
      let loc;
      let corner = null;
      if (o.preferredLocation && !(R.current === o && R.dragging && false)) loc = new Point(o.preferredLocation.x, o.preferredLocation.y);
      else {
        corner = st[pos] || st.TOP_LEFT;
        loc = new Point(corner.px, corner.py);
        if (corner.s.mode & 0x04) loc.x -= Math.trunc(b.width / 2); else if (corner.s.mode & 0x01) loc.x -= b.width;
        if (corner.s.mode & 0x02) loc.y -= b.height;
      }
      // clampOverlayLocation
      loc.x = Math.max(0, Math.min(CANVAS_W - b.width, loc.x));
      loc.y = Math.max(0, Math.min(CANVAS_H - b.height, loc.y));
      // (core) o.widgetScale: a game widget RuneLite moves (WidgetOverlay) scales with the game like the world overlays
      const oS = o.widgetScale ? 1 : uiS;
      if (o.preferredSize) b.setSize(o.preferredSize.width * oS, o.preferredSize.height * oS);
      gfx.tx = loc.x; gfx.ty = loc.y; gfx.scale = oS;
      let dim = null;
      try { dim = o.render(gfx); } catch (e) { reportError(o, e); }
      gfx.baseHoles = null;
      gfx.setClip(null);
      gfx.tx = 0; gfx.ty = 0; gfx.scale = 1;
      if (!dim) { b.setBounds(loc.x, loc.y, 0, 0); continue; }
      b.setBounds(loc.x, loc.y, dim.width * oS, dim.height * oS);
      if (corner && dim.width + dim.height > 0) {
        const ex = corner.s.mode & 0xf0;
        if (ex === 0x10) corner.px = Math.min(corner.px, b.x - 2);
        if (ex === 0x20) corner.px = Math.max(corner.px, b.x + b.width + 2);
        if (ex === 0x40) corner.py = Math.min(corner.py, b.y - 2);
        if (ex === 0x80) corner.py = Math.max(corner.py, b.y + b.height + 2);
        if (ex === 0x40 || ex === 0x80) { corner.sx = Math.max(corner.sx, b.width); corner.sy += b.height + 2; } else { corner.sx += b.width + 2; corner.sy = Math.max(corner.sy, b.height); }
      }
      if (!b.isEmpty()) {
        if (R.managing && o.movable) {
          let col = new Color(255, 255, 0, 100);
          if (R.resizing && R.current === o) col = new Color(255, 0, 255, 200);
          else if (R.dragging && R.current === o) col = new Color(255, 255, 0, 200);
          else if (R.dragging && o.dragTargetable && R.current && R.current.dragTargetable && R.current.bounds.intersects(b)) { col = Color.RED; R.dragTarget = o; }
          gfx.setColor(col);
          gfx.draw(b);
        }
        if (!client.isMenuOpen() && b.contains(mouse) && !holes.some((h) => h.contains(mouse))) {
          if (!R.hovered || b.width * b.height <= R.hovered.bounds.width * R.hovered.bounds.height) R.hovered = o;
        }
      }
    }
    for (const s of SNAP) lastSnapSize[s.position] = { sx: st[s.position].sx, sy: st[s.position].sy };
    R.lastHovered = R.hovered;
  }
  function reportError(o, e) {
    if (o._failed) return;
    o._failed = true;
    ll.post && ll.post('runtime-error', `overlay ${o.getName()}: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`);
  }

  function paint() {
    pushStretch();
    const cv = document.getElementById('canvas');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const u = ensureCanvas();
    const zoom = r.width / CANVAS_W;
    const zoomY = r.height / CANVAS_H; // differs from zoom when Stretched Mode doesn't keep the aspect ratio
    // RuneLite's stretched mode: world overlays (DYNAMIC, in game coordinates) scale with the game view; panel
    // overlays, info boxes and tooltips stay at UI scale. The canvas is device-pixel sized and pixel icons are
    // drawn nearest-neighbour, so both stay crisp.
    uiS = 1 / Math.max(1, zoom);
    const dpr = window.devicePixelRatio || 1;
    const st = u.canvas.style;
    st.setProperty('left', `${r.left}px`, 'important'); st.setProperty('top', `${r.top}px`, 'important');
    st.setProperty('width', `${r.width}px`, 'important'); st.setProperty('height', `${r.height}px`, 'important');
    const ps = dpr * zoom; const psY = dpr * zoomY;
    const W = Math.round(CANVAS_W * ps); const H = Math.round(CANVAS_H * psY);
    if (u.canvas.width !== W || u.canvas.height !== H) { u.canvas.width = W; u.canvas.height = H; }
    const cx = u.ctx;
    cx.setTransform(ps, 0, 0, psY, 0, 0);
    cx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const gfx = new Graphics2D(cx);
    const t = ensureTipCanvas();
    for (const k of ['left', 'top', 'width', 'height']) t.canvas.style.setProperty(k, st.getPropertyValue(k), 'important');
    if (t.canvas.width !== W || t.canvas.height !== H) { t.canvas.width = W; t.canvas.height = H; }
    const tcx = t.ctx;
    tcx.setTransform(ps, 0, 0, psY, 0, 0);
    tcx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (client.getGameState() === GameState.LOGGED_IN) {
      syncLegacyPanels();
      renderOverlays(gfx, [OverlayLayer.ABOVE_SCENE, OverlayLayer.UNDER_WIDGETS, OverlayLayer.ABOVE_WIDGETS, OverlayLayer.ALWAYS_ON_TOP]);
      if (R.managing) {
        const m = client.getMouseCanvasPosition();
        for (const s of SNAP) {
          const rr = snapRect(s);
          gfx.setColor(R.dragging && rr.contains(m) ? new Color(0, 255, 0, 100) : new Color(0, 255, 255, 50));
          gfx.fill(rr);
        }
      }
      renderTooltips(new Graphics2D(tcx));
      // the game's right-click menu stays on top
      const c = c0();
      if (c && client.isMenuOpen() && fld('menuX')) {
        const n = c[fld('menuCount')] | 0;
        cx.clearRect(c[fld('menuX')], c[fld('menuY')], c[fld('menuWidth')] | 0, n * 15 + 22);
        tcx.clearRect(c[fld('menuX')], c[fld('menuY')], c[fld('menuWidth')] | 0, n * 15 + 22);
      }
    } else {
      tooltipManager.clear();
    }
    lastPaint = performance.now();
  }
  let lastPaint = 0;
  setInterval(() => {
    if (tipUi && performance.now() - lastPaint > 300) { tipUi.ctx.setTransform(1, 0, 0, 1, 0, 0); tipUi.ctx.clearRect(0, 0, tipUi.canvas.width, tipUi.canvas.height); }
    if (ui && performance.now() - lastPaint > 300) { ui.ctx.setTransform(1, 0, 0, 1, 0, 0); ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height); lastPaint = Infinity; }
  }, 250);

  // mouse: OverlayRenderer.mousePressed / mouseDragged / mouseReleased / mouseMoved
  function canvasPoint(e) {
    const cv = document.getElementById('canvas');
    const r = cv && cv.getBoundingClientRect();
    if (!r || !r.width) return null;
    return new Point(((e.clientX - r.left) * CANVAS_W) / r.width, ((e.clientY - r.top) * CANVAS_H) / r.height);
  }
  function edgeCursor(o, p) {
    if (!o || !o.resizable) return null;
    const b = o.bounds; const T = 5;
    const top = p.y - b.y < T; const bottom = b.y + b.height - p.y < T; const left = p.x - b.x < T; const right = b.x + b.width - p.x < T;
    const e = (top ? 'n' : bottom ? 's' : '') + (left ? 'w' : right ? 'e' : '');
    return e ? `${e}-resize` : null;
  }
  function mouseDown(x, y, button, e) {
    if (!R.managing) return false;
    const p = canvasPoint(e) || new Point(x + view().x, y + view().y);
    R.current = R.lastHovered;
    const o = R.current;
    if (!o || !o.movable) return false;
    if (button === 2) { if (o.resettable) overlayManager.resetOverlay(o); return true; }
    if (button !== 0) return false;
    R.offset = new Point(p.x - o.bounds.x, p.y - o.bounds.y);
    R.resizing = o.resizable && !!R.cursor;
    R.dragging = !R.resizing;
    R.managedBounds = new Rectangle(o.bounds);
    return true;
  }
  function mouseMove(x, y, e) {
    const p = canvasPoint(e) || new Point(x + view().x, y + view().y);
    if (!R.managing) return false;
    if (!R.dragging && !R.resizing) {
      R.current = R.lastHovered;
      setCursor(edgeCursor(R.current, p));
      return false;
    }
    const o = R.current;
    if (!o) return false;
    if (p.x < 0 || p.y < 0 || p.x >= CANVAS_W || p.y >= CANVAS_H) return true;
    if (R.resizing) {
      const mb = R.managedBounds;
      const left = Math.round(p.x - mb.x); const top = Math.round(p.y - mb.y);
      let nx = mb.x; let ny = mb.y; let w = mb.width; let h = mb.height;
      const c = R.cursor || '';
      if (c.startsWith('n')) { ny += top; h -= top; }
      if (c.startsWith('s')) h = top;
      if (/^(n|s)?w/.test(c)) { nx += left; w -= left; }
      if (/^(n|s)?e/.test(c)) w = left;
      const min = o.minimumSize;
      if (w < min) { if (nx > mb.x) nx -= min - w; w = min; }
      if (h < min) { if (ny > mb.y) ny -= min - h; h = min; }
      o.preferredSize = new Dimension(Math.round(w / uiS), Math.round(h / uiS));
      o.savedSize = true;
      if (o.preferredLocation) o.preferredLocation = new Point(o.preferredLocation.x + nx - R.managedBounds.x, o.preferredLocation.y + ny - R.managedBounds.y);
      R.managedBounds = new Rectangle(nx, ny, w, h);
    } else {
      const nx = Math.max(0, Math.min(CANVAS_W - o.bounds.width, Math.round(p.x - R.offset.x)));
      const ny = Math.max(0, Math.min(CANVAS_H - o.bounds.height, Math.round(p.y - R.offset.y)));
      o.preferredPosition = null;
      o.preferredLocation = new Point(nx, ny);
    }
    return true;
  }
  function mouseUp(x, y, button, e) {
    if (!R.managing || (!R.dragging && !R.resizing) || !R.current) { R.dragging = false; R.resizing = false; return false; }
    const p = canvasPoint(e) || new Point(x + view().x, y + view().y);
    const o = R.current;
    if (R.dragging && o.snappable) {
      for (const s of SNAP) {
        if (snapRect(s).contains(p)) {
          o.preferredPosition = s.position === o.position ? null : s.position;
          o.preferredLocation = null;
          break;
        }
      }
    }
    overlayManager.save(o);
    R.dragging = false; R.resizing = false; R.current = null; R.dragTarget = null;
    setCursor(null);
    return true;
  }
  function managingMode(on) {
    if (R.managing === on) return;
    R.managing = on;
    if (!on) { R.dragging = false; R.resizing = false; R.current = null; setCursor(null); }
  }

  // ---------------------------------------------------------------- fonts and assets from the app

  const assets = {};
  let fontsLoaded = false;
  function loadFonts(fonts) {
    if (fontsLoaded || !fonts || typeof FontFace === 'undefined') return;
    fontsLoaded = true;
    for (const [name, url] of Object.entries(fonts)) {
      if (!url) continue;
      new FontFace(name, `url(${url})`).load().then((f) => document.fonts.add(f)).catch(() => {});
    }
  }
  const imageFromUrl = (url) => { if (!url) return null; const i = new Image(); i.src = url; return i; };
  const SkillIconManager = {
    getSkillImage(skill, small = false) {
      const k = `${small ? 'skill_icons_small' : 'skill_icons'}/${skill.name.toLowerCase()}.png`;
      if (!assets[k]) return null;
      if (!assets[k].img) assets[k].img = imageFromUrl(assets[k].url);
      return assets[k].img;
    },
  };
  const itemManager = {
    getImage(id, qty = 1) { return ll.itemIcon ? ll.itemIcon(id, qty) : null; },
    getItemComposition(id) { return client.getItemDefinition(id); },
    /** ItemManager.canonicalize: a noted item is its unnoted one (2007 has no placeholders) */
    canonicalize(id) { const c = client.getItemDefinition(id); return c.getNote() !== -1 && c.getLinkedNoteId() !== -1 ? c.getLinkedNoteId() : id; },
    // ItemManager.getItemPrice: coins are 1; there is no Grand Exchange in Sept 2007 (it opened in Nov 2007), so the
    // item's store value stands in for the GE price
    getItemPrice(id) { if (id === 995) return 1; return client.getItemDefinition(id).getPrice(); },
  };
  const spriteManager = {
    getSprite(id, file = 0) { return ll.sprite ? ll.sprite(id, file) : null; },
    /** (core) OSRS art the 2007 cache lacks, from runelite/assets (e.g. 'bank/search.png') */
    getAsset(k) { const a = assets[k]; if (!a) return null; if (!a.img) a.img = imageFromUrl(a.url); return a.img; },
  };

  // ---------------------------------------------------------------- menus: MenuEntryAdded, createMenuEntry

  /** RuneLite's "<col=ff981f>x</col>" as the 2007 client's colour tags */
  function toGameTags(s) {
    return String(s == null ? '' : s)
      .replace(/<col=([0-9a-fA-F]{1,6})>/g, (m, h) => { const v = parseInt(h, 16); return AT_NAMES.has(v) ? `@${AT_NAMES.get(v)}@` : ll.colourTag ? ll.colourTag(v) : ''; })
      .replace(/<\/col>/g, '@whi@');
  }
  // (the 2007 client's opcodes: Client.addMenuOption's for ground objs, 3 4 5 2 1 by op)
  const MenuAction = {
    RUNELITE: 1500, RUNELITE_OVERLAY: 1502, RUNELITE_OVERLAY_CONFIG: 1503, CC_OP: 57, WIDGET_TARGET: 25,
    GROUND_ITEM_FIRST_OPTION: 5, GROUND_ITEM_SECOND_OPTION: 22, GROUND_ITEM_THIRD_OPTION: 41, GROUND_ITEM_FOURTH_OPTION: 57, GROUND_ITEM_FIFTH_OPTION: 3,
    EXAMINE_ITEM_GROUND: 1006, WIDGET_TARGET_ON_GROUND_ITEM: 25,
    GAME_OBJECT_FIRST_OPTION: 7, GAME_OBJECT_SECOND_OPTION: 35, GAME_OBJECT_THIRD_OPTION: 51, GAME_OBJECT_FOURTH_OPTION: 33, GAME_OBJECT_FIFTH_OPTION: 1004,
    EXAMINE_OBJECT: 1005, WIDGET_TARGET_ON_GAME_OBJECT: 24, ITEM_USE_ON_GAME_OBJECT: 26,
    NPC_FIRST_OPTION: 17, NPC_SECOND_OPTION: 38, NPC_THIRD_OPTION: 34, NPC_FOURTH_OPTION: 32, NPC_FIFTH_OPTION: 4,
    EXAMINE_NPC: 1002, WIDGET_TARGET_ON_NPC: 19, ITEM_USE_ON_NPC: 48,
    PLAYER_FIRST_OPTION: 30, PLAYER_SECOND_OPTION: 58, PLAYER_THIRD_OPTION: 29, PLAYER_FOURTH_OPTION: 45, PLAYER_FIFTH_OPTION: 37,
    PLAYER_SIXTH_OPTION: 16, PLAYER_SEVENTH_OPTION: 1, PLAYER_EIGHTH_OPTION: 50, WIDGET_TARGET_ON_PLAYER: 23, ITEM_USE_ON_PLAYER: 14,
    WALK: 10, CANCEL: 1007,
    of: (t) => t,
  };
  /** A menu entry: option and target in RuneLite's <col> tags; live entries (MenuEntryAdded's) write their changes straight
   *  into the client's menu, snapshots (getMenuEntries) go back with setMenuEntries */
  class MenuEntryImpl {
    constructor(arr, i, live) {
      const raw = String(arr[0][i] || '');
      const tagAt = raw.search(/@(?:~[0-9a-z]{2}|[a-z0-9]{3})@/i);
      this.raw = raw;
      this.option = tagAt > 0 ? raw.slice(0, tagAt).trim() : raw;
      this.target = tagAt > 0 ? Text.fromGameTags(raw.slice(tagAt)) : '';
      this.type = arr[1][i]; this.identifier = arr[2][i]; this.param0 = arr[3][i]; this.param1 = arr[4][i];
      this.arr = live ? arr : null; this.index = i; this.deprioritized = false;
    }
    getOption() { return this.option; }
    getTarget() { return this.target; }
    getType() { return this.type; }
    getIdentifier() { return this.identifier; }
    getParam0() { return this.param0; }
    getParam1() { return this.param1; }
    getWorldViewId() { return -1; }
    /** the NPC an NPC entry is for (the identifier is its index) */
    getNpc() {
      const t = this.type >= 2000 ? this.type - 2000 : this.type;
      if (!NPC_OPS.has(t)) return null;
      return client.getNpcs().find((n) => n.getIndex() === this.identifier) || null;
    }
    /** the Player a player entry is for (the identifier is its index) */
    getPlayer() {
      const t = this.type >= 2000 ? this.type - 2000 : this.type;
      if (!PLAYER_OPS.has(t)) return null;
      return client.getPlayers().find((p) => p.getIndex() === this.identifier) || null;
    }
    text() { return toGameTags(this.option) + (this.target ? ' ' + toGameTags(this.target) : ''); }
    write() { if (this.arr) { this.arr[0][this.index] = this.text(); this.raw = this.text(); } }
    setOption(o) { this.option = o; this.write(); return this; }
    setTarget(t) { this.target = t; this.write(); return this; }
    /** (RuneLite adds 2000 to the opcode, which sorts it below every normal entry, under Walk here) */
    setDeprioritized(d) {
      if (d && !this.deprioritized && this.type < 2000) { this.type += 2000; if (this.arr) { this.arr[1][this.index] = this.type; menuResort = true; } }
      this.deprioritized = !!d;
      return this;
    }
    isDeprioritized() { return this.deprioritized; }
    setType(t) { this.type = t; if (this.arr) this.arr[1][this.index] = t; return this; }
    /** held item entries (OPHELD1-5): getItemOp 1-5, getItemId the item; getWidget the component (param1) with the item */
    getItemOp() { const t = this.type >= 2000 ? this.type - 2000 : this.type; const i = [28, 9, 2, 21, 18].indexOf(t); return i + 1; }
    getItemId() { const t = this.type >= 2000 ? this.type - 2000 : this.type; return HELD_OPS.has(t) ? Number(this.identifier) | 0 : -1; }
    getWidget() {
      const t = this.type >= 2000 ? this.type - 2000 : this.type;
      if (!HELD_OPS.has(t)) return null;
      const id = this.param1 | 0; const item = Number(this.identifier) | 0; const slot = this.param0 | 0;
      return { getId: () => id, getItemId: () => item, getIndex: () => slot };
    }
    equals(o) {
      return o instanceof MenuEntryImpl && o.option === this.option && o.target === this.target && o.type === this.type
        && o.identifier === this.identifier && o.param0 === this.param0 && o.param1 === this.param1;
    }
  }
  const NPC_OPS = new Set([17, 38, 34, 32, 4, 1002, 19, 48]);
  const PLAYER_OPS = new Set([30, 58, 29, 45, 37, 16, 1, 50, 23, 14]);
  // held (inventory) item entries: OPHELD1-5, Use (12), Examine (1001)
  const HELD_OPS = new Set([28, 9, 2, 21, 18, 12, 1001]);
  let menuResort = false;
  function menuEntryAt(c, i) { return new MenuEntryImpl(ll.menuArrays(c), i, true); }
  /** Client.setMenuEntries: the client's menu becomes these entries (bottom first) */
  function setMenuEntries(entries) {
    const c = c0();
    if (!c || !fld('menuCount')) return;
    const arr = ll.menuArrays(c);
    entries.forEach((e, i) => { arr[0][i] = e.text(); arr[1][i] = e.type; arr[2][i] = e.identifier; arr[3][i] = e.param0; arr[4][i] = e.param1; });
    c[fld('menuCount')] = entries.length;
  }
  /** the client's Minimenu::Sort (entries over 1000 below the others), again after deprioritized entries changed */
  function resortMenu(c) {
    const arr = ll.menuArrays(c); const n = c[fld('menuCount')] | 0;
    for (let done = false; !done;) {
      done = true;
      for (let i = 0; i < n - 1; i++) {
        if (arr[1][i] < 1000 && arr[1][i + 1] > 1000) {
          done = false;
          for (const a of arr) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; }
        }
      }
    }
  }
  class NewMenuEntry {
    constructor() { this.option = ''; this.target = ''; this.type = MenuAction.RUNELITE; this.identifier = 0; this.param0 = 0; this.param1 = 0; this.click = null; }
    setOption(o) { this.option = o; return this; }
    setTarget(t) { this.target = t; return this; }
    setType(t) { this.type = t; return this; }
    setIdentifier(i) { this.identifier = i; return this; }
    setParam0(p) { this.param0 = p; return this; }
    setParam1(p) { this.param1 = p; return this; }
    setItemId(i) { this.itemId = i; return this; }
    getItemId() { return this.itemId === undefined ? -1 : this.itemId; }
    getParam0() { return this.param0; }
    getParam1() { return this.param1; }
    setDeprioritized() { return this; }
    setWorldViewId() { return this; }
    getWorldViewId() { return -1; }
    getIdentifier() { return this.identifier; }
    getType() { return this.type; }
    onClick(fn) { this.click = fn; return this; }
    getOption() { return this.option; }
    getTarget() { return this.target; }
    text() { return toGameTags(this.option) + (this.target ? ' ' + toGameTags(this.target) : ''); }
  }
  const menuBuildHooks = []; // core widgets the 2007 client lacks, adding their entries before MenuEntryAdded is posted
  const menuBuiltHooks = []; // and after (MenuShouldLeftClick)
  ll.menuBuildHooks = menuBuildHooks; // (for core2007.js's emulated widget buttons)
  let menuAdding = null; // the entry MenuEntryAdded is being posted for: { c, created }
  /** Client.createMenuEntry(idx): -1 puts it on top of the menu as it is (above the entry being added) */
  function createMenuEntry(idx) {
    const e = new NewMenuEntry();
    if (menuAdding && idx === -1) { menuAdding.created.push(e); return e; }
    // -2 while an entry is being added: just under it (RuneLite's index from the end of the menu as it is)
    if (menuAdding && idx === -2) { e.below = true; menuAdding.created.push(e); return e; }
    const c = c0();
    if (!c || !fld('menuCount')) return e;
    const n = c[fld('menuCount')] | 0;
    const at = idx < 0 ? n + idx + 1 : idx;
    queueMicrotask(() => ll.insertMenuEntry(c, at, e.text(), () => e.click && e.click(e)));
    return e;
  }
  /** OverlayRenderer.onPostMenuSort: with Shift held over an overlay, its menu entries go in under the top entry
   *  (createMenuEntry(-2), added in reverse so they read in order); a click runs the entry's callback or posts
   *  OverlayMenuClicked. (The Shift origin submenu, OverlayManager.addOriginMenu, needs submenus: not in 2007.) */
  function overlayMenu(c) {
    const overlay = R.lastHovered;
    if (!overlay || client.isMenuOpen() || !client.isKeyPressed(KeyCode.KC_SHIFT)) return;
    const entries = overlay.getMenuEntries ? overlay.getMenuEntries() : [];
    for (let i = entries.length - 1; i >= 0; --i) {
      const ome = entries[i];
      const e = new NewMenuEntry();
      e.option = ome.getOption();
      e.target = ColorUtil.wrapWithColorTag(ome.getTarget(), new Color(255, 144, 64)); // JagexColors.MENU_TARGET
      e.type = ome.getMenuAction();
      e.click = ome.callback || (() => {
        eventBus.post('OverlayMenuClicked', { getEntry: () => ome, getOverlay: () => overlay });
        // ConfigPlugin.onOverlayMenuClicked: RUNELITE_OVERLAY_CONFIG opens the overlay's plugin's config
        if (ome.getMenuAction() === MenuAction.RUNELITE_OVERLAY_CONFIG && overlay.plugin && overlay.plugin.__id) ll.post('rl-open-config', { id: overlay.plugin.__id });
      });
      const n = c[fld('menuCount')] | 0;
      ll.insertMenuEntry(c, Math.max(0, n - 1), e.text(), () => e.click && e.click(e));
    }
  }
  /** The client built its menu: MenuEntryAdded for each entry, bottom to top, as RuneLite posts them while the menu is built */
  function menuBuilt(c) {
    if (!ll.insertMenuEntry || !fld('menuCount')) return;
    for (const fn of menuBuildHooks) { try { fn(c); } catch { /* keep going */ } }
    let i = 0;
    while (i < (c[fld('menuCount')] | 0)) {
      const entry = menuEntryAt(c, i);
      menuAdding = { created: [] };
      eventBus.post('MenuEntryAdded', {
        getMenuEntry: () => entry, getOption: () => entry.getOption(), getTarget: () => entry.getTarget(), getType: () => entry.getType(),
        getIdentifier: () => entry.getIdentifier(), getActionParam0: () => entry.getParam0(), getActionParam1: () => entry.getParam1(),
      });
      const created = menuAdding.created;
      menuAdding = null;
      let at = i + 1;
      for (const e of created) {
        if (e.below) { ll.insertMenuEntry(c, i, e.text(), () => e.click && e.click(e)); at++; } else ll.insertMenuEntry(c, at++, e.text(), () => e.click && e.click(e));
      }
      i = at;
    }
    if (menuResort) { menuResort = false; resortMenu(c); }
    overlayMenu(c);
    for (const fn of menuBuiltHooks) { try { fn(c); } catch { /* keep going */ } }
    // ClientTick: once per client frame while the menu isn't open (where RuneLite's plugins rework the menu)
    eventBus.post('ClientTick', {});
    if (menuResort) { menuResort = false; resortMenu(c); }
    // PostMenuSort: the menu as sorted, for plugins that reorder it through client.getMenu()
    eventBus.post('PostMenuSort', {});
  }
  /** WidgetUtil.componentToInterface: the 2007 client's component ids are (interface << 16) | child */
  const WidgetUtil = { componentToInterface: (id) => id >>> 16, componentToId: (id) => id & 0xffff };

  // ---------------------------------------------------------------- side panels (NavigationButton / PluginPanel)

  /** What a clone's panel shows goes to its sidebar panel (ui/panels/<id>.js) as plugin state; the panel's
   *  clicks come back to the plugin's onPanelAction({ action, ... }). */
  const panels = { update(id, state) { ll.post('plugin-state', { id, state }); } };

  // ---------------------------------------------------------------- the core as a page plugin

  const titleHooks = []; // later core pieces run each login screen frame (Login Screen's preferences)
  const coreConfigureHooks = []; // later core pieces that take data from the app side (World Hopper's worlds, pings)
  ll.registerPlugin('runelite', {
    configure(cfg) {
      for (const fn of coreConfigureHooks) fn(cfg);
      if (cfg.fonts) loadFonts(cfg.fonts);
      if (cfg.assets) for (const [k, url] of Object.entries(cfg.assets)) assets[k] = { url };
      if (cfg.values) {
        for (const [group, vals] of Object.entries(cfg.values)) configValues[group] = Object.assign(configValues[group] || {}, vals);
        for (const o of overlayManager.overlays) overlayManager.load(o);
      }
    },
    frame(g) { frameG = g; for (const f of viewDrawnHooks) { try { f(); } catch { /* keep going */ } } },
    frameUI(g) {
      frameG = g;
      pollEvents();
      cameraLoginCheck();
      managingMode(!!ll.altDown || R.dragging || R.resizing);
      try { eventBus.post('BeforeRender', {}); } catch { /* keep going */ }
      paint();
    },
    chat(msg) {
      eventBus.post('ChatMessage', {
        getType: () => CHAT_TYPES[msg.type] || 'GAMEMESSAGE', getName: () => msg.name || '', getMessage: () => msg.text, getSender: () => msg.channel || null,
        getTimestamp: () => Math.floor(msg.time / 1000), msg,
        setMessage(t) { msg.replace = t; }, drop() { msg.replace = false; },
      });
    },
    menu(c) { menuBuilt(c); },
    mouseDown, mouseMove, mouseUp,
    key(e, down) {
      eventBus.post(down ? 'KeyPressed' : 'KeyReleased', e);
      return keyListeners.size && keyEvent(e, down) ? 'stop' : false;
    },
    blur() { managingMode(false); },
    // the login screen draws no game frames: GameStateChanged (LOGIN_SCREEN) and the login screen's pieces from here
    title() { pollEvents(); for (const fn of titleHooks) { try { fn(); } catch { /* keep going */ } } },
  });

  // ---------------------------------------------------------------- keys and mouse: KeyManager, HotkeyListener, MouseManager

  const KeyCode = { KC_SHIFT: 81, KC_CONTROL: 82, KC_ALT: 86 };
  const MOD_OF = { Control: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Meta: 'Meta' };
  /** Keybind: the config's "Ctrl+F" / "Alt" (the hotkey button's text); a lone modifier matches its own key, down or up */
  const Keybind = {
    matches(bind, e) {
      if (!bind || !e || !e.key) return false;
      const parts = String(bind).split('+'); const key = parts.pop();
      if (!parts.length && Object.values(MOD_OF).includes(key)) return MOD_OF[e.key] === key;
      const k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      return k === key && parts.includes('Ctrl') === !!e.ctrlKey && parts.includes('Shift') === !!e.shiftKey && parts.includes('Alt') === !!e.altKey && parts.includes('Meta') === !!e.metaKey;
    },
    isModifier(bind) { return Object.values(MOD_OF).includes(String(bind)); },
  };
  /** HotkeyListener(keybindSupplier): hotkeyPressed / hotkeyReleased */
  class HotkeyListener {
    constructor(keybind) { this.keybind = keybind; this.isPressed = false; }
    keyPressed(e) {
      const bind = this.keybind();
      if (!Keybind.matches(bind, e)) return;
      const was = this.isPressed; this.isPressed = true;
      if (!was) this.hotkeyPressed();
      if (!Keybind.isModifier(bind)) e.consume();
    }
    keyReleased(e) {
      if (!Keybind.matches(this.keybind(), e) || !this.isPressed) return;
      this.isPressed = false;
      this.hotkeyReleased();
    }
    hotkeyPressed() {}
    hotkeyReleased() {}
  }
  const keyListeners = new Set();
  const keyManager = { registerKeyListener(l) { keyListeners.add(l); }, unregisterKeyListener(l) { keyListeners.delete(l); } };
  /** a DOM key event to the key listeners; true if one consumed it */
  function keyEvent(e, down) {
    let consumed = false;
    e.consume = () => { consumed = true; };
    for (const l of [...keyListeners]) {
      try { if (down) { if (l.keyPressed) l.keyPressed(e); } else if (l.keyReleased) l.keyReleased(e); } catch { /* keep going */ }
    }
    return consumed;
  }
  // ChatboxPanelManager (openTextInput / openTextMenuInput), drawn by the client's chat box prompt (ll.chatPrompt:
  // [title, text]); the keys go to it while it is open
  const PROMPT_BOX = (548 << 16) | 88; // the game frame's chat box prompt, and its second line (the client's LostLite.ts)
  const PROMPT_LINE2 = (548 << 16) | 94;
  const chatboxPanelManager = {
    current: null,
    getCurrentInput() { return this.current; },
    show(lines) {
      ll.chatPrompt = lines;
      const c = c0(); if (c && fld('redrawChat')) c[fld('redrawChat')] = true;
    },
    close() {
      if (!this.current) return;
      const cur = this.current;
      keyManager.unregisterKeyListener(cur.listener);
      if (cur.mouse) mouseManager.unregisterMouseListener(cur.mouse);
      this.current = null;
      this.show(null);
      if (cur.close) cur.close(); // the input's onClose, as RuneLite's ChatboxPanelManager.close
    },
    open(o) {
      this.close();
      this.current = o;
      keyManager.registerKeyListener(o.listener);
      if (o.mouse) mouseManager.registerMouseListener(o.mouse);
      o.draw();
    },
    openTextInput(title) {
      const o = { title, value: '', done: null, close: null, changed: null, getValue: () => o.value };
      const b = {
        value: (v) => { o.value = String(v == null ? '' : v); return b; },
        onChanged: (fn) => { o.changed = fn; return b; },
        onDone: (fn) => { o.done = fn; return b; },
        onClose: (fn) => { o.close = fn; return b; },
        build: () => {
          o.draw = () => chatboxPanelManager.show([o.title, o.value + '*']);
          o.listener = { keyPressed: (e) => {
            e.consume();
            // (onDone answering false keeps the input open, as RuneLite's ChatboxTextInput)
            if (e.key === 'Enter') { const r = o.done ? o.done(o.value) : undefined; if (r !== false && chatboxPanelManager.current === o) chatboxPanelManager.close(); }
            else if (e.key === 'Escape') chatboxPanelManager.close();
            else if (e.key === 'Backspace') { o.value = o.value.slice(0, -1); o.draw(); if (o.changed) o.changed(o.value); }
            else if (e.key && e.key.length === 1 && o.value.length < 80) { o.value += e.key; o.draw(); if (o.changed) o.changed(o.value); }
          }, keyReleased: (e) => e.consume() };
          chatboxPanelManager.open(o);
          return o;
        },
      };
      return b;
    },
    // ChatboxTextMenuInput: the options are picked by their number key or, as RuneLite's option widgets, by clicking
    // them (the one under the mouse is drawn white, as RuneLite's). They're drawn on the prompt's second line (548:94, centred), so a
    // click finds its option by that line's font widths.
    openTextMenuInput(title) {
      const o = { title, options: [], hover: -1 };
      const label = (x, i) => `${i + 1}: ${x.text}`;
      const SEP = '   ';
      const pick = (i) => { chatboxPanelManager.close(); o.options[i].fn(); };
      // the option at a canvas point, or -1
      const optionAt = (p) => {
        const box = ll.api && ll.api.com ? ll.api.com(PROMPT_BOX) : null;
        const line = ll.api && ll.api.com ? ll.api.com(PROMPT_LINE2) : null;
        if (!box || box.hide || !line || !line.screen || !ll.api.comTextWidth) return -1;
        const [lx, ly] = line.screen;
        if (p.y < ly || p.y >= ly + line.height || p.x < lx || p.x >= lx + line.width) return -1;
        const width = (s) => ll.api.comTextWidth(PROMPT_LINE2, s);
        const plain = o.options.map(label).join(SEP);
        const total = width(plain);
        if (total < 0) return -1;
        let x = lx + Math.trunc((line.width - total) / 2);
        for (let i = 0; i < o.options.length; i++) {
          const w = width(label(o.options[i], i));
          const gap = i + 1 < o.options.length ? width(SEP) : 0;
          // (half the gap on each side belongs to the option beside it)
          if (p.x >= x - gap / 2 && p.x < x + w + gap / 2) return i;
          x += w + gap;
        }
        return -1;
      };
      const b = {
        option: (text, fn) => { o.options.push({ text, fn }); return b; },
        build: () => {
          // (@end@: back to the line's own colour, dark blue)
          o.draw = () => chatboxPanelManager.show([o.title, o.options.map((x, i) => (i === o.hover ? `@whi@${label(x, i)}@end@` : label(x, i))).join(SEP)]);
          o.listener = { keyPressed: (e) => {
            e.consume();
            const n = parseInt(e.key, 10);
            if (e.key === 'Escape') chatboxPanelManager.close();
            else if (n >= 1 && n <= o.options.length) pick(n - 1);
          }, keyReleased: (e) => e.consume() };
          o.mouse = {
            mousePressed: (e) => {
              if (e.getButton() !== MouseEventButtons.BUTTON1) return e;
              const i = optionAt(e.getPoint());
              if (i >= 0) { e.consume(); pick(i); }
              return e;
            },
            mouseMoved: (e) => {
              const i = optionAt(e.getPoint());
              if (i !== o.hover) { o.hover = i; o.draw(); }
              return e;
            },
          };
          chatboxPanelManager.open(o);
          return o;
        },
      };
      return b;
    },
  };
  const mouseListeners = new Set();
  const mouseManager = { registerMouseListener(l) { mouseListeners.add(l); }, unregisterMouseListener(l) { mouseListeners.delete(l); } };
  // (DOM button numbers: MouseEvent.BUTTON1 left 0, BUTTON2 middle 1, BUTTON3 right 2)
  const MouseEventButtons = { BUTTON1: 0, BUTTON2: 1, BUTTON3: 2 };
  const SwingUtilities = { isLeftMouseButton: (e) => e.getButton() === 0, isMiddleMouseButton: (e) => e.getButton() === 1, isRightMouseButton: (e) => e.getButton() === 2 };
  /** MouseListener.mousePressed / mouseReleased with the canvas point (game coordinates); a listener can consume the event or
   *  hand back another (withButton) as RuneLite's listeners return a new MouseEvent. -> { consumed, button } */
  function mouseListenerEvent(kind, p, button) {
    let consumed = false;
    const make = (b) => ({ getPoint: () => p, getX: () => p.x, getY: () => p.y, getButton: () => b, withButton: (nb) => make(nb), consume() { consumed = true; }, isConsumed: () => consumed });
    let ev = make(button);
    for (const l of [...mouseListeners]) {
      try { if (l[kind]) { const r = l[kind](ev); if (r && r.getButton) ev = r; } } catch { /* keep going */ }
      if (consumed) break;
    }
    return { consumed, button: ev.getButton() };
  }
  /** WildcardMatcher.matches: '*' for any run of characters, the whole name, ignoring case */
  const WildcardMatcher = {
    matches(pattern, text) {
      const re = new RegExp('^' + String(pattern).split('*').map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
      return re.test(String(text));
    },
  };

  // ---------------------------------------------------------------- the client's camera
  // OSRS's client zooms with the scroll wheel (camera varcs, the scrollWheelZoom callbacks, camera_do_zoom) and turns the
  // camera with the middle button (camera speed, invert, mouse button mask, shake); the 2007 client has none of it, so the core
  // does it here, over the client's camera distance hook (the zoom value 512 is the 2007 view: distance x 512 / zoom).
  const VarClientID = { CAMERA_ZOOM_SMALL_MIN: 'smallMin', CAMERA_ZOOM_SMALL_MAX: 'smallMax', CAMERA_ZOOM_BIG_MIN: 'bigMin', CAMERA_ZOOM_BIG_MAX: 'bigMax', CAMERA_ZOOM_SMALL: 'small', CAMERA_ZOOM_BIG: 'big' };
  const ScriptID = { CAMERA_DO_ZOOM: 42, CAMERA_SET_ZOOM_LIMITS: 3920, BANKMAIN_INIT: 274, BANKMAIN_BUILD: 277, BANKMAIN_SEARCH_TOGGLE: 281, BANKMAIN_FINISHBUILDING: 505 };
  const ZOOM_DEFAULTS = { smallMin: 128, smallMax: 896, bigMin: 128, bigMax: 896 };
  const cam = { varc: Object.assign({ small: 512, big: 512 }, ZOOM_DEFAULTS), speed: 1, invertYaw: false, invertPitch: false, mask: 0, stack: [], drag: null, loggedIn: false };
  try { const z = Number(localStorage.getItem('rl.cameraZoom')); if (z > 0) cam.varc.small = cam.varc.big = z; } catch { /* no storage */ }
  function applyZoom() {
    const v = cam.varc;
    const z = Math.max(Math.max(1, v.smallMin), Math.min(v.smallMax, v.small));
    v.small = v.big = z;
    try { localStorage.setItem('rl.cameraZoom', String(z)); } catch { /* no storage */ }
    if (typeof ll.command === 'function') ll.command({ type: 'zoom', value: 512 / z });
  }
  /** a ScriptCallbackEvent with its int stack; returns the stack after the plugins changed it */
  function scriptCallback(name, stack) {
    cam.stack = stack;
    eventBus.post('ScriptCallbackEvent', { getEventName: () => name });
    return cam.stack;
  }
  Object.assign(client, {
    getVarcIntValue(id) { return cam.varc[id] | 0; },
    setVarcIntValue(id, v) { cam.varc[id] = v | 0; if (id !== VarClientID.CAMERA_ZOOM_SMALL && id !== VarClientID.CAMERA_ZOOM_BIG) applyZoom(); },
    getIntStack() { return cam.stack; },
    getIntStackSize() { return cam.stack.length; },
    runScript(id, ...args) {
      if (id === ScriptID.CAMERA_DO_ZOOM) { cam.varc.small = args[0] | 0; cam.varc.big = args[1] | 0; applyZoom(); }
    },
    setCameraSpeed(f) { cam.speed = f; },
    setInvertYaw(b) { cam.invertYaw = !!b; },
    setInvertPitch(b) { cam.invertPitch = !!b; },
    setCameraMouseButtonMask(m) { cam.mask = m | 0; },
    // (the 2007 client clamps the pitch to 128..383 in its own camera code: no relaxer)
    setCameraPitchRelaxerEnabled() {},
    setCameraShakeDisabled(b) { if (ll.api && ll.api.cameraShakeDisabled) ll.api.cameraShakeDisabled(!!b); },
  });
  /** at log in, OSRS's camera_set_zoom_limits sets the default limits (ScriptPostFired) and the zoom is applied */
  function cameraLoginCheck() {
    const now = !!ll.loggedIn;
    if (now && !cam.loggedIn) {
      Object.assign(cam.varc, ZOOM_DEFAULTS);
      applyZoom();
      eventBus.post('ScriptPostFired', { getScriptId: () => ScriptID.CAMERA_SET_ZOOM_LIMITS });
    }
    cam.loggedIn = now;
  }
  function gameCanvas() { return document.getElementById('canvas'); }
  function inGameView(e) {
    const p = canvasPoint(e);
    if (!p) return null;
    const v = view();
    return p.x >= v.x && p.y >= v.y && p.x < v.x + v.w && p.y < v.y + v.h ? p : null;
  }
  if (window.addEventListener && document.getElementById) {
    window.addEventListener('wheel', (e) => {
      if (e.defaultPrevented) { if (e.ctrlKey) e.preventDefault(); return; }
      if (e.ctrlKey) e.preventDefault(); // (not the browser's page zoom)
      if (!e.deltaY || !ll.loggedIn || !inGameView(e)) return;
      e.preventDefault();
      if (scriptCallback('scrollWheelZoom', [0])[0] === 1) return;
      const inc = scriptCallback('scrollWheelZoomIncrement', [25])[0];
      cam.varc.small += e.deltaY > 0 ? -inc : inc;
      applyZoom();
    }, { passive: false });
    window.addEventListener('pointerdown', (e) => {
      const p = canvasPoint(e);
      if (!p || e.target !== gameCanvas()) return;
      const r = mouseListeners.size ? mouseListenerEvent('mousePressed', p, e.button) : { consumed: false, button: e.button };
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (r.consumed) { stop(); return; }
      // the middle button turns the camera (and any button the mask maps there); a remapped middle click is a right click
      if ((r.button === 1 || (cam.mask & (1 << (r.button + 1)))) && ll.loggedIn && inGameView(e)) { stop(); cam.drag = { x: e.clientX, y: e.clientY, button: e.button }; return; }
      if (r.button !== e.button) {
        stop();
        const init = { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, button: r.button, buttons: 1 << r.button };
        e.target.dispatchEvent(new MouseEvent('mousedown', init));
        e.target.dispatchEvent(new MouseEvent('mouseup', init));
      }
    }, true);
    window.addEventListener('pointermove', (e) => {
      const d = cam.drag;
      if (!d) return;
      if (!e.buttons) { cam.drag = null; return; }
      const cv = gameCanvas(); const r = cv && cv.getBoundingClientRect();
      const k = r && r.width ? r.width / CANVAS_W : 1;
      const dx = (e.clientX - d.x) / k; const dy = (e.clientY - d.y) / k;
      d.x = e.clientX; d.y = e.clientY;
      const yaw = dx * 2 * cam.speed * (cam.invertYaw ? 1 : -1);
      const pitch = dy * cam.speed * (cam.invertPitch ? -1 : 1);
      if ((yaw || pitch) && typeof ll.rotate === 'function') ll.rotate(yaw, pitch);
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    // MouseListener.mouseDragged / mouseMoved (game coordinates; the button held, as Java's for a drag)
    window.addEventListener('pointermove', (e) => {
      if (!mouseListeners.size || cam.drag) return;
      const p = canvasPoint(e);
      if (!p) return;
      mouseListenerEvent(e.buttons ? 'mouseDragged' : 'mouseMoved', p, e.buttons & 1 ? 0 : e.buttons & 4 ? 1 : e.buttons & 2 ? 2 : -1);
    }, true);
    window.addEventListener('pointerup', (e) => {
      const p = canvasPoint(e);
      if (p && mouseListeners.size) mouseListenerEvent('mouseReleased', p, e.button);
      if (cam.drag && e.button === cam.drag.button) { cam.drag = null; e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); }, true);
  }

  // RuneLite's NpcOverlayService (net.runelite.client.game.npcoverlay): NpcOverlayService, NpcOverlay,
  // NpcMinimapOverlay, HighlightedNpc. Our NPC objects are snapshots, so the map is keyed by NPC index and each
  // frame draws the NPC as it is now. "outline" is rl.modelOutlineRenderer (corea.js), as RuneLite's ModelOutlineRenderer.
  const HighlightedNpc = {
    builder() {
      const o = { npc: null, highlightColor: null, fillColor: new Color(0, 0, 0, 50), hull: false, tile: false, trueTile: false, swTile: false, swTrueTile: false,
        outline: false, name: false, nameOnMinimap: false, borderWidth: 2.0, outlineFeather: 0, render: null };
      const b = {};
      for (const k of Object.keys(o)) b[k] = (v) => { o[k] = v; return b; };
      b.build = () => Object.assign({}, o);
      return b;
    },
  };
  function liveNpcs() { const m = new Map(); for (const n of client.getNpcs()) m.set(n.getIndex(), n); return m; }
  function renderNpcPoly(graphics, borderColor, borderWidth, fillColor, polygon) {
    if (polygon != null) {
      graphics.setColor(borderColor); graphics.setStroke(new BasicStroke(borderWidth)); graphics.draw(polygon);
      graphics.setColor(fillColor); graphics.fill(polygon);
    }
  }
  class NpcOverlay extends Overlay {
    constructor(highlightedNpcs) { super(); this.highlightedNpcs = highlightedNpcs; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_SCENE); }
    getName() { return 'NpcOverlay'; }
    render(graphics) {
      // (no cutscenes in 2007)
      const live = liveNpcs();
      for (const [index, h] of this.highlightedNpcs) { const npc = live.get(index); if (npc) this.renderNpcOverlay(graphics, h, npc); }
      return null;
    }
    renderNpcOverlay(graphics, highlightedNpc, actor) {
      const npcComposition = actor.getTransformedComposition();
      if (npcComposition == null || !npcComposition.isInteractible()) return;
      const render = highlightedNpc.render;
      if (render != null && !render(actor)) return;
      const borderColor = highlightedNpc.highlightColor;
      const borderWidth = highlightedNpc.borderWidth;
      const fillColor = highlightedNpc.fillColor;
      if (highlightedNpc.hull) renderNpcPoly(graphics, borderColor, borderWidth, fillColor, actor.getConvexHull());
      if (highlightedNpc.tile) renderNpcPoly(graphics, borderColor, borderWidth, fillColor, actor.getCanvasTilePoly());
      if (highlightedNpc.trueTile) {
        const lp = LocalPoint.fromWorld(client, actor.getWorldLocation()); // centered on sw tile
        if (lp != null) {
          const size = npcComposition.getSize();
          const centerLp = lp.plus(Math.trunc(128 * (size - 1) / 2), Math.trunc(128 * (size - 1) / 2));
          renderNpcPoly(graphics, borderColor, borderWidth, fillColor, Perspective.getCanvasTileAreaPoly(client, centerLp, size));
        }
      }
      if (highlightedNpc.swTile) {
        const size = npcComposition.getSize();
        const lp = actor.getLocalLocation().plus(-Math.trunc((size - 1) * 128 / 2), -Math.trunc((size - 1) * 128 / 2));
        renderNpcPoly(graphics, borderColor, borderWidth, fillColor, Perspective.getCanvasTilePoly(client, lp));
      }
      if (highlightedNpc.swTrueTile) {
        const lp = LocalPoint.fromWorld(client, actor.getWorldLocation());
        if (lp != null) renderNpcPoly(graphics, borderColor, borderWidth, fillColor, Perspective.getCanvasTilePoly(client, lp));
      }
      if (highlightedNpc.outline) {
        rl.modelOutlineRenderer.drawOutline(actor, Math.trunc(highlightedNpc.borderWidth), borderColor, highlightedNpc.outlineFeather);
      }
      if (highlightedNpc.name && actor.getName() != null) {
        const npcName = Text.removeTags(actor.getName());
        const textLocation = actor.getCanvasTextLocation(graphics, npcName, actor.getLogicalHeight() + 40);
        if (textLocation != null) rl.OverlayUtil.renderTextLocation(graphics, textLocation, npcName, borderColor);
      }
    }
  }
  class NpcMinimapOverlay extends Overlay {
    constructor(highlightedNpcs) { super(); this.highlightedNpcs = highlightedNpcs; this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
    getName() { return 'NpcMinimapOverlay'; }
    render(graphics) {
      const live = liveNpcs();
      for (const [index, h] of this.highlightedNpcs) { const npc = live.get(index); if (npc) this.renderNpcOverlay(graphics, h, npc); }
      return null;
    }
    renderNpcOverlay(graphics, highlightedNpc, actor) {
      const npcComposition = actor.getTransformedComposition();
      if (npcComposition == null || !npcComposition.isInteractible()) return;
      const render = highlightedNpc.render;
      if (render != null && !render(actor)) return;
      const minimapLocation = actor.getMinimapLocation();
      if (minimapLocation != null) {
        const color = highlightedNpc.highlightColor;
        rl.OverlayUtil.renderMinimapLocation(graphics, minimapLocation, color);
        if (highlightedNpc.nameOnMinimap && actor.getName() != null) rl.OverlayUtil.renderTextLocation(graphics, minimapLocation, Text.removeTags(actor.getName()), color);
      }
    }
  }
  const npcOverlayService = {
    highlightFunctions: [],
    highlightedNpcs: new Map(), // NPC index -> HighlightedNpc
    subscribePriority: -1,
    init() {
      overlayManager.add(new NpcOverlay(this.highlightedNpcs));
      overlayManager.add(new NpcMinimapOverlay(this.highlightedNpcs));
      eventBus.register(this);
    },
    onGameStateChanged(event) { if (event.getGameState() === GameState.LOGIN_SCREEN) this.highlightedNpcs.clear(); },
    // (priority -1: after the plugins, which capture NPCs on spawn)
    onNpcSpawned(e) { this.apply(e.getNpc()); },
    onNpcDespawned(e) { this.highlightedNpcs.delete(e.getNpc().getIndex()); },
    onNpcChanged(e) { this.highlightedNpcs.delete(e.getNpc().getIndex()); this.apply(e.getNpc()); },
    apply(npc) {
      for (const f of this.highlightFunctions) {
        const h = f(npc);
        if (h != null) { this.highlightedNpcs.set(npc.getIndex(), h); return true; }
      }
      return false;
    },
    rebuild() { this.highlightedNpcs.clear(); for (const npc of client.getTopLevelWorldView().npcs()) this.apply(npc); },
    registerHighlighter(p) { this.highlightFunctions.push(p); this.rebuild(); },
    unregisterHighlighter(p) { const i = this.highlightFunctions.indexOf(p); if (i >= 0) this.highlightFunctions.splice(i, 1); this.rebuild(); },
  };
  const npcUtil = { isDying: (npc) => lootManager.isDying(npc) };

  // ---------------------------------------------------------------- exports

  // 2007RS: the one switch for prices and values (RuneLite config "showPrices", off and hidden until the game has a market)
  const prices = { enabled: () => configManager.getConfiguration('runelite', 'showPrices') === true };

  // XpTrackerService (XpTrackerServiceImpl: the XP Tracker clone's snapshots); without it, no XP goals in 2007, so a skill's
  // end goal is its next level, as XpStateSingle.updateGoals
  const xpSnap = (skill) => { const p = plugins.get('xptracker'); return p && p.plugin.getSkillSnapshot ? p.plugin.getSkillSnapshot(skill) : null; };
  const xpTrackerService = {
    getActions(skill) { const s = xpSnap(skill); return s ? s.actionsInSession | 0 : 0; },
    getActionsHr(skill) { const s = xpSnap(skill); return s ? s.actionsPerHour | 0 : 0; },
    getXpHr(skill) { const s = xpSnap(skill); return s ? s.xpPerHour | 0 : 0; },
    getActionsLeft(skill) { const s = xpSnap(skill); return s && s.actionsRemainingToGoal != null ? s.actionsRemainingToGoal | 0 : 2147483647; },
    getTimeTilGoal(skill) { const s = xpSnap(skill); return s && s.timeTillGoalShort != null ? s.timeTillGoalShort : '\u221e'; },
    getStartGoalXp(skill) { const s = xpSnap(skill); return s && s.startGoalXp ? s.startGoalXp : Experience.getXpForLevel(Experience.getLevelForXp(client.getSkillExperience(skill))); },
    getEndGoalXp(skill) {
      const s = xpSnap(skill); if (s && s.endGoalXp) return s.endGoalXp;
      const lvl = Experience.getLevelForXp(client.getSkillExperience(skill));
      return lvl + 1 <= Experience.MAX_VIRT_LEVEL ? Experience.getXpForLevel(lvl + 1) : Experience.MAX_SKILL_XP;
    },
  };
  const rl = {
    xpTrackerService,
    prices, client, eventBus, viewDrawnHooks, keyManager, mouseManager, VarClientID, ScriptID, MouseEventButtons, HotkeyListener, Keybind, KeyCode, SwingUtilities, WildcardMatcher, overlayManager, infoBoxManager, tooltipManager, configManager, notifier, pluginManager,
    itemManager, lootManager, chatboxPanelManager, TileObject, WallObject, DecorativeObject, GameObject, GroundObject, npcOverlayService, npcUtil, HighlightedNpc, InventoryID, InterfaceID, ItemStack, TileItem, Tile, WorldArea, spriteManager, SkillIconManager, configProxy, rlConfig, panels,
    Experience, QuantityFormatter, SkillColor, MenuAction, WidgetUtil,
    Color, Point, Dimension, Rectangle, Polygon, BasicStroke, Font, FontManager, FontType, FontMetrics, Graphics2D, Text, ColorUtil,
    ComponentConstants, ComponentOrientation, BackgroundComponent, TextComponent, TitleComponent, LineComponent, ProgressBarComponent, ProgressPieComponent,
    ImageComponent, SplitComponent, PanelComponent, InfoBoxComponent, TooltipComponent, Tooltip,
    Skill, WorldPoint, LocalPoint, Perspective, GameState, Actor, NPC, Player, FriendsChatRank,
    Overlay, OverlayMenuEntry, LoopTimer, WidgetItem, WidgetItemOverlay, OverlayPanel, OverlayPosition, OverlayLayer, OverlayPriority, InfoBox, Counter, Timer,
    OverlayUtil: {
      renderPolygon(g, poly, color, fill = new Color(0, 0, 0, 50), stroke = new BasicStroke(2)) {
        if (!poly) return;
        g.setColor(color); g.setStroke(stroke); g.draw(poly);
        g.setColor(fill); g.fill(poly);
      },
      renderTextLocation(g, p, text, color) {
        if (!p || !text) return;
        const tc = new TextComponent(); tc.setText(text); tc.setColor(color); tc.setPosition(p.x, p.y); tc.render(g);
      },
      renderMinimapLocation(g, mini, color) {
        g.setColor(Color.BLACK);
        g.fillOval(mini.getX() - 2, mini.getY() - 2 + 1, 4, 4);
        g.setColor(ColorUtil.colorWithAlpha(color, 0xff));
        g.fillOval(mini.getX() - 2, mini.getY() - 2, 4, 4);
      },
      renderActorOverlay(g, actor, text, color) {
        const poly = actor.getCanvasTilePoly();
        if (poly) rl.OverlayUtil.renderPolygon(g, poly, color);
        const tp = actor.getCanvasTextLocation(g, text, actor.getLogicalHeight() + 40);
        if (tp) rl.OverlayUtil.renderTextLocation(g, tp, text, color);
      },
    },
    /** A clone registers here: register(id, plugin) where plugin has configGroup, startUp, shutDown and @Subscribe-style onX methods. */
    registerPlugin(id, plugin) {
      pluginManager.register(id, plugin);
      plugin.__id = id;
      plugin.resources = plugin.resources || {};
      ll.registerPlugin(id, {
        configure(config) {
          const c = Object.assign({}, config || {});
          if (c.__items) { plugin.configItems = c.__items; delete c.__items; }
          if (c.__resources) {
            for (const [k, url] of Object.entries(c.__resources)) plugin.resources[k] = imageFromUrl(url);
            delete c.__resources;
          }
          pluginManager.setEnabled(id, true, c);
        },
        stop() { pluginManager.setEnabled(id, false); },
        panel(data) {
          const p = plugins.get(id);
          if (!p || !p.enabled || typeof plugin.onPanelAction !== 'function' || !data || typeof data.action !== 'string') return;
          try { plugin.onPanelAction(data); } catch (e) { ll.post('runtime-error', `${id} panel ${data.action}: ${e && e.message}`); }
        },
      });
    },
    uiScale: () => uiS,
    _test: { R, renderOverlays, SNAP, snapRect, mouseDown, mouseMove, mouseUp, managingMode, pollEvents, setFrame: (g) => { frameG = g; }, getFrame: () => frameG, paint },
  };
  // ---------------------------------------------------------------- Clue Scroll's core pieces: hint arrows, widgets,
  // the world map's points, OverlayUtil's image helpers, WorldPoint.isInScene / hashCode
  {
    // Client.setHintArrow / clearHintArrow / getHintArrowNpc / getHintArrowPoint (the app's own arrow slot)
    let hintNpc = null; let hintPoint = null;
    Object.assign(client, {
      setHintArrow(t) {
        if (t instanceof WorldPoint) { hintPoint = t; hintNpc = null; if (ll.setHint) ll.setHint(c0(), { x: t.x, z: t.y, height: 0 }); }
        else if (t && typeof t.getIndex === 'function') { hintNpc = t; hintPoint = null; if (ll.setHint) ll.setHint(c0(), { npc: t.getIndex() }); }
      },
      clearHintArrow() { hintNpc = null; hintPoint = null; if (ll.setHint) ll.setHint(c0(), null); },
      hasHintArrow() { return !!(hintNpc || hintPoint); },
      getHintArrowNpc() { return hintNpc; },
      // (or the server's tile arrow, e.g. the Agility Arena's ticket pillar)
      getHintArrowPoint() {
        if (hintPoint) return hintPoint;
        const c = c0(); const t = c && fld('hintType') ? c[fld('hintType')] : 0;
        return t >= 2 && t <= 6 ? new WorldPoint(c[fld('hintTileX')], c[fld('hintTileZ')], client.getPlane()) : null;
      },
      /** the camera follows the local player in 2007 (no free camera / orbs): getCameraFocus is its local point */
      getCameraFocusEntity() { const p = client.getLocalPlayer(); if (p) p.getCameraFocus = () => p.getLocalLocation(); return p; },
      /** client.getWidget(groupId, childId) or (packed id): read-only (text, shown, size, screen position); null if it isn't there */
      getWidget(group, child) {
        const packed = child === undefined ? group : ((group << 16) | child);
        const info = () => (ll.api && ll.api.com ? ll.api.com(packed) : null);
        if (!info()) return null;
        return {
          getId: () => packed,
          getText: () => { const i = info() || {}; return (i.shown != null ? i.shown : i.text) || ''; },
          isHidden: () => !(ll.api && ll.api.comVisible && ll.api.comVisible(packed)) || !!(ll.api && ll.api.ifOpen && !ll.api.ifOpen(packed >>> 16)),
          getWidth: () => (info() || {}).width | 0,
          getHeight: () => (info() || {}).height | 0,
          getCanvasLocation: () => { const i = info(); return i ? (i.screen ? new Point(i.screen[0] | 0, i.screen[1] | 0) : new Point(i.x | 0, i.y | 0)) : null; },
          getActions: () => (info() || {}).ops || null,
          getModelId: () => { const i = info(); return i && i.modelId != null ? i.modelId | 0 : -1; },
          getModelType: () => { const i = info(); return i && i.modelType != null ? i.modelType | 0 : 0; },
          getBounds: () => { const i = info(); return i ? new Rectangle((i.screen ? i.screen[0] : i.x) | 0, (i.screen ? i.screen[1] : i.y) | 0, i.width | 0, i.height | 0) : new Rectangle(); },
          getTextColor: () => (info() || {}).colour | 0,
          getOriginalX: () => (info() || {}).ox | 0,
          getOriginalY: () => (info() || {}).oy | 0,
          // the components laid out in this layer, in order (if1: each child names its layer)
          getStaticChildren: () => (ll.api && ll.api.comsOf ? ll.api.comsOf(packed >>> 16) : [])
            .filter((i) => i && i.layer === packed).map((i) => client.getWidget(i.id)),
          // FontTypeFace.getTextWidth with the component's font (tags not counted); a 6 px per character guess until it's loaded
          getFont: () => ({ getTextWidth: (s) => { const w = ll.api && ll.api.comTextWidth ? ll.api.comTextWidth(packed, String(s)) : -1; return w >= 0 ? w : Text.removeTags(String(s)).length * 6; } }),
          // display-only writes, client-side like RuneLite's (the server's own updates overwrite them; nothing is sent)
          setText(t) { if (ll.api && ll.api.setText) ll.api.setText(packed, t == null ? '' : String(t)); return this; },
          setHidden(h) { if (ll.api && ll.api.setHidden) ll.api.setHidden(packed, !!h); return this; },
          setTextColor(rgb) { if (ll.api && ll.api.setColour) ll.api.setColour(packed, rgb | 0); return this; },
          setOriginalX(x) { this._x = x; return this; },
          setOriginalY(y) { this._y = y; return this; },
          setOriginalWidth(w) { this._w = w; return this; },
          setOriginalHeight(h) { this._h = h; return this; },
          revalidate() {
            if ((this._w !== undefined || this._h !== undefined) && ll.api && ll.api.setSize) { const i = info() || {}; ll.api.setSize(packed, this._w !== undefined ? this._w : i.width | 0, this._h !== undefined ? this._h : i.height | 0); } if (this._x !== undefined || this._y !== undefined) { const i = info() || {}; if (ll.api && ll.api.setPosition) ll.api.setPosition(packed, this._x !== undefined ? this._x : i.ox | 0, this._y !== undefined ? this._y : i.oy | 0); } return this; },
        };
      },
      // RuneLite's getVarbitValue([varps,] id): the 2007 cache's varbit definitions (0 for an id it doesn't have)
      getVarbitValue(a, b) {
        if (b === undefined) return ll.api && ll.api.varbit ? ll.api.varbit(a) | 0 : 0;
        for (const [vp, list] of varbitsByVarp()) for (const [id, lsb, msb] of list) if (id === b) return varbitOf(a[vp] | 0, lsb, msb);
        return 0;
      },
      getVarps() { const cc = c0(); const v = cc && cc[fld('varps')]; return v ? Int32Array.from(v) : new Int32Array(0); },
      getServerVarps() { return this.getVarps(); },
      getServerVarpValue(id) { return this.getVarpValue(id); },
      getServerVarbitValue(id) { return this.getVarbitValue(id); },
    });
    WorldPoint.prototype.isInScene = function isInScene(c) {
      const sx = this.x - c.getBaseX(); const sy = this.y - c.getBaseY();
      return sx >= 0 && sy >= 0 && sx < 104 && sy < 104; // (Lombok's @Value hashCode below)
    };
    WorldPoint.prototype.hashCode = function hashCode() { let r = 1; r = (Math.imul(r, 59) + this.x) | 0; r = (Math.imul(r, 59) + this.y) | 0; return (Math.imul(r, 59) + this.plane) | 0; };
    // Actor.getCanvasImageLocation; client.getCameraX / getCameraY: the 2007 client's CamFollow from the camera's yaw, pitch and the
    // local player (its distance pitch * 3 + 600, without the app's zoom)
    Actor.prototype.getCanvasImageLocation = function getCanvasImageLocation(image, zOffset) { return Perspective.getCanvasImageLocation(client, this.getLocalLocation(), image, zOffset); };
    const camPos = () => {
      const cc = c0(); const me = client.getLocalPlayer();
      if (!cc || !me) return [0, 0];
      const yaw = cc[fld('cameraYaw')] | 0; const pitch = cc[fld('cameraPitch')] | 0;
      const rad = (a) => (a * Math.PI * 2) / 2048;
      const lp = me.getLocalLocation();
      let d = (Math.cos(rad((2048 - pitch) & 0x7ff)) * (pitch * 3 + 600));
      const dx = d * Math.sin(rad((2048 - yaw) & 0x7ff)); d *= Math.cos(rad((2048 - yaw) & 0x7ff));
      return [Math.trunc(lp.x - dx), Math.trunc(lp.y - d)];
    };
    Object.assign(client, { getCameraX: () => camPos()[0], getCameraY: () => camPos()[1] });
    // OverlayUtil / Perspective image helpers
    Perspective.getCanvasImageLocation = (c, lp, image, zOffset) => {
      const p = Perspective.localToCanvas(c, lp, c.getPlane(), zOffset);
      return p ? new Point(p.x - Math.trunc(imgW(image) / 2), p.y - Math.trunc(imgH(image) / 2)) : null;
    };
    Object.assign(rl.OverlayUtil, {
      renderImageLocation(a, b, c, d, e) {
        if (b instanceof Point) { if (a && b && c) a.drawImage(c, b.x, b.y); return; } // (graphics, point, image)
        const p = Perspective.getCanvasImageLocation(a, c, d, e | 0); // (client, graphics, localPoint, image, zOffset)
        if (p && d) b.drawImage(d, p.x, p.y);
      },
      renderTileOverlay(c, g, lp, image, color) {
        const poly = Perspective.getCanvasTilePoly(c, lp);
        if (poly) rl.OverlayUtil.renderPolygon(g, poly, color);
        rl.OverlayUtil.renderImageLocation(c, g, lp, image, 0);
      },
      renderActorOverlayImage(g, actor, image, color, zOffset) {
        const poly = actor.getCanvasTilePoly();
        if (poly) rl.OverlayUtil.renderPolygon(g, poly, color);
        const p = Perspective.getCanvasImageLocation(client, actor.getLocalLocation(), image, zOffset);
        if (p && image) g.drawImage(image, p.x, p.y);
      },
      renderHoverableArea(g, area, mouse, fill, border, borderHover) {
        if (!area) return;
        g.setColor(mouse && area.contains(mouse.getX(), mouse.getY()) ? borderHover : border);
        g.draw(area);
        g.setColor(fill);
        g.fill(area);
      },
    });
    // WorldMapPoint / WorldMapPointManager / WorldMapOverlay (RuneLite core, ui/overlay/worldmap): the overlay draws
    // the points over the game's world map (ui/worldmap.js calls renderOnMap from its paint, in its canvas's pixels,
    // and onMapClick for a click without a drag). OSRS's "Focus on" menu entry on a jump-on-click point: the 2007 map
    // has no menus, so a click on the point focuses the map.
    class WorldMapPoint {
      constructor(worldPoint, image) {
        if (worldPoint && worldPoint.__builder) { Object.assign(this, { image: null, worldPoint: null, target: null, imagePoint: null, snapToEdge: false, currentlyEdgeSnapped: false, jumpOnClick: false, name: null, tooltip: null }, worldPoint.fields); return; }
        this.image = image; this.worldPoint = worldPoint; this.target = null; this.imagePoint = null;
        this.snapToEdge = false; this.currentlyEdgeSnapped = false; this.jumpOnClick = false; this.name = null; this.tooltip = null;
      }
      getImage() { return this.image; } setImage(i) { this.image = i; }
      getWorldPoint() { return this.worldPoint; } setWorldPoint(wp) { this.worldPoint = wp; }
      getTarget() { return this.target; } setTarget(t) { this.target = t; }
      getImagePoint() { return this.imagePoint; } setImagePoint(p) { this.imagePoint = p; }
      isSnapToEdge() { return this.snapToEdge; } setSnapToEdge(b) { this.snapToEdge = !!b; }
      isCurrentlyEdgeSnapped() { return this.currentlyEdgeSnapped; } setCurrentlyEdgeSnapped(b) { this.currentlyEdgeSnapped = !!b; }
      isJumpOnClick() { return this.jumpOnClick; } setJumpOnClick(b) { this.jumpOnClick = !!b; }
      getName() { return this.name; } setName(n) { this.name = n; }
      getTooltip() { return this.tooltip; } setTooltip(t) { this.tooltip = t; }
      onEdgeSnap() {}
      onEdgeUnsnap() {}
      /** @SuperBuilder: Sub.builder().worldPoint(wp).image(img).tooltip(t).build() */
      static builder() {
        const Cls = this; const fields = {};
        const b = new Proxy({}, { get: (_t, k) => (k === 'build' ? () => new Cls({ __builder: true, fields }) : (v) => { fields[k] = v; return b; }) });
        return b;
      }
    }
    const worldMapPointManager = {
      worldMapPoints: [],
      add(p) { this.worldMapPoints.push(p); redrawMap(); },
      remove(p) { this.removeIf((q) => q === p); },
      removeIf(fn) { const n = this.worldMapPoints.length; this.worldMapPoints = this.worldMapPoints.filter((p) => !fn(p)); if (n !== this.worldMapPoints.length) redrawMap(); },
      getWorldMapPoints() { return this.worldMapPoints.slice(); },
    };
    // the game's world map (ui/worldmap.js) runs in the app's isolated world: its view comes on its canvas's data-view,
    // with 'll-map-paint' / 'll-map-click' events; focus and redraws go back as events
    const hasDoc = typeof document !== 'undefined' && !!document.querySelector;
    const mapCanvas = () => (hasDoc ? document.querySelector('.ll-map canvas') : null);
    const mapState = (c = mapCanvas()) => { try { return c && c.dataset && c.dataset.view ? JSON.parse(c.dataset.view) : null; } catch { return null; } };
    const mapBridge = {
      isOpen: () => { const v = mapState(); return !!(v && v.open); },
      isLoaded: () => { const v = mapState(); return !!(v && v.open && v.bounds); },
      zoom: () => { const v = mapState(); return v ? v.s : 1; },
      position: () => { const v = mapState(); return v ? { x: Math.floor(v.cx), y: Math.floor(v.cz) } : null; },
      setPositionTarget: (x, y) => { const c = mapCanvas(); if (!c) return; c.dataset.target = `${x},${y}`; c.dispatchEvent(new Event('ll-map-focus')); },
      surfaceContains: (x, y) => { const v = mapState(); return !!(v && v.bounds) && y < v.surfaceZ && x >= v.bounds.x0 && x < v.bounds.x1 && y >= v.bounds.z0 && y < v.bounds.z1; },
    };
    function redrawMap() { if (hasDoc && document.dispatchEvent && typeof Event !== 'undefined') document.dispatchEvent(new Event('ll-map-redraw')); }
    if (hasDoc && document.addEventListener) {
      document.addEventListener('ll-map-paint', (e) => {
        const c = e.target; const v = mapState(c);
        if (!v || !c.getContext) return;
        const g = c.getContext('2d');
        g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
        try {
          worldMapOverlay.renderOnMap(g, { width: v.w, height: v.h, mouse: v.mouse,
            toScreen: (x, y) => ({ x: (x + 0.5 - v.cx) * v.s + v.w / 2, y: (v.cz - (y + 0.5)) * v.s + v.h / 2 }), surfaceContains: mapBridge.surfaceContains });
        } catch (err) { ll.post('runtime-error', `world map overlay: ${err && err.message}`); }
      }, true);
      document.addEventListener('ll-map-click', () => worldMapOverlay.onMapClick(), true);
    }
    const imgW = (i) => (i.getWidth ? i.getWidth() : i.w || i.naturalWidth || i.width || 0);
    const imgH = (i) => (i.getHeight ? i.getHeight() : i.h || i.naturalHeight || i.height || 0);
    const grow = (r, h, v) => { r.x -= h; r.y -= v; r.width += 2 * h; r.height += 2 * v; return r; };
    const TOOLTIP_OFFSET_HEIGHT = 25, TOOLTIP_OFFSET_WIDTH = 5, TOOLTIP_PADDING_HEIGHT = 1, TOOLTIP_PADDING_WIDTH = 2, TOOLTIP_TEXT_OFFSET_HEIGHT = -2;
    const worldMapOverlay = {
      hoveredPoint: null,
      map: null,
      /** WorldMapOverlay.render, on the world map's canvas: map = { width, height, mouse, toScreen(x, y), surfaceContains(x, y) } */
      renderOnMap(ctx2d, map) {
        this.map = map;
        const points = worldMapPointManager.getWorldMapPoints();
        this.hoveredPoint = null;
        if (points.length === 0) return null;
        const graphics = new Graphics2D(ctx2d);
        const worldMapRectangle = new Rectangle(0, 0, map.width, map.height);
        const mousePos = map.mouse && worldMapRectangle.contains(map.mouse.x, map.mouse.y) ? new Point(Math.round(map.mouse.x), Math.round(map.mouse.y)) : null;
        let tooltipPoint = null;
        for (const worldPoint of points) {
          const image = worldPoint.getImage();
          const point = worldPoint.getWorldPoint();
          if (!image || !point) continue;
          let drawPoint = this.mapWorldPointToGraphicsPoint(point);
          if (!drawPoint) continue;
          const iw = imgW(image), ih = imgH(image);
          if (worldPoint.isSnapToEdge()) {
            // Get a smaller rect for edge-snapped icons so they display correctly at the edge
            const snappedRect = grow(new Rectangle(worldMapRectangle), -Math.trunc(iw / 2), -Math.trunc(ih / 2));
            const unsnappedRect = new Rectangle(snappedRect);
            if (worldPoint.getImagePoint()) unsnappedRect.translate(worldPoint.getImagePoint().getX() - Math.trunc(iw / 2), worldPoint.getImagePoint().getY() - Math.trunc(ih / 2));
            // Make the unsnap rect slightly smaller so a smaller snapped image doesn't cause a freak out
            if (worldPoint.isCurrentlyEdgeSnapped()) grow(unsnappedRect, -iw, -ih);
            if (unsnappedRect.contains(drawPoint.getX(), drawPoint.getY())) {
              if (worldPoint.isCurrentlyEdgeSnapped()) { worldPoint.setCurrentlyEdgeSnapped(false); worldPoint.onEdgeUnsnap(); }
            } else {
              drawPoint = clipToRectangle(drawPoint, snappedRect);
              if (!worldPoint.isCurrentlyEdgeSnapped()) { worldPoint.setCurrentlyEdgeSnapped(true); worldPoint.onEdgeSnap(); }
            }
          }
          const img = worldPoint.getImage(); // onEdgeSnap / onEdgeUnsnap may change it
          if (!img) continue;
          let drawX = drawPoint.getX(), drawY = drawPoint.getY();
          if (!worldPoint.getImagePoint()) { drawX -= Math.trunc(imgW(img) / 2); drawY -= Math.trunc(imgH(img) / 2); }
          else { drawX -= worldPoint.getImagePoint().getX(); drawY -= worldPoint.getImagePoint().getY(); }
          graphics.setClip(worldMapRectangle);
          graphics.drawImage(img, drawX, drawY);
          const clickbox = new Rectangle(drawX, drawY, imgW(img), imgH(img));
          if (mousePos && clickbox.contains(mousePos.getX(), mousePos.getY())) {
            if (worldPoint.getTooltip()) tooltipPoint = worldPoint;
            if (worldPoint.isJumpOnClick()) this.hoveredPoint = worldPoint;
          }
        }
        if (tooltipPoint) this.drawTooltip(graphics, tooltipPoint);
        return null;
      },
      /** Focus on: the hovered jump-on-click point's target (or the point itself) */
      onMapClick() {
        const worldPoint = this.hoveredPoint;
        if (!worldPoint) return false;
        client.getWorldMap().setWorldMapPositionTarget(worldPoint.getTarget() || worldPoint.getWorldPoint());
        return true;
      },
      /** the centre of a world point's tile on the map (null off the surface) */
      mapWorldPointToGraphicsPoint(worldPoint) {
        const map = this.map;
        if (!map || !map.surfaceContains(worldPoint.getX(), worldPoint.getY())) return null;
        const p = map.toScreen(worldPoint.getX(), worldPoint.getY());
        return new Point(Math.round(p.x), Math.round(p.y));
      },
      drawTooltip(graphics, worldPoint) {
        const tooltip = worldPoint.getTooltip();
        let drawPoint = this.mapWorldPointToGraphicsPoint(worldPoint.getWorldPoint());
        if (!tooltip || !drawPoint) return;
        const rows = tooltip.split('<br>').map((r) => r.trim()).filter(Boolean);
        if (!rows.length) return;
        drawPoint = new Point(drawPoint.getX() + TOOLTIP_OFFSET_WIDTH, drawPoint.getY() + TOOLTIP_OFFSET_HEIGHT);
        graphics.setClip(new Rectangle(0, 0, this.map.width, this.map.height));
        graphics.setColor(new Color(255, 255, 160)); // JagexColors.TOOLTIP_BACKGROUND
        graphics.setFont(FontManager.getRunescapeFont());
        const fm = graphics.getFontMetrics();
        const width = Math.max(...rows.map((r) => fm.stringWidth(r)));
        const height = fm.getHeight();
        const r = new Rectangle(drawPoint.getX() - TOOLTIP_PADDING_WIDTH, drawPoint.getY() - TOOLTIP_PADDING_HEIGHT, width + TOOLTIP_PADDING_WIDTH * 2, height * rows.length + TOOLTIP_PADDING_HEIGHT * 2);
        graphics.fillRect(r.x, r.y, r.width, r.height);
        graphics.setColor(Color.BLACK); // TOOLTIP_BORDER
        graphics.drawRect(r.x, r.y, r.width, r.height);
        graphics.setColor(Color.BLACK); // TOOLTIP_TEXT
        rows.forEach((row, i) => graphics.drawString(row, drawPoint.getX(), drawPoint.getY() + TOOLTIP_TEXT_OFFSET_HEIGHT + (i + 1) * height));
      },
    };
    function clipToRectangle(drawPoint, r) {
      let clippedX = drawPoint.getX();
      if (drawPoint.getX() < r.x) clippedX = r.x;
      if (drawPoint.getX() > r.x + r.width) clippedX = r.x + r.width;
      let clippedY = drawPoint.getY();
      if (drawPoint.getY() < r.y) clippedY = r.y;
      if (drawPoint.getY() > r.y + r.height) clippedY = r.y + r.height;
      return new Point(clippedX, clippedY);
    }
    Object.assign(rl, { WorldMapPoint, worldMapPointManager, worldMapOverlay });
    // Client.getWorldMap(): the game's world map (ui/worldmap.js) — zoom in pixels per tile, the view's centre
    const wm = () => (typeof window !== 'undefined' && window.__lostliteWorldMap) || mapBridge; // (a test can stand in for the map)
    const worldMap = {
      getWorldMapZoom: () => (wm() ? wm().zoom() : 1),
      getWorldMapPosition: () => { const p = wm() && wm().position(); return p ? new WorldPoint(p.x, p.y, 0) : null; },
      setWorldMapPositionTarget: (wp) => { if (wm() && wp) wm().setPositionTarget(wp.getX(), wp.getY()); },
      getWorldMapData: () => ({ surfaceContainsPosition: (x, y) => !!wm() && wm().surfaceContains(x, y) }),
      getWorldMapRenderer: () => ({ isLoaded: () => !!wm() && wm().isLoaded() }),
      isOpen: () => !!wm() && wm().isOpen(),
    };
    client.getWorldMap = () => worldMap;
    FontManager.getDefaultFont = FontManager.getDefaultFont || (() => FontManager.runescape);
    Text.sanitizeMultilineText = Text.sanitizeMultilineText || ((s) => Text.removeTags(String(s == null ? '' : s).replace(/-<br>/g, '-').replace(/<br>/g, ' ').replace(/ +/g, ' ')));
    // Text.sanitize: a player name without its icon tag and with plain spaces
    Text.sanitize = Text.sanitize || ((name) => { const s = String(name == null ? "" : name); return (s.includes("<img") ? s.substring(s.lastIndexOf(">") + 1) : s).replace(/\u00A0/g, " "); });
  }
  // ---------------------------------------------------------------- Time Tracking's core pieces: the component table
  // (open sub-interfaces with their modal mode), WidgetModalMode, ConfigManager.getRSProfiles
  {
    rl.WidgetModalMode = { MODAL_NOCLICKTHROUGH: 0, NON_MODAL: 1, MODAL_CLICKTHROUGH: 3 };
    client.getComponentTable = () => {
      const t = ll.api && ll.api.componentTable ? ll.api.componentTable() : [];
      const out = [];
      for (let i = 0; i + 1 < t.length; i += 2) {
        const id = t[i]; const mode = t[i + 1];
        out.push({ getId: () => id, getModalMode: () => mode });
      }
      return out;
    };
    // RuneScapeProfile: every profile with RS-profile config in any group (our one world: type STANDARD); the display
    // name is the player's name for profiles seen logged in this session, else the key
    const displayNames = {};
    const keyFn = configManager.getRSProfileKey.bind(configManager);
    configManager.getRSProfileKey = () => {
      const k = keyFn();
      const me = client.getGameState() === GameState.LOGGED_IN ? client.getLocalPlayer() : null;
      if (k && me && me.getName()) displayNames[k] = String(me.getName());
      return k;
    };
    configManager.getRSProfiles = () => {
      const keys = new Set();
      for (const g of Object.values(configValues)) {
        for (const [k, v] of Object.entries(g)) {
          const m = v !== undefined && /^rsprofile\.([^.]+)\./.exec(k);
          if (m) keys.add(m[1]);
        }
      }
      const cur = configManager.getRSProfileKey();
      if (cur) keys.add(cur);
      return [...keys].map((k) => ({ getKey: () => k, getDisplayName: () => displayNames[k] || k.replace(/_/g, ' '), getType: () => 'STANDARD' }));
    };
  }
  // ---------------------------------------------------------------- World Hopper's core pieces: WorldService (our
  // server's own world list from the app, worlds.js), World / WorldResult / WorldType / WorldRegion, Ping, hopping,
  // CommandExecuted, the friends list, getTotalLevel
  {
    // net.runelite.http.api.worlds.WorldType (the 2007 world list has members / free only)
    const WorldType = {};
    for (const n of ['PVP', 'MEMBERS', 'HIGH_RISK', 'BOUNTY', 'SKILL_TOTAL', 'LAST_MAN_STANDING', 'DEADMAN', 'SEASONAL', 'TOURNAMENT',
      'NOSAVE_MODE', 'BETA_WORLD', 'LEGACY_ONLY', 'PVP_ARENA', 'QUEST_SPEEDRUNNING', 'FRESH_START_WORLD', 'HARDCORE_MAIN']) WorldType[n] = n;
    // net.runelite.http.api.worlds.WorldRegion
    const WorldRegion = { UNITED_STATES_OF_AMERICA: 'UNITED_STATES_OF_AMERICA', UNITED_KINGDOM: 'UNITED_KINGDOM', AUSTRALIA: 'AUSTRALIA', GERMANY: 'GERMANY',
      BRAZIL: 'BRAZIL', JAPAN: 'JAPAN', SINGAPORE: 'SINGAPORE', SOUTH_AFRICA: 'SOUTH_AFRICA' };
    class World {
      constructor(w) {
        this.id = w.id | 0; this.types = new Set(w.types || []); this.address = w.address || ''; this.activity = w.activity || '-';
        this.location = w.location == null ? -1 : w.location; this.region = w.region || null;
        this.players = w.players == null ? null : w.players | 0; // null: our server publishes no count
      }
      getId() { return this.id; }
      getTypes() { return new Set(this.types); }
      getAddress() { return this.address; }
      getActivity() { return this.activity; }
      getLocation() { return this.location; }
      getRegion() { return this.region; }
      getPlayers() { return this.players; }
    }
    class WorldResult {
      constructor(worlds) { this.worlds = worlds; }
      getWorlds() { return this.worlds; }
      findWorld(id) { return this.worlds.find((w) => w.getId() === id) || null; }
    }
    let worldResult = null;
    const worldService = {
      getWorlds: () => worldResult,
      refresh() { ll.post('rl-worlds-refresh', null); },
    };
    // Ping.ping(world): the app's TCP connect time to the server (ms), or -1; async here (RuneLite blocks its executor)
    let pingSeq = 0;
    const pending = new Map();
    const Ping = {
      ping(world) {
        const seq = ++pingSeq;
        return new Promise((resolve) => {
          pending.set(seq, resolve);
          ll.post('rl-ping', { id: world.getId(), seq });
          setTimeout(() => { if (pending.delete(seq)) resolve(-1); }, 5000);
        });
      },
    };
    coreConfigureHooks.push((cfg) => {
      if (cfg.worlds) {
        worldResult = new WorldResult(cfg.worlds.map((w) => new World(w)));
        eventBus.post('WorldsFetch', { getWorldResult: () => worldResult });
      }
      if (cfg.pong) { const r = pending.get(cfg.pong.seq); if (r) { pending.delete(cfg.pong.seq); r(cfg.pong.ms | 0); } }
    });
    // Client.createWorld / changeWorld / hopToWorld / openWorldHopper: the 2007 client has no world switcher; a
    // hop is the app opening the game on that world (it asks first while logged in)
    Object.assign(client, {
      createWorld() {
        const w = { id: 0, activity: '', address: '', playerCount: 0, location: 0, types: new Set() };
        for (const k of ['Id', 'Activity', 'Address', 'PlayerCount', 'Location', 'Types']) {
          const f = k[0].toLowerCase() + k.slice(1);
          w[`set${k}`] = (v) => { w[f] = v; };
          w[`get${k}`] = () => w[f];
        }
        return w;
      },
      changeWorld(world) { ll.post('rl-world-hop', world.getId()); },
      hopToWorld(world) { ll.post('rl-world-hop', world.getId()); },
      openWorldHopper() {},
      getTotalLevel() { return Skill.values().reduce((a, s) => a + client.getRealSkillLevel(s), 0); },
      // the friends list (client hook `friends`): NameableContainer<Friend>; the 2007 client has no friends chat or clans
      getFriendContainer() {
        const list = (ll.api && ll.api.friends ? ll.api.friends() : []).map((f) => ({ getName: () => f.name, getWorld: () => f.world }));
        const norm = (n) => String(n || '').replace(/ /g, ' ').toLowerCase();
        return { getMembers: () => list, getCount: () => list.length, findByName: (n) => list.find((f) => norm(f.getName()) === norm(n)) || null };
      },
      // the 2007 clan chat is OSRS's friends chat (client hook `friendsChat`): FriendsChatManager with
      // FriendsChatMember { getName, getRank (FriendsChatRank), getWorld }; null when not in a channel
      getFriendsChatManager() {
        const raw = ll.api && ll.api.friendsChat ? ll.api.friendsChat() : null;
        if (!raw) return null;
        const norm = (n) => String(n || '').replace(/\u00A0/g, ' ').toLowerCase();
        const list = raw.map((m) => ({ getName: () => m.name, getWorld: () => m.world, getRank: () => FriendsChatRank.valueOf(m.rank) }));
        return { getMembers: () => list, getCount: () => list.length, findByName: (n) => list.find((m) => norm(m.getName()) === norm(n)) || null };
      },
      getClanChannel() { return null; },
      getGuestClanChannel() { return null; },
    });
    // CommandExecuted (client hook lostliteCommand): "::name args" typed in the chat box, split on spaces as RuneLite's
    // CommandManager. RuneLite runs every command locally; our server has its own, so a command goes on to the server
    // unless a subscriber calls event.consume().
    ll.chatCommand = (text) => {
      const split = String(text).substring(2).split(' ');
      let consumed = false;
      eventBus.post('CommandExecuted', { getCommand: () => split[0], getArguments: () => split.slice(1), consume: () => { consumed = true; } });
      return consumed;
    };
    Object.assign(rl, { WorldType, WorldRegion, World, WorldResult, worldService, Ping });
  }
  // ---------------------------------------------------------------- Bank's core pieces: the OSRS bank's Search and
  // Deposit inventory buttons, which the 2007 bank (interface 12) lacks, emulated over its empty title bar (the app's
  // look, 31 Oct 2026: OSRS's button art at the left of the title), the bank search (BankSearch: the chat box input
  // "Show items whose names contain the following text:", filtering live through the runtime's bank view),
  // ScriptCallbackEvent "bankSearchFilter" (int stack [match, itemId], object stack [search]) and MenuShouldLeftClick.
  {
    const BANKMAIN = 12;
    const SEARCH_BOX = { x: 26, y: 28, w: 24, h: 24 };
    const DEPOSIT_BOX = { x: 52, y: 28, w: 24, h: 24 };
    const SEARCH_TITLE = 'Show items whose names contain the following text:';
    const bankOpen = () => !!(ll.bank && ll.bank.open);
    const inBox = (b, p) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
    let searching = null; // the chat box input while typing
    // [proc,bankmain_*] script events the bank's scripts would fire (ScriptPreFired; the int / object stacks while posted)
    const scriptEvent = (id, ints = [], objs = []) => {
      stack = { ints, objs };
      try { eventBus.post('ScriptPreFired', { getScriptId: () => id, getScriptEvent: () => null }); } finally { stack = null; }
      return { ints, objs };
    };
    // ScriptCallbackEvent with the stacks given (the bank scripts' runelite_callback ops)
    const scriptCallback = (name, ints = [], objs = []) => {
      stack = { ints, objs };
      try { eventBus.post('ScriptCallbackEvent', { getEventName: () => name, getScript: () => null }); } finally { stack = null; }
      return { ints, objs };
    };
    /** after the bank's view is rebuilt: [proc,bankmain_finishbuilding] (Bank Tags puts its title on) */
    const rebuilt = () => { if (bankOpen()) scriptEvent(ScriptID.BANKMAIN_FINISHBUILDING, new Array(16).fill(0)); };
    const bankSearch = {
      /** BankSearch.initSearch: opens the search input (and clears an earlier search), as the bank's search button */
      initSearch() {
        if (!bankOpen()) return;
        scriptEvent(ScriptID.BANKMAIN_SEARCH_TOGGLE); // (Bank Tags closes its tab)
        if (ll.bankSearch) ll.bankSearch('');
        rebuilt();
        const o = { value: '' };
        o.draw = () => {
          const n = o.value && ll.bank && ll.bank.query ? ll.bank.map.length : -1;
          // the title is the scripts' (setSearchBankInputText / ...Found callbacks); the 2007 chat box prompt has one
          // line for it, so a second (<br>) line is left out
          const title = n >= 0 ? scriptCallback('setSearchBankInputTextFound', [n], [`${SEARCH_TITLE} (${n} found)`]).objs[0]
            : scriptCallback('setSearchBankInputText', [], [SEARCH_TITLE]).objs[0];
          chatboxPanelManager.show([String(title).split('<br>')[0], o.value + '*']);
        };
        o.listener = { keyPressed: (e) => {
          e.consume();
          if (e.key === 'Escape') { bankSearch.reset(true); return; }
          if (e.key === 'Enter') { chatboxPanelManager.close(); searching = null; return; }
          if (e.key === 'Backspace') o.value = o.value.slice(0, -1);
          else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && o.value.length < 30) o.value += e.key;
          else return;
          if (ll.bankSearch) ll.bankSearch(o.value);
          rebuilt();
          o.draw();
        }, keyReleased: (e) => e.consume() };
        searching = o;
        chatboxPanelManager.open(o);
      },
      /** BankSearch.reset(closeChat): the bank shows everything again */
      reset(closeChat) {
        if (ll.bankSearch) ll.bankSearch('');
        if (closeChat && searching) chatboxPanelManager.close();
        searching = null;
        rebuilt();
      },
      /** BankSearch.layoutBank: refilter with the current text */
      layoutBank() { if (ll.bank && ll.bankSearch) { ll.bankSearch(ll.bank.query); rebuilt(); } },
      isSearching: () => !!searching || !!(ll.bank && ll.bank.query),
    };
    // the filter callback (runtime bankMatch)
    let stack = null;
    // (the int stack starts with the script's own name match: a callback can set or clear it)
    ll.bankSearchFilter = (itemId, search, nameMatch) => {
      stack = { ints: [nameMatch ? 1 : 0, itemId], objs: [search] };
      eventBus.post('ScriptCallbackEvent', { getEventName: () => 'bankSearchFilter', getScript: () => null });
      const match = stack.ints[0] === 1;
      stack = null;
      return match;
    };
    // the getSearchingTagTab callback: whether a tag tab filters the bank (the runtime's bankTagTab)
    ll.bankSearchingTagTab = () => scriptCallback('getSearchingTagTab', [0]).ints[0] === 1;
    Object.assign(client, {
      getIntStack: () => (stack ? stack.ints : []),
      getIntStackSize: () => (stack ? stack.ints.length : 0),
      getObjectStack: () => (stack ? stack.objs : []),
      getObjectStackSize: () => (stack ? stack.objs.length : 0),
    });
    // the buttons' menu entries (the OSRS widgets' ops): on top while hovered; MenuShouldLeftClick can push them under
    // the top entry, so a left click doesn't use them (RuneLite then opens the menu instead)
    let hovered = null;
    menuBuildHooks.push((c) => {
      hovered = null;
      if (!bankOpen() || client.isMenuOpen()) return;
      const m = client.getMouseCanvasPosition();
      if (inBox(SEARCH_BOX, m)) hovered = { option: 'Search', run: () => (bankSearch.isSearching() ? bankSearch.reset(true) : bankSearch.initSearch()) };
      else if (inBox(DEPOSIT_BOX, m)) hovered = { option: 'Deposit inventory', run: () => ll.command && ll.command({ type: 'bank-deposit-all' }) };
      if (hovered) ll.insertMenuEntry(c, c[fld('menuCount')] | 0, hovered.option, hovered.run);
    });
    menuBuiltHooks.push((c) => {
      if (!hovered) return;
      let force = false;
      eventBus.post('MenuShouldLeftClick', { setForceRightClick: (b) => { force = !!b; }, isForceRightClick: () => force });
      const n = c[fld('menuCount')] | 0;
      if (!force || n < 2) return;
      // move the top entry (ours) under the next one
      const arrays = ll.menuArrays(c);
      for (const arr of arrays) { const t = arr[n - 1]; arr[n - 1] = arr[n - 2]; arr[n - 2] = t; }
    });
    client.getMenuEntries = client.getMenuEntries || (() => {
      const c = c0(); if (!c || !fld('menuCount')) return [];
      const out = []; for (let i = 0; i < (c[fld('menuCount')] | 0); i++) out.push(menuEntryAt(c, i)); return out;
    });
    class BankButtonsOverlay extends Overlay {
      constructor() { super(null); this.setPosition(OverlayPosition.DYNAMIC); this.setLayer(OverlayLayer.ABOVE_WIDGETS); }
      getName() { return 'BankButtons'; }
      render(g) {
        // the bank's view is first built once the runtime has the bank open: [proc,bankmain_finishbuilding]
        const open = bankOpen() && !!client.getWidget(BANKMAIN, 0);
        if (open && !this.wasOpen) rebuilt();
        this.wasOpen = open;
        if (!open) return null;
        const img = (k) => { const a = assets[`bank/${k}.png`]; if (!a) return null; if (!a.img) a.img = imageFromUrl(a.url); return a.img; };
        for (const [b, k] of [[SEARCH_BOX, 'search'], [DEPOSIT_BOX, 'deposit']]) {
          const i = img(k);
          if (i) g.drawImage(i, b.x, b.y, b.w, b.h);
          if (k === 'search' && bankSearch.isSearching()) { g.setColor(new Color(120, 0, 0, 110)); g.fillRect(b.x, b.y, b.w, b.h); }
        }
        return null;
      }
    }
    const bankButtons = new BankButtonsOverlay();
    overlayManager.add(bankButtons);
    rl.bankSearch = bankSearch;
    rl.bankButtons = { SEARCH_BOX, inBox, bankOpen };
    rl.menuBuildHooks = menuBuildHooks; // (core widgets the 2007 client lacks add their menu entries here)
    rl.toGameTags = toGameTags;
    rl.toImage = toImage; // (a sprite as a drawable canvas: the Bank plugin's faded placeholders)
  }
  // ---------------------------------------------------------------- Developer Tools' core pieces (read-only): projectiles,
  // graphics objects, tile settings, collision maps, the camera (client hooks projectiles / graphicsObjects /
  // tileSetting / collisionFlag / camera), the scene's tile objects, Actor.getPoseAnimation
  {
    const api = () => ll.api || {};
    const cam = () => (api().camera ? api().camera() : { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, scale: 512 });
    const flat5 = (a, fn) => { const out = []; for (let i = 0; a && i + 4 < a.length; i += 5) out.push(fn(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4])); return out; };
    Object.assign(client, {
      /** Projectile: getId (spotanim), getX / getY (fine scene coordinates), getZ (height), getFloor */
      getProjectiles() {
        return flat5(api().projectiles ? api().projectiles() : null, (id, x, y, z, level) => ({ getId: () => id, getX: () => x, getY: () => y, getZ: () => z, getFloor: () => level }));
      },
      /** getTileSettings()[level][sceneX][sceneY] (2007's ClientBuild.mapl) */
      getTileSettings() {
        const f = api().tileSetting;
        return new Proxy([], { get: (_t, l) => (l === 'length' ? 4 : new Proxy([], { get: (_u, x) => (x === 'length' ? 104 : new Proxy([], { get: (_v, y) => (y === 'length' ? 104 : f ? f(Number(l), Number(x), Number(y)) : 0) })) })) });
      },
      /** getCollisionMaps()[level].getFlags()[sceneX][sceneY] */
      getCollisionMaps() {
        const f = api().collisionFlag;
        if (!f) return null;
        return [0, 1, 2, 3].map((l) => ({ getFlags: () => new Proxy([], { get: (_u, x) => (x === 'length' ? 104 : new Proxy([], { get: (_v, y) => (y === 'length' ? 104 : f(l, Number(x), Number(y))) })) }) }));
      },
      getCameraZ() { return cam().z; },
      getCameraPitch() { return cam().pitch; },
      getCameraYaw() { return cam().yaw; },
      /** the 3D view's zoom (Pix3D.zoom: 512, x k with SD increased resolution) */
      getScale() { return cam().scale; },
      isInInstancedRegion() { return false; },
    });
    topLevelWorldView.getGraphicsObjects = () => flat5(api().graphicsObjects ? api().graphicsObjects() : null, (id, x, y, z, level) => ({ getId: () => id, getLocation: () => new LocalPoint(x, y), getZ: () => z, getLevel: () => level }));
    topLevelWorldView.getTileSettings = () => client.getTileSettings();
    /** every tile object in the scene (Developer Tools walks these rather than 104 x 104 tiles) */
    rl.sceneTileObjects = () => [...sceneLocs.values()];
    /** the varbits on a varp, [[id, lsb, msb], ...] (the 2007 cache's definitions) */
    rl.varbitsOf = (varp) => varbitsByVarp().get(varp) || [];
  }
  // ---------------------------------------------------------------- Login Screen's core pieces: the login screen
  // (client hooks loginFire / loginBackground / loginIndex / loginField / loginUsername / setLoginUsername), the
  // client's Preferences (remembered username), ImageUtil.getImageSpritePixels
  {
    const api = () => ll.api || {};
    // OSRS's Preferences.rememberedUsername. 2007 has no "Remember username" box, so the client is taken as remembering
    // the last username logged in with (as OSRS's with the box ticked), for this session; the login box shows a
    // remembered username only once one is set with setRememberedUsername (the Login Screen plugin).
    let remembered = null; let shown = false; let lastIndex = -1;
    const fillLogin = () => {
      const a = api();
      if (!shown || !remembered || !a.loginIndex || a.loginIndex() !== 2) return;
      if (!a.loginUsername()) a.setLoginUsername(remembered);
    };
    const preferences = {
      getRememberedUsername() { return remembered; },
      setRememberedUsername(u) { remembered = u == null || u === '' ? null : String(u); shown = remembered != null; fillLogin(); },
    };
    titleHooks.push(() => {
      const a = api();
      const i = a.loginIndex ? a.loginIndex() : -1;
      if (i !== lastIndex) { lastIndex = i; if (i === 2) fillLogin(); }
    });
    let wasLoggedIn = false;
    eventBus.register({ onGameStateChanged(e) {
      // (registered before any plugin, so the username is remembered before a plugin's GameStateChanged reads it)
      const inGame = e.getGameState() === GameState.LOGGED_IN;
      if (inGame && !wasLoggedIn) { const u = client.getUsername(); if (u) remembered = u; }
      wasLoggedIn = inGame;
      if (!inGame) lastIndex = -1;
    } });
    /** SpritePixels: the client's 32-bit sprite (RGB ints) */
    class SpritePixels {
      constructor(width, height, pixels) { this.width = width; this.height = height; this.pixels = pixels; }
      getWidth() { return this.width; } getHeight() { return this.height; } getPixels() { return this.pixels; }
    }
    const ImageUtil = rl.ImageUtil || {};
    /** ImageUtil.getImageSpritePixels(image, client): an image (loaded) as SpritePixels; transparent pixels are 0 */
    ImageUtil.getImageSpritePixels = (image) => {
      const w = image.naturalWidth || image.width; const h = image.naturalHeight || image.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.drawImage(image, 0, 0);
      const d = g.getImageData(0, 0, w, h).data; const px = new Int32Array(w * h);
      for (let i = 0; i < px.length; i++) px[i] = d[i * 4 + 3] === 0 ? 0 : (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      return new SpritePixels(w, h, px);
    };
    rl.ImageUtil = ImageUtil;
    rl.SpritePixels = SpritePixels;
    Object.assign(client, {
      getPreferences() { return preferences; },
      /** the login box's username field (2007: also the name logged in with) */
      getUsername() { const a = api(); return a.loginUsername ? a.loginUsername() : ''; },
      setUsername(u) { const a = api(); if (a.setLoginUsername) a.setLoginUsername(String(u)); },
      /** 0 the welcome box, 2 the username / password box, 3 the new-user box; -1 when it isn't showing (2007 has no
       *  authenticator box) */
      getLoginIndex() { const a = api(); return a.loginIndex ? a.loginIndex() : -1; },
      /** 0 username, 1 password */
      getCurrentLoginField() { const a = api(); return a.loginField ? a.loginField() : 0; },
      setShouldRenderLoginScreenFire(b) { const a = api(); if (a.loginFire) a.loginFire(!!b); },
      /** the login screen's background, a 765x503 SpritePixels (padded / cropped from the top left), or null for the cache's */
      setLoginScreen(sp) {
        const a = api(); if (!a.loginBackground) return;
        if (!sp) { a.loginBackground(null); return; }
        const out = new Int32Array(765 * 503);
        for (let y = 0; y < Math.min(503, sp.height); y++) for (let x = 0; x < Math.min(765, sp.width); x++) out[y * 765 + x] = sp.pixels[y * sp.width + x];
        a.loginBackground(out);
      },
    });
  }
  ll.rl = rl;
  npcOverlayService.init();
  window.addEventListener('focus', () => eventBus.post('FocusChanged', { isFocused: () => true }));
  window.addEventListener('blur', () => eventBus.post('FocusChanged', { isFocused: () => false }));
  ll.post = ll.post || ((type, data) => window.postMessage({ __lostlite: true, type, data }, '*'));
})();
