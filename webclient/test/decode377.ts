// Offline check: decode every 377 game-data entry with the web client's own decoders, using the
// archives the engine packs (engine/data/pack/client). Each Obj/Loc/Npc entry must end exactly
// where the next one starts; the eagerly-decoded types report unknown codes themselves.
import fs from 'fs';
import path from 'path';

import JagFile from '#/io/JagFile.js';
import Packet from '#/io/Packet.js';
import ObjType from '#/config/ObjType.js';
import LocType from '#/config/LocType.js';
import NpcType from '#/config/NpcType.js';
import SeqType from '#/config/SeqType.js';
import FloType from '#/config/FloType.js';
import IdkType from '#/config/IdkType.js';
import SpotType from '#/config/SpotType.js';
import VarpType from '#/config/VarpType.js';
import VarBitType from '#/config/VarBitType.js';
import IfType from '#/config/IfType.js';
import PixFont from '#/graphics/PixFont.js';
import Pix8 from '#/graphics/Pix8.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix3D from '#/dash3d/Pix3D.js';
import JagFX from '#/sound/JagFX.js';
import WordFilter from '#/wordfilter/WordFilter.js';

const dir = process.argv[2] ?? path.join(import.meta.dir, '../../engine/data/pack');
// archives straight from the cache the server sends (main_file_cache, index 0), as the web routes do
const ARCHIVES: Record<string, number> = { title: 1, config: 2, interface: 3, media: 4, versionlist: 5, textures: 6, wordenc: 7, sounds: 8 };
const cacheDat = fs.readFileSync(path.join(dir, 'main_file_cache.dat'));
function cacheRead(index: number, file: number): Uint8Array {
    const idx = fs.readFileSync(path.join(dir, `main_file_cache.idx${index}`));
    const size = (idx[file * 6] << 16) | (idx[file * 6 + 1] << 8) | idx[file * 6 + 2];
    let sector = (idx[file * 6 + 3] << 16) | (idx[file * 6 + 4] << 8) | idx[file * 6 + 5];
    const out = new Uint8Array(size);
    let pos = 0;
    while (pos < size) {
        const off = sector * 520;
        const n = Math.min(512, size - pos);
        out.set(cacheDat.subarray(off + 8, off + 8 + n), pos);
        pos += n;
        sector = (cacheDat[off + 4] << 16) | (cacheDat[off + 5] << 8) | cacheDat[off + 6];
    }
    return out;
}
export { cacheRead };
const jag = (name: string) => new JagFile(cacheRead(0, ARCHIVES[name]));

let problems = 0;
const log = console.log;
console.log = (...a: unknown[]) => { problems++; log('  !', ...a); };

const config = jag('config');
const eager: [string, () => void][] = [
    ['seq', () => SeqType.init(config)],
    ['flo', () => FloType.init(config)],
    ['idk', () => IdkType.init(config)],
    ['spotanim', () => SpotType.init(config)],
    ['varp', () => VarpType.init(config)],
    ['varbit', () => VarBitType.init(config)],
];
for (const [name, fn] of eager) {
    const before = problems;
    try { fn(); } catch (e) { problems++; log('  !', name, 'threw', e); }
    log(`${name}: ${problems === before ? 'ok' : 'PROBLEMS'}`);
}

function lazy(name: string, T: { init: (c: JagFile, m: boolean) => void; numDefinitions: number; idx: Int32Array | null; dat: Packet | null }, make: () => { decode(p: Packet): void; reset?: () => void }) {
    T.init(config, true);
    const dat = T.dat!;
    const idx = T.idx!;
    let bad = 0;
    for (let id = 0; id < T.numDefinitions; id++) {
        const end = id + 1 < T.numDefinitions ? idx[id + 1] : dat.data.length;
        const o = make();
        o.reset?.();
        dat.pos = idx[id];
        try {
            o.decode(dat);
        } catch (e) {
            if (bad++ < 5) log(`  ! ${name} ${id} threw ${e}`);
            continue;
        }
        if (dat.pos !== end) {
            if (bad++ < 5) log(`  ! ${name} ${id} ended at ${dat.pos}, next starts at ${end}`);
        }
    }
    problems += bad;
    log(`${name}: ${T.numDefinitions} entries, ${bad ? bad + ' BAD' : 'ok'}`);
}
lazy("obj", ObjType as never, () => new ObjType() as never);
lazy("loc", LocType as never, () => new LocType() as never);
lazy("npc", NpcType as never, () => new NpcType() as never);

// the rest of the load: title fonts, 2D graphics, textures, sounds, chat filter, interfaces
function step(name: string, fn: () => void) {
    const before = problems;
    try { fn(); } catch (e) { problems++; log('  !', name, 'threw', e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : e); }
    log(`${name}: ${problems === before ? 'ok' : 'PROBLEMS'}`);
}
const title = jag('title');
let fonts: PixFont[] = [];
step('title fonts', () => { fonts = [PixFont.depack(title, 'p11_full', false), PixFont.depack(title, 'p12_full', false), PixFont.depack(title, 'b12_full', false), PixFont.depack(title, 'q8_full', true)]; });
const media = jag('media');
// sprite groups the 377 client loads (Client.load): name, count, 8-bit or 32-bit
const sprites: [string, number, 8 | 32][] = [['invback', 1, 8], ['chatback', 1, 8], ['mapback', 1, 8], ['backbase1', 1, 8], ['backbase2', 1, 8], ['backhmid1', 1, 8], ['sideicons', 13, 8], ['compass', 1, 32], ['mapedge', 1, 32], ['mapscene', 72, 8], ['mapfunction', 70, 32], ['hitmarks', 5, 32], ['headicons_pk', 6, 32], ['headicons_prayer', 9, 32], ['headicons_hint', 6, 32], ['overlay_multiway', 1, 32], ['mapmarker', 2, 32], ['cross', 8, 32], ['mapdots', 5, 32], ['scrollbar', 2, 8], ['redstone1', 1, 8], ['redstone2', 1, 8], ['redstone3', 1, 8], ['mod_icons', 2, 8], ['backleft1', 1, 32], ['backleft2', 1, 32], ['backright1', 1, 32], ['backright2', 1, 32], ['backtop1', 1, 32], ['backvmid1', 1, 32], ['backvmid2', 1, 32], ['backvmid3', 1, 32], ['backhmid2', 1, 32]];
step('2d graphics', () => {
    for (const [name, count, bits] of sprites) for (let i = 0; i < count; i++) {
        try { bits === 8 ? Pix8.depack(media, name, i) : Pix32.depack(media, name, i); } catch (e) { problems++; log(`  ! sprite ${name} ${i}: ${e}`); break; }
    }
});
step('textures', () => Pix3D.unpackTextures(jag('textures')));
step('sounds', () => JagFX.init(new Packet(jag('sounds').read('sounds.dat')!)));
step('chat filter', () => WordFilter.unpack(jag('wordenc')));
step('interfaces', () => IfType.init(jag('interface'), media, fonts));

console.log = log;
log(problems ? `${problems} problem(s)` : 'all game data decodes');
process.exit(problems ? 1 : 0);
