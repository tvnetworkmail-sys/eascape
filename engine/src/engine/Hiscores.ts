// EASCape: the hiscores the app's Hiscore panel shows (GET /hiscores/player/:name on the web
// server). Built from the player saves (data/players/<profile>/*.sav), with the live stats of
// anyone online, so it works with or without the login server's database. Ranks follow Lost
// City's hiscores (LoginServer.updateHiscores): a skill is ranked from level 15, the overall by
// total level then total XP, and staff (staffmodlevel > 1) and banned accounts are left out when
// the login server's account table is there. Ours: Slayer and Farming are ranked too (Lost City
// leaves them out, PlayerStatEnabled; EASCape has both skills).
import fs from 'fs';
import path from 'path';

import NpcType from '#/cache/config/NpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import Packet from '#/io/Packet.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';

export const SKILLS = ['attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecraft'];

const MIN_RANKED_LEVEL = 15;
const REFRESH_MS = 60_000;

// EASCape: Boss kills and NPC kills (your call, 16 Nov 2026). The bosses' counts are their kill
// count vars (content eascape_kc, kept since 19 Oct 2026); Barrows is chests opened. Every other
// NPC is counted by p_npckill in npc_death (from 16 Nov 2026, kept in its own file: KillStore), added up by name.
export const BOSSES = [
    { key: 'dagannoth_rex', name: 'Dagannoth Rex', varp: 'kc_dagannoth_rex', npcs: ['dagcave_melee_boss'] },
    { key: 'dagannoth_prime', name: 'Dagannoth Prime', varp: 'kc_dagannoth_prime', npcs: ['dagcave_magic_boss'] },
    { key: 'dagannoth_supreme', name: 'Dagannoth Supreme', varp: 'kc_dagannoth_supreme', npcs: ['dagcave_ranged_boss'] },
    { key: 'barrows', name: 'Barrows chests', varp: 'kc_barrows_chest', npcs: [] },
    { key: 'kalphite_queen', name: 'Kalphite Queen', varp: 'kc_kalphite_queen', npcs: ['kalphite_queen', 'kalphite_flyingqueen'] },
    { key: 'king_black_dragon', name: 'King Black Dragon', varp: 'kc_king_black_dragon', npcs: ['king_dragon'] },
    { key: 'tztok_jad', name: 'TzTok-Jad', varp: 'kc_tztok_jad', npcs: ['tzhaar_fightcave_swarm_boss'] }
];

// the bosses' NPC types, and anything else with a boss's name (the Kalphite Queen has other copies)
let bossTypes: Set<number> | null = null;
function isBossType(type: number): boolean {
    if (!bossTypes) {
        const ids = BOSSES.flatMap(b => b.npcs.map(n => NpcType.getId(n)).filter(id => id >= 0));
        const bossNames = new Set(ids.map(id => NpcType.get(id)?.name).filter(Boolean));
        bossTypes = new Set(ids);
        for (let id = 0; id < NpcType.count; id++) {
            if (bossNames.has(NpcType.get(id)?.name)) {
                bossTypes.add(id);
            }
        }
    }
    return bossTypes.has(type);
}

// the name an NPC type is counted under ("Goblin" for every goblin), or null when it isn't counted
function npcName(type: number): string | null {
    if (type < 0 || type >= NpcType.count || isBossType(type)) {
        return null;
    }
    const name = NpcType.get(type)?.name;
    return name && name !== 'null' ? name : null;
}

type Entry = { name: string; levels: number[]; xp: number[]; totalLevel: number; totalXp: number; bosses: number[]; kills: Map<string, number>; totalKills: number };

function killsOf(vars: Int32Array | number[], npcKills: Map<number, number>): Pick<Entry, 'bosses' | 'kills' | 'totalKills'> {
    const bosses = BOSSES.map(b => {
        const id = VarPlayerType.getId(b.varp);
        return id >= 0 ? Math.max(0, vars[id] ?? 0) : 0;
    });
    const kills = new Map<string, number>();
    let totalKills = 0;
    for (const [type, n] of npcKills) {
        const name = npcName(type);
        if (!name || n <= 0) {
            continue;
        }
        kills.set(name, (kills.get(name) ?? 0) + n);
        totalKills += n;
    }
    return { bosses, kills, totalKills };
}

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

function entryOf(name: string, stats: number[], baseLevels: number[], vars: Int32Array | number[], npcKills: Map<number, number>): Entry {
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
    return { name, levels, xp, totalLevel, totalXp, ...killsOf(vars, npcKills) };
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
            entries.set(username, entryOf(p.displayName, Array.from(p.stats), Array.from(p.baseLevels), p.vars, p.npcKills));
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
            cache!.entries.set(p.username.toLowerCase(), entryOf(p.displayName, Array.from(p.stats), Array.from(p.baseLevels), p.vars, p.npcKills));
        }
    }
    return cache!;
}

