// EASCape: SD increased resolution, from 2007scape (webclient/src/client/SdView.ts). When the game
// canvas is scaled up on screen (the app's Fit to window, full screen, a high-DPI screen), the
// software renderer draws the 3D view at the size it has on screen: Pix2D is pointed at a buffer k
// times the viewport, Pix3D projects k times larger (Pix3D.zoom), and the frame is shown in a canvas
// under the game canvas. A nearest-neighbour copy still goes into the game's pixels at 1x, so the 2D
// drawn over the world (overhead text, hitsplats, health bars, menus) stays at game pixels on top,
// and PixMap leaves the pixels still equal to that copy transparent. Clicks: model picking maps the
// mouse into the frame's size, and ground picking (World.clickX/Y) is scaled by k for the frame.
// Off by default: the app turns it on (its 'High-resolution 3D view' setting, the page's
// data-eascape-sd attribute); on the web page, ?sdres=on (remembered).
import { canvas } from '#/graphics/Canvas.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix3D from '#/dash3d/Pix3D.js';
import World from '#/dash3d/World.js';
import PixMap from '#/graphics/PixMap.js';

const STORAGE_KEY = 'eascape.sdres';
const MAX_PIXELS = 2560 * 1600;
// EASCape: the frame is drawn only as large as this computer can draw it smoothly. The 3D world's
// draw time is measured every frame; the scale steps down (0.25 at a time) while it's over the
// budget and back up when the next step would still fit, down to 1x (no extra cost at all). The
// game loop has 20 ms a frame at 50 fps; the world gets at most BUDGET_MS of it.
const BUDGET_MS = 8;
const STEP = 0.25;

export default class SdView {
    static enabled: boolean = false;
    static active: boolean = false;
    private static buf: Int32Array = new Int32Array(0);
    private static copy: Int32Array = new Int32Array(0);
    private static saved: { pixels: Int32Array; width: number; height: number } | null = null;
    private static x = 0;
    private static y = 0;
    private static w = 0;
    private static h = 0;
    private static offX = 0;
    private static offY = 0;
    private static bw = 0;
    private static bh = 0;
    static k = 1; // the scale of the frame being drawn (while active)
    private static limit = Infinity; // the most this computer can keep up with (adaptive)
    private static ema = -1; // the world's draw time (ms), smoothed
    private static hold = 0; // frames to wait after a change before judging again
    private static t0 = 0;
    private static drawnK = 1;
    private static click: { x: number; y: number } | null = null;
    private static settingRead = false;

    static readSetting(): void {
        SdView.settingRead = true;
        let v: string | null = null;
        try {
            v = localStorage.getItem(STORAGE_KEY);
        } catch {}
        const param = new URL(globalThis.location?.href ?? 'http://localhost/').searchParams.get('sdres');
        if (param === 'on' || param === 'off') {
            v = param;
            try {
                localStorage.setItem(STORAGE_KEY, param);
            } catch {}
        }
        SdView.enabled = v === 'on';
    }

    static set(on: boolean): void {
        SdView.enabled = on;
        try {
            localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
        } catch {}
    }

