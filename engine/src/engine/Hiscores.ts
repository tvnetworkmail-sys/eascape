// EASCape: the hiscores the app's Hiscore panel shows (GET /hiscores/player/:name on the web
// server). Built from the player saves (data/players/<profile>/*.sav), with the live stats of
// anyone online, so it works with or without the login server's database. Ranks follow Lost
// City's hiscores (LoginServer.updateHiscores): a skill is ranked from level 15, the overall by
// total level then total XP, and staff (staffmodlevel > 1) and banned accounts are left out when
// the login server's account table is there. Ours: Slayer and Farming are ranked too (Lost City
// leaves them out, PlayerStatEnabled; EASCape has both skills).
import fs from 'fs';
import path from 'path';

import Packet from '#/io/Packet.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';

export const SKILLS = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft'];

const MIN_RANKED_LEVEL = 15;
const REFRESH_MS = 60_000;

type Entry = { name: string; levels: number[]; xp: number[]; totalLevel: number; totalXp: number };

let cache: { at: number; entries: Map<string, Entry>; excluded: Set<string> } | null = null;
let building: Promise<void> | null = null;

async function excludedAccounts(): Promise<Set<string>> {
    const out = new Set<string>();
    if (!Environment.LOGIN_SERVER) {
        return out;
    }
    try {
        const { db } = await import('#/db/query.js');
        const rows = await db.selectFrom('account').select(['username', 'staffmodlevel', 'banned_until']).execute();
        const now = new Date();
        for (const r of rows) {
            if (r.staffmodlevel > 1 || (r.banned_until !== null && new Date(r.banned_until) >= now)) {
                out.add(String(r.username).toLowerCase());
            }
        }
    } catch {
        // no database here: everyone is shown
    }
    return out;
}

function entryOf(name: string, stats: number[], baseLevels: number[]): Entry {
    const levels: number[] = [];
    const xp: number[] = [];
    let totalLevel = 0;
    let totalXp = 0;
    for (let i = 0; i < SKILLS.length; i++) {
        const l = baseLevels[i] ?? 1;
        const x = Math.floor((stats[i] ?? 0) / 10);
        levels.push(l);
        xp.push(x);
        totalLevel += l;
        totalXp += x;
    }
    return { name, levels, xp, totalLevel, totalXp };
}

async function build(): Promise<void> {
    const dir = path.join('data', 'players', Environment.NODE_PROFILE);
    const entries = new Map<string, Entry>();
    let files: string[] = [];
    try {
        files = await fs.promises.readdir(dir);
    } catch {
        files = [];
    }
    for (const f of files) {
        if (!f.endsWith('.sav')) {
            continue;
        }
        const username = f.slice(0, -4).toLowerCase();
        try {
            const raw = await fs.promises.readFile(path.join(dir, f));
            const p = PlayerLoading.load(username, new Packet(new Uint8Array(raw)), null);
            entries.set(username, entryOf(p.displayName, Array.from(p.stats), Array.from(p.baseLevels)));
        } catch {
            // an unreadable save: left out
        }
    }
    cache = { at: Date.now(), entries, excluded: await excludedAccounts() };
}

async function current(): Promise<NonNullable<typeof cache>> {
    if (!cache || Date.now() - cache.at > REFRESH_MS) {
        if (!building) {
            building = build().finally(() => (building = null));
        }
        await building;
    }
    // anyone online counts with their live stats
    for (const p of World.players) {
        if (p) {
            cache!.entries.set(p.username.toLowerCase(), entryOf(p.displayName, Array.from(p.stats), Array.from(p.baseLevels)));
        }
    }
    return cache!;
}

export type HiscoreResult = {
    name: string;
    overall: { rank: number; level: number; xp: number };
    skills: Record<string, { rank: number; level: number; xp: number }>;
};

/** null: no such player (or one left off the hiscores) */
export async function lookup(name: string): Promise<HiscoreResult | null> {
    const key = String(name || '').toLowerCase().replace(/[\s-]+/g, '_').trim();
    if (!key) {
        return null;
    }
    const c = await current();
    const me = c.entries.get(key);
    if (!me || c.excluded.has(key)) {
        return null;
    }
    const others = [...c.entries.entries()].filter(([k]) => !c.excluded.has(k)).map(([, e]) => e);
    const skills: HiscoreResult['skills'] = {};
    for (let i = 0; i < SKILLS.length; i++) {
        let rank = -1;
        if (me.levels[i] >= MIN_RANKED_LEVEL) {
            rank = 1 + others.filter((o) => o !== me && o.levels[i] >= MIN_RANKED_LEVEL && o.xp[i] > me.xp[i]).length;
        }
        skills[SKILLS[i]] = { rank, level: me.levels[i], xp: me.xp[i] };
    }
    const overallRank = 1 + others.filter((o) => o !== me && (o.totalLevel > me.totalLevel || (o.totalLevel === me.totalLevel && o.totalXp > me.totalXp))).length;
    return { name: me.name, overall: { rank: overallRank, level: me.totalLevel, xp: me.totalXp }, skills };
}
