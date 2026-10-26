// EASCape: after packing, every model and map file must match the checksum the versionlist tells
// the client. If one doesn't, the client rejects that file as corrupt and keeps asking for it: the
// map square never loads and the model queue stalls (the Warriors' Guild update showed a missing
// guild and an invisible player). If anything is off, the versionlist is rebuilt from the files
// actually on disk, and the server refuses to start if they still disagree.
import fs from 'fs';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import FileStream from '#/io/FileStream.js';
import { printWarning } from '#/util/Logger.js';
import { packAll } from '#tools/pack/PackAll.js';

const VERSIONLIST = 'data/pack/client/versionlist';

// how many model and map files disagree with the versionlist's checksums
export function verifyPackedCache(): number {
    if (!fs.existsSync(VERSIONLIST) || !fs.existsSync('data/pack/main_file_cache.dat')) {
        return -1;
    }
    const jag = Jagfile.load(VERSIONLIST);
    const cache = new FileStream('data/pack', false, true);
    let bad = 0;
    try {
        for (const [archive, name] of [[1, 'model'], [4, 'map']] as const) {
            const crcs = jag.read(name + '_crc');
            if (!crcs) {
                return -1;
            }
            const count = crcs.data.length / 4;
            for (let file = 0; file < count; file++) {
                const expected = crcs.g4() >>> 0;
                const data = cache.read(archive, file, false);
                if (!data || data.length < 2) {
                    if (expected !== 0) bad++;
                    continue;
                }
                if (Packet.getcrc(data, 0, data.length - 2) >>> 0 !== expected) {
                    bad++;
                }
            }
        }
    } finally {
        cache.close();
    }
    return bad;
}

export async function packAllChecked(modelFlags: number[]) {
    await packAll(modelFlags);
    const bad = verifyPackedCache();
    if (bad === 0) {
        return;
    }
    printWarning(`${bad < 0 ? 'The versionlist is missing' : bad + ' packed files disagree with the versionlist'}; rebuilding it from the packed files.`);
    fs.rmSync(VERSIONLIST, { force: true });
    await packAll(modelFlags);
    const still = verifyPackedCache();
    if (still !== 0) {
        throw new Error(`The packed game files still disagree with the versionlist (${still}). Delete engine/data/pack and start again.`);
    }
}
