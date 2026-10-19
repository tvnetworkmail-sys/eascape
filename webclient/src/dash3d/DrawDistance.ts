// EASCape: how many tiles are drawn around the camera. The 2006 client drew 25; we draw 50,
// about as far as the 104 x 104 tile area the client holds around you reaches. Things further
// than that aren't loaded, so a higher number would only show the edge of the map.
export const DRAW_RADIUS: number = 50;
// the far clip grows with it (3500 units for the original 25 tiles)
export const DRAW_FAR: number = ((3500 * DRAW_RADIUS) / 25) | 0;

// the far clip for models right now: the EASCape app pushes it out further while you're zoomed
// out (its runtime's "far"), otherwise DRAW_FAR
export function drawFar(): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const far = (globalThis as any).__lostlite?.far;
    return typeof far === 'number' && far > DRAW_FAR ? far : DRAW_FAR;
}