    // the scale the viewport is drawn at: its on-screen size in device pixels per game pixel (1: not scaled)
    static scale(width: number, height: number): number {
        if (!SdView.settingRead) {
            SdView.readSetting();
        }
        // the app's setting, when it's there, decides
        const app = document.documentElement.getAttribute('data-eascape-sd');
        const on = app !== null ? app === 'on' : SdView.enabled;
        if (!on || !canvas) {
            return 1;
        }
        // the canvas alone in full screen (an older page): nothing under it would show
        if (document.fullscreenElement === canvas) {
            return 1;
        }
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !canvas.width) {
            return 1;
        }
        const dpr = globalThis.devicePixelRatio || 1;
        const kx = (rect.width / canvas.width) * dpr;
        const ky = (rect.height / canvas.height) * dpr;
        let k = Math.max(kx, ky);
        if (k <= 1.05) {
            return 1;
        }
        k = Math.min(k, Math.sqrt(MAX_PIXELS / (width * height)));
        return k > 1.05 ? k : 1;
    }

    // before the world is drawn into the viewport (x, y, width, height of the bound pixels, which go
    // on the canvas at offX, offY); Model.mouseX/Y are set by the caller afterwards with mouse()
    static begin(x: number, y: number, width: number, height: number, offX: number, offY: number): void {
        SdView.t0 = performance.now();
        const want = SdView.scale(width, height);
        const k = Math.min(want, SdView.limit);
        SdView.drawnK = want > 1 && k > 1.05 ? k : 1;
        SdView.wanted = want;
        if (k <= 1.05) {
            SdView.active = false;
            return;
        }
        const bw = Math.round(width * k);
        const bh = Math.round(height * k);
        if (SdView.buf.length !== bw * bh) {
            SdView.buf = new Int32Array(bw * bh);
        } else {
            SdView.buf.fill(0);
        }
        SdView.saved = { pixels: Pix2D.pixels, width: Pix2D.width, height: Pix2D.height };
        SdView.x = x;
        SdView.y = y;
        SdView.w = width;
        SdView.h = height;
        SdView.offX = offX;
        SdView.offY = offY;
        SdView.bw = bw;
        SdView.bh = bh;
        SdView.k = bw / width;
        Pix2D.setPixels(SdView.buf, bw, bh);
        Pix3D.setRenderClipping();
        Pix3D.zoom = Math.round(512 * SdView.k);
        if (World.click) {
            SdView.click = { x: World.clickX, y: World.clickY };
            World.clickX = Math.round(World.clickX * SdView.k);
            World.clickY = Math.round(World.clickY * SdView.k);
        }
        SdView.active = true;
    }

    // a viewport position (game pixels) in the frame being drawn
    static mouse(v: number): number {
        return SdView.active ? Math.round(v * SdView.k) : v;
    }

    // after the world: back to the game's pixels at 1x, the frame shown under the game canvas
    private static wanted = 1;

    // the world's draw time this frame: adjust the limit
    private static adapt(): void {
        const ms = performance.now() - SdView.t0;
        if (SdView.wanted <= 1.05) {
            SdView.ema = -1; // not scaled: nothing to judge
            return;
        }
        SdView.ema = SdView.ema < 0 ? ms : SdView.ema * 0.9 + ms * 0.1;
        if (SdView.hold > 0) {
            SdView.hold--;
            return;
        }
        const k = SdView.drawnK;
        if (SdView.ema > BUDGET_MS && k > 1) {
            const next = k - STEP > 1.05 ? Math.floor((k - STEP) / STEP) * STEP : 1;
            SdView.limit = Math.max(1, next);
            SdView.ema *= (SdView.limit * SdView.limit) / (k * k);
            SdView.hold = 15;
        } else if (k < SdView.wanted) {
            const next = Math.min(SdView.wanted, Math.floor(k / STEP) * STEP + STEP);
            // pessimistic: the whole draw time grows with the pixels
            if (SdView.ema * ((next * next) / (k * k)) < BUDGET_MS * 0.85) {
                SdView.limit = next;
                SdView.ema *= (next * next) / (k * k);
                SdView.hold = 30;
            }
        }
    }

    static end(): void {
        SdView.adapt();
        if (!SdView.active) {
            SdView.hide();
            return;
        }
        SdView.active = false;
        Pix3D.zoom = 512;
        if (SdView.click) {
            if (World.click) {
                World.clickX = SdView.click.x;
                World.clickY = SdView.click.y;
            }
            SdView.click = null;
        }
        const s = SdView.saved!;
        SdView.saved = null;
        Pix2D.setPixels(s.pixels, s.width, s.height);
        Pix3D.setRenderClipping();
        const { x, y, w, h, bw, bh, buf } = SdView;
        // the 1x copy (nearest neighbour), into the game's pixels and kept for the transparent hole
        const copy = SdView.copy.length === w * h ? SdView.copy : (SdView.copy = new Int32Array(w * h));
        const kx = bw / w;
        const ky = bh / h;
        for (let j = 0; j < h; j++) {
            const row = Math.min(bh - 1, ((j + 0.5) * ky) | 0) * bw;
            const out = (y + j) * s.width + x;
            for (let i = 0; i < w; i++) {
                const p = buf[row + Math.min(bw - 1, ((i + 0.5) * kx) | 0)];
                copy[j * w + i] = p;
                s.pixels[out + i] = p;
            }
        }
        SdView.present(s.pixels, copy);
    }

    private static view: HTMLCanvasElement | null = null;
    private static ctx: CanvasRenderingContext2D | null = null;
    private static image: ImageData | null = null;
    private static shown = false;
    private static failed = false;

    // the frame in a canvas under the game canvas, over the viewport
    private static present(owner: Int32Array, copy: Int32Array): void {
        const main = canvas;
        const { x, y, w, h, bw, bh, buf, offX, offY } = SdView;
        if (SdView.failed || !main || !main.parentElement) {
            return;
        }
        if (!SdView.view || SdView.view.parentElement !== main.parentElement) {
            try {
                const c = SdView.view ?? document.createElement('canvas');
                c.style.position = 'absolute';
                c.style.zIndex = '-2';
                c.style.pointerEvents = 'none';
                c.style.imageRendering = 'auto';
                c.style.margin = '0';
                // the app shows only the game canvas (body * hidden !important); an inline !important wins
                c.style.setProperty('visibility', 'hidden', 'important');
                const parent = main.parentElement;
                if (getComputedStyle(parent).position === 'static') {
                    parent.style.position = 'relative';
                }
                parent.style.isolation = 'isolate';
                parent.insertBefore(c, main);
                SdView.ctx = c.getContext('2d', { alpha: false });
                if (!SdView.ctx) throw new Error('no 2d context');
                SdView.view = c;
                SdView.image = null;
            } catch (e) {
                console.warn('SD: no increased-resolution view', e);
                SdView.failed = true;
                return;
            }
        }
        const c = SdView.view!;
        const parent = main.parentElement.getBoundingClientRect();
        const rect = main.getBoundingClientRect();
        const sx = rect.width / main.width;
        const sy = rect.height / main.height;
        c.style.left = `${rect.left - parent.left + (offX + x) * sx}px`;
        c.style.top = `${rect.top - parent.top + (offY + y) * sy}px`;
        c.style.width = `${w * sx}px`;
        c.style.height = `${h * sy}px`;
        if (c.width !== bw || c.height !== bh) {
            c.width = bw;
            c.height = bh;
            SdView.image = null;
        }
        if (!SdView.image) {
            SdView.image = SdView.ctx!.createImageData(bw, bh);
        }
        const out = new Uint32Array(SdView.image.data.buffer);
        for (let i = 0; i < out.length; i++) {
            const p = buf[i];
            out[i] = ((p >> 16) & 0xff) | (p & 0xff00) | ((p & 0xff) << 16) | 0xff000000;
        }
        SdView.ctx!.putImageData(SdView.image, 0, 0);
        c.style.setProperty('visibility', 'visible', 'important');
        SdView.shown = true;
        PixMap.hole = { owner, x, y, width: w, height: h, copy, age: performance.now() };
    }

    static hide(): void {
        if (SdView.shown && SdView.view) {
            SdView.view.style.setProperty('visibility', 'hidden', 'important');
            SdView.shown = false;
        }
        PixMap.hole = null;
    }
}