export type KillRank = { rank: number; kills: number };
export type HiscoreResult = {
    name: string;
    overall: { rank: number; level: number; xp: number };
    skills: Record<string, { rank: number; level: number; xp: number }>;
    // EASCape: every boss (rank -1 with no kills), and the NPCs they've killed, most first
    bosses: ({ key: string; name: string } & KillRank)[];
    npcs: { total: KillRank; list: ({ name: string } & KillRank)[] };
};

// the rank of `kills` among everyone's (1 + how many have more); -1 with none
const rankOf = (kills: number, all: number[]) => (kills > 0 ? 1 + all.filter(k => k > kills).length : -1);

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
    const bosses = BOSSES.map((b, i) => ({ key: b.key, name: b.name, kills: me.bosses[i], rank: rankOf(me.bosses[i], others.map(o => o.bosses[i])) }));
    const list = [...me.kills].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, kills]) => ({ name, kills, rank: rankOf(kills, others.map(o => o.kills.get(name) ?? 0)) }));
    const total = { kills: me.totalKills, rank: rankOf(me.totalKills, others.map(o => o.totalKills)) };
    return { name: me.name, overall: { rank: overallRank, level: me.totalLevel, xp: me.totalXp }, skills, bosses, npcs: { total, list } };
}

export type KillTable = { table: string; title: string; rows: { rank: number; name: string; kills: number }[]; total: number };

/** A boss's or an NPC's top killers: table is a boss key, "npc:<name>", or "npc:all" (every NPC
 *  added up). From `rank` (1 up), or around `name` when given; `count` rows. null: no such table. */
export async function killTable(table: string, opts: { rank?: number; name?: string; count?: number } = {}): Promise<KillTable | null> {
    const c = await current();
    let title: string;
    let get: (e: Entry) => number;
    const boss = BOSSES.findIndex(b => b.key === table);
    if (boss >= 0) {
        title = BOSSES[boss].name;
        get = e => e.bosses[boss];
    } else if (table === 'npc:all') {
        title = 'All NPCs';
        get = e => e.totalKills;
    } else if (table.startsWith('npc:') && npcNames().includes(table.slice(4))) {
        const name = table.slice(4);
        title = name;
        get = e => e.kills.get(name) ?? 0;
    } else {
        return null;
    }
    const ranked = [...c.entries.entries()].filter(([k, e]) => !c.excluded.has(k) && get(e) > 0).map(([, e]) => ({ name: e.name, kills: get(e) }));
    ranked.sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
    const rows = ranked.map(r => ({ rank: rankOf(r.kills, ranked.map(x => x.kills)), name: r.name, kills: r.kills }));
    const count = Math.max(1, Math.min(opts.count ?? 25, 100));
    let start = Math.max(0, (opts.rank ?? 1) - 1);
    if (opts.name) {
        const key = opts.name.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
        const at = rows.findIndex(r => r.name.toLowerCase().replace(/[\s_-]+/g, ' ') === key);
        if (at >= 0) {
            start = Math.max(0, at - Math.floor(count / 2));
        }
    }
    return { table, title, rows: rows.slice(start, start + count), total: rows.length };
}

let names: string[] | null = null;
/** Every NPC name that can be fought (has Attack), A to Z, bosses left out: the NPC kills list. */
export function npcNames(): string[] {
    if (!names) {
        const set = new Set<string>();
        for (let id = 0; id < NpcType.count; id++) {
            const t = NpcType.get(id);
            const name = npcName(id);
            if (name && t && t.op && t.op.some(o => o && o.toLowerCase() === 'attack')) {
                set.add(name);
            }
        }
        names = [...set].sort((a, b) => a.localeCompare(b));
    }
    return names;
}

/** The most kills of each NPC and who has them, most first: the NPC kills page's opening list
 *  (and its search, which shows each match's top killer). */
export async function npcRecords(): Promise<{ npc: string; name: string; kills: number }[]> {
    const c = await current();
    const best = new Map<string, { name: string; kills: number }>();
    for (const [k, e] of c.entries) {
        if (c.excluded.has(k)) {
            continue;
        }
        for (const [npc, kills] of e.kills) {
            const b = best.get(npc);
            if (!b || kills > b.kills || (kills === b.kills && e.name.localeCompare(b.name) < 0)) {
                best.set(npc, { name: e.name, kills });
            }
        }
    }
    return [...best].map(([npc, b]) => ({ npc, ...b })).sort((a, b) => b.kills - a.kills || a.npc.localeCompare(b.npc));
}
