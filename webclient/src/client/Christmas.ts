// EASCape: Christmas mode (from 2007scape; not authentic: a seasonal extra staff switch on for December
// with ::christmas on|off). The server tells every client through varp 913 (christmas_mode, engine
// WorldSettings), and while it is 1:
//   - snow falls over the 3D view, under the interfaces, whenever you stand outdoors above ground. It is
//     Trollweiss' own snow (overlay_atmosphere_snow_flakes: models 4961 / 4962 with the seqs snowfall /
//     snowfall2), drawn as that overlay draws it, but by the client itself, so it never takes the
//     viewport overlay's slot (the Wilderness level and others need it). Drawn into the world's frame,
//     at the increased resolution when the game is scaled up (SdView).
//   - the ground outdoors is snowy: the scene's underlay colours turn white and untextured overlays
//     (paths, roads) frost over (water, lava and other textured floors, and everything under a roof or
//     underground, stay as they are), and roofs and trees get snow on their upward faces. This is done
//     to the colours while the scene is built (ClientBuild.finishBuild, LocType.buildModel), so switching
//     it builds the scene again from the map data, which is never changed.
// The snowy ground shows for everyone while the server has it on. The falling snow is off unless a
// player turns it on in the app (LostLite > "Show falling snow": the page's data-eascape-snow
// attribute, on), so the browser client has the snowy ground only (the owner's call, 14 Nov 2026).
import { LocShape } from '#/dash3d/LocShape.js';
import { MapFlag } from '#/dash3d/MapFlag.js';
import Model from '#/dash3d/Model.js';
import Pix3D from '#/dash3d/Pix3D.js';
import SeqType from '#/config/SeqType.js';
import type LocType from '#/config/LocType.js';

import SdView from '#/client/SdView.js';

// the overlay's two snowfall models (components 0 and 1) and their seqs (snowfall2, snowfall)
const FLAKES: { model: number; seq: number }[] = [
    { model: 4962, seq: 1490 },
    { model: 4961, seq: 1489 }
];
// where the overlay draws them: each component is at x 248, y 354, 32 x 32 in the 512 x 334 viewport, so
// the model's origin is at (264, 370) of the viewport, seen from 200 away (zoom 200, xan 0, yan 0)
const ORIGIN_X = 264;
const ORIGIN_Y = 370;
const ZOOM = 200;

// the first square underground: caves, dungeons and other underground maps lie north of this
const UNDERGROUND_Z = 4160;

export default class Christmas {
    static readonly VARP = 913;

    // the app's "Show falling snow" on (app preload/game.js sets the attribute); off by default
    static get falling(): boolean {
        return typeof document !== 'undefined' && document.documentElement?.getAttribute('data-eascape-snow') === 'on';
    }
    // what the scene now shown was built for: Christmas mode wanted, and whether it is snowy (wanted and
    // above ground)
    static builtWanted: boolean = false;
    static builtSnow: boolean = false;
    // the scene's south-west corner (world z) while it is built
    private static baseZ: number = 0;
    private static baseX: number = 0;

    // Varrock fountain's king statue (loc 563, statue_king), on level 1 at 3213, 3429 over the fountain's
    // bridge: the server takes it out for the tree (christmas_decor.rs2), but its loc changes only reach
    // players on that level, so the scene leaves it out itself while Christmas mode is on (as 2007scape)
    // and the plinth top it stands on (level 1's floor there), a grey square in the tree
    static hideTile(level: number, x: number, z: number): boolean {
        return Christmas.builtWanted && level === 1 && Christmas.baseX + x === 3213 && Christmas.baseZ + z === 3429;
    }

    static hideLoc(locId: number, level: number, x: number, z: number): boolean {
        return Christmas.builtWanted && locId === 563 && level === 1 && Christmas.baseX + x === 3213 && Christmas.baseZ + z === 3429;
    }

    private static anims = FLAKES.map(() => ({ frame: 0, cycle: 0 }));
    private static lastAnim: number = 0;

    // the server has Christmas mode on (the snowy ground; for everyone)
    static wanted(vars: number[]): boolean {
        return vars[Christmas.VARP] === 1;
    }

    // ---- the scene

    // before a scene is built (Client.mapBuild): whether its ground, roofs and trees are snowy
    static beginBuild(vars: number[], baseX: number, baseZ: number): void {
        Christmas.builtWanted = Christmas.wanted(vars);
        Christmas.baseX = baseX;
        Christmas.baseZ = baseZ;
        Christmas.builtSnow = Christmas.builtWanted && baseZ + 52 < UNDERGROUND_Z;
    }

    // a square of the scene being built is snowy: outdoors (not under a roof) and above ground
    static snowy(mapl: Uint8Array[][], level: number, x: number, z: number): boolean {
        return Christmas.builtSnow && (mapl[level][x][z] & MapFlag.RemoveRoof) === 0 && Christmas.baseZ + z < UNDERGROUND_Z;
    }

    // an underlay's blended colour (HSL16: hue 6 bits, saturation 3, lightness 7) as snow: white that keeps a
    // little of the ground's own light and dark, so the terrain still reads
    static snowUnderlay(hsl: number): number {
        if (hsl < 0) {
            return hsl;
        }
        const light = hsl & 0x7f;
        return (40 << 10) | (0 << 7) | Math.min(120, 100 + (light >> 2));
    }

    // an untextured overlay (paths, roads, grass and dirt floors) frosted over: paler and greyer, still its
    // own colour so paths stay readable
    static frostOverlay(hsl: number): number {
        if (hsl < 0) {
            return hsl;
        }
        const hue = (hsl >> 10) & 0x3f;
        const sat = (hsl >> 7) & 0x7;
        const light = hsl & 0x7f;
        return (hue << 10) | ((sat >> 1) << 7) | (light + (((127 - light) * 5) >> 4));
    }

