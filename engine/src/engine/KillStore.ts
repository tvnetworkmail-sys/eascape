import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

// EASCape: each player's NPC kills (p_npckill, for the hiscores) live in their own file,
// data/players/<profile>/kills/<username>.json, not in the save, as on live (your call, 16 Nov
// 2026: new player data goes in its own file, never the save, so live can always roll back). The
// save format doesn't change, so any older game still reads every save, and a rollback keeps every
// kill (an older game just doesn't count new ones). Written with the save (autosave and logout)
// when the kills changed; read at load.

function file(username: string): string {
    return path.join('data', 'players', Environment.NODE_PROFILE, 'kills', `${username}.json`);
}

export function readKills(username: string): Map<number, number> {
    const kills = new Map<number, number>();
    try {
        const raw = JSON.parse(fs.readFileSync(file(username), 'utf8')) as Record<string, unknown>;
        for (const [type, n] of Object.entries(raw)) {
            const t = Number(type);
            const count = Number(n);
            if (Number.isInteger(t) && t >= 0 && t < 65536 && Number.isInteger(count) && count > 0) {
                kills.set(t, Math.min(count, 0x7fffffff));
            }
        }
    } catch {
        // no kills yet (or an unreadable file: starts again rather than stopping the login)
    }
    return kills;
}

export function writeKills(username: string, kills: Map<number, number>): void {
    try {
        const f = file(username);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        const out: Record<string, number> = {};
        for (const [type, n] of kills) {
            if (n > 0) out[type] = n;
        }
        // a whole new file, then a rename: a crash mid-write never leaves a half-written one
        const tmp = `${f}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(out));
        fs.renameSync(tmp, f);
    } catch (err) {
        console.error('kills:', username, err);
    }
}
