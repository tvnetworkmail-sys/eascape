'use strict';
// Game-side half of the Camera plugin: runs in the game frame's preload.
//  - Mouse wheel over the 3D view: zoom factor for the patched camera distance.
//  - Middle button held + mouse move: turns the camera (yaw) and tilts it (pitch) by
//    writing the client's orbit camera fields, like OSRS's native middle-mouse camera.

// The 3D viewport inside the 765 x 503 game, in game pixels (same as the original client).
const VIEWPORT = { x: 4, y: 4, w: 512, h: 334 };
const BASE_MIN = 0.7;
const BASE_MAX = 1.3;
const OUTER_EXTRA = 2.0; // "Expand outer zoom limit" at 100% allows 1.3 * 3 = 3.9x
const INNER_MIN = 0.45;
// Degrees of the 2004 camera (2048 units per turn) per pixel of mouse movement at 100%.
const YAW_PER_PX = 2;
const PITCH_PER_PX = 1;

module.exports = function camera(ctx) {
  let zoom = ctx.state('zoomLevel', 1);

  function limits() {
    const min = ctx.config('inner') ? INNER_MIN : BASE_MIN;
    const max = BASE_MAX * (1 + (OUTER_EXTRA * ctx.config('outerLimit')) / 100);
    return { min, max };
  }

  function apply(value) {
    const { min, max } = limits();
    zoom = Math.max(min, Math.min(max, value));
    ctx.sendToGame({ type: 'zoom', value: zoom });
    ctx.setState('zoomLevel', zoom);
  }

  function onWheel(e) {
    // over an interface's scrollable part the wheel scrolls it instead (the runtime takes it)
    if (e.defaultPrevented || !inViewport(e)) return;
    e.preventDefault();
    let dir = Math.sign(e.deltaY);
    if (ctx.config('invertZoom')) dir = -dir;
    const step = 1 + ctx.config('zoomIncrement') / 500;
    apply(dir > 0 ? zoom * step : zoom / step);
  }

  function inViewport(e) {
    const p = ctx.toGamePoint(e.clientX, e.clientY);
    return p && p.x >= VIEWPORT.x && p.y >= VIEWPORT.y && p.x < VIEWPORT.x + VIEWPORT.w && p.y < VIEWPORT.y + VIEWPORT.h;
  }

  // ---- middle-button camera
  // Driven by pointer events: the game listens to both pointer and mouse events, and
  // cancelling pointerdown also stops the browser sending the matching mouse events, so
  // the game never sees the middle click (no walking, no middle-click autoscroll).
  let drag = null;

  function onPointerDown(e) {
    if (e.button !== 1 || !ctx.config('middleClickRotate') || !inViewport(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!(e.buttons & 4)) { drag = null; return; }
    const r = ctx.toGameScale();
    const dx = (e.clientX - drag.x) / r;
    const dy = (e.clientY - drag.y) / r;
    drag.x = e.clientX;
    drag.y = e.clientY;
    const speed = ctx.config('cameraSpeed') / 100;
    const yaw = dx * YAW_PER_PX * speed * (ctx.config('invertYaw') ? 1 : -1);
    const pitch = dy * PITCH_PER_PX * speed * (ctx.config('invertPitch') ? -1 : 1);
    if (yaw || pitch) ctx.sendToGame({ type: 'rotate', dx: yaw, dy: pitch });
  }

  function onPointerUp(e) {
    if (e.button !== 1 || !drag) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    drag = null;
  }

  /** Belt and braces: swallow any middle-button mouse events that still get through. */
  function swallowMiddle(e) {
    if (e.button === 1 && ctx.config('middleClickRotate') && (drag || inViewport(e))) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onKey(e) {
    if (e.key === 'Control' && ctx.config('controlFunction') === 'reset') apply(ctx.config('ctrlZoomValue') / 100);
  }

  function roofs() {
    ctx.sendToGame({ type: 'roofs', hide: !!ctx.config('hideRoofs') });
  }

  return {
    start() {
      window.addEventListener('wheel', onWheel, { passive: false, capture: true });
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      for (const t of ['mousedown', 'mouseup', 'auxclick']) window.addEventListener(t, swallowMiddle, true);
      apply(zoom);
      roofs();
    },
    stop() {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      for (const t of ['mousedown', 'mouseup', 'auxclick']) window.removeEventListener(t, swallowMiddle, true);
      drag = null;
      ctx.sendToGame({ type: 'zoom', value: 1 });
      ctx.sendToGame({ type: 'roofs', hide: false });
    },
    configChanged() {
      apply(zoom); // re-clamp to new limits
      roofs();
    },
    gameReady() {
      apply(zoom);
      roofs();
    },
  };
};