    // a loc whose model gets frosted: roofs and trees (not the decorated Christmas tree, "Evergreen.":
    // snow would hide its decorations)
    static frosts(loc: LocType, shape: number): boolean {
        if (!Christmas.builtSnow) {
            return false;
        }
        if (shape >= LocShape.ROOF_STRAIGHT && shape <= LocShape.ROOFEDGE_SQUARE_CORNER) {
            return true;
        }
        return (shape === LocShape.CENTREPIECE_STRAIGHT || shape === LocShape.CENTREPIECE_DIAGONAL) && /^(tree|dead tree|oak|willow|maple tree|yew|magic tree|evergreen|achey tree)$/i.test(loc.name ?? '');
    }

    // the faces of a loc model that face up turn snowy (its own colour array: buildModel copied it)
    static frost(model: Model): void {
        const px = model.pointX;
        const py = model.pointY;
        const pz = model.pointZ;
        const a = model.faceVertexA;
        const b = model.faceVertexB;
        const c = model.faceVertexC;
        const colour = model.faceColour;
        if (!px || !py || !pz || !a || !b || !c || !colour) {
            return;
        }
        let info = model.faceRenderType;
        let ownInfo = false;
        for (let f = 0; f < model.numFaces; f++) {
            const ax = px[a[f]], ay = py[a[f]], az = pz[a[f]];
            const ux = px[b[f]] - ax, uy = py[b[f]] - ay, uz = pz[b[f]] - az;
            const vx = px[c[f]] - ax, vy = py[c[f]] - ay, vz = pz[c[f]] - az;
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            // y points down in the world: an upward face's normal has negative y; steeper faces (a tree's
            // sides, walls under the eaves) keep their colour
            if (len === 0 || -ny / len < 0.55) {
                continue;
            }
            if (info && (info[f] & 0x2) !== 0) {
                // a textured face (roof tiles, leaves) is snow-covered flat: no texture, a light snow colour
                if (!ownInfo) {
                    info = Int32Array.from(info);
                    model.faceRenderType = info;
                    ownInfo = true;
                }
                info[f] &= ~0x2;
                colour[f] = 112;
                continue;
            }
            const light = colour[f] & 0x7f;
            colour[f] = Math.min(118, light + (((127 - light) * 3) >> 2));
        }
    }

    // ---- the falling snow

    // snow falls here: Christmas mode, a snowy scene, and the player stands outdoors (scene square x, z on
    // the level drawn)
    static snowing(vars: number[], mapl: Uint8Array[][] | null, level: number, x: number, z: number): boolean {
        if (!Christmas.builtSnow || !Christmas.wanted(vars) || !mapl) {
            return false;
        }
        if (x < 0 || z < 0 || x >= 104 || z >= 104) {
            return false;
        }
        return (mapl[level][x][z] & MapFlag.RemoveRoof) === 0 && Christmas.baseZ + z < UNDERGROUND_Z;
    }

    // the overlay's seqs move on (by the client cycles, 20 ms each, since the last frame), as an interface
    // model's do (Client.animateInterface)
    private static animate(): void {
        const now = performance.now();
        let delta = Christmas.lastAnim === 0 ? 1 : Math.floor((now - Christmas.lastAnim) / 20);
        if (delta <= 0) {
            return;
        }
        delta = Math.min(delta, 50);
        Christmas.lastAnim = now;
        for (let i = 0; i < FLAKES.length; i++) {
            const seq = SeqType.list[FLAKES[i].seq];
            const a = Christmas.anims[i];
            if (!seq || !seq.frames || seq.numFrames === 0) {
                continue;
            }
            a.cycle += delta;
            while (a.cycle > seq.getDelay(a.frame)) {
                a.cycle -= seq.getDelay(a.frame) + 1;
                a.frame++;
                if (a.frame >= seq.numFrames) {
                    a.frame -= seq.loops;
                    if (a.frame < 0 || a.frame >= seq.numFrames) {
                        a.frame = 0;
                    }
                }
            }
        }
    }

    // a flake model in its current frame, lit as an interface model (IfType.getTempModel)
    private static model(i: number): Model | null {
        const base = Model.load(FLAKES[i].model);
        if (!base) {
            return null;
        }
        const seq = SeqType.list[FLAKES[i].seq];
        const frame = seq && seq.frames && seq.numFrames > 0 ? seq.frames[Christmas.anims[i].frame] : -1;
        const tmp = Model.copyForAnim(base, true, false, false);
        if (frame !== -1) {
            tmp.prepareAnim();
            tmp.animate(frame);
        }
        tmp.calculateNormals(64, 768, -50, -10, -50, true);
        return tmp;
    }

    // after the world and before SdView.end: the flakes into the world's frame (the viewport, or SdView's
    // own k-times buffer)
    static draw(vars: number[], mapl: Uint8Array[][] | null, level: number, x: number, z: number): void {
        if (!Christmas.falling || !Christmas.snowing(vars, mapl, level, x, z)) {
            return;
        }
        Christmas.animate();
        const k = SdView.active ? SdView.k : 1;
        const ox = Pix3D.originX;
        const oy = Pix3D.originY;
        for (let i = 0; i < FLAKES.length; i++) {
            const m = Christmas.model(i);
            if (!m) {
                continue;
            }
            Pix3D.originX = Math.round(ORIGIN_X * k);
            Pix3D.originY = Math.round(ORIGIN_Y * k);
            m.objRender(0, 0, 0, 0, 0, 0, ZOOM);
        }
        Pix3D.originX = ox;
        Pix3D.originY = oy;
    }
}
