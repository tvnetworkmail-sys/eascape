// EASCape (ours): screenshots of suspected bots, for the website's staff pages.
//
// When the bot watch flags a player (BotWatch.flag), or staff ask with ::botshot, the game asks
// that player's client for a picture of its game screen. The ask goes in a game message ending in
// ":botshot:" (like the game's own ":tradereq:"), which the client never shows: it takes a JPEG
// of its canvas and posts it to /botshot/<token> on this server (web.ts). The token is single use
// and only lasts a minute.
//
// The picture is written where the website looks (eascape-live's engine/src/botshots.ts):
//   data/bot-screenshots/<account id>/<YYYYMMDD-HHMMSS>-<reason>.jpg   (time in UTC)
// <reason> is the bot watch's signal (streak, pixel, timing, noclicks, nonstop) or "staff".
// Without a login server (a local test server) there are no account ids, so the folder is the
// username instead (the website skips those).

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import World from '#/engine/World.js';

import type Player from '#/engine/entity/Player.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

import Environment from '#/util/Environment.js';

const TOKEN_MS = 60_000; // the client has a minute to answer
const AUTO_GAP_MS = 10 * 60_000; // at most one automatic screenshot per player every 10 minutes
export const MAX_SHOT_BYTES = 2 * 1024 * 1024;

type Pending = { username: string; folder: string; reason: string; expires: number };

const pending = new Map<string, Pending>();
const lastAuto = new Map<string, number>();

function folderFor(player: Player): string {
    if (Environment.LOGIN_SERVER && player.accountId > 0) {
        return String(player.accountId);
    }
    return player.username.replace(/[^a-z0-9_-]/gi, '_');
}

// ask the player's client for a screenshot; false if it wasn't asked (too soon for an automatic one)
export function requestBotShot(player: Player, reason: string, staff = false): boolean {
    const now = Date.now();
    if (!staff) {
        const last = lastAuto.get(player.username);
        if (last !== undefined && now - last < AUTO_GAP_MS) {
            return false;
        }
        lastAuto.set(player.username, now);
    }

    for (const [t, p] of pending) {
        if (p.expires < now) pending.delete(t);
    }

    const token = crypto.randomBytes(16).toString('hex');
    pending.set(token, { username: player.username, folder: folderFor(player), reason: reason.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'staff', expires: now + TOKEN_MS });
    player.messageGame(`${token}:botshot:`);
    return true;
}

function stamp(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

// the client's answer (web.ts): true if it was saved
export function receiveBotShot(token: string, data: Buffer): boolean {
    const p = pending.get(token);
    if (!p) {
        return false;
    }
    pending.delete(token);
    if (p.expires < Date.now() || data.length < 4 || data.length > MAX_SHOT_BYTES) {
        return false;
    }
    // JPEG only
    if (data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
        return false;
    }

    const dir = path.join('data', 'bot-screenshots', p.folder);
    const file = `${stamp(new Date())}-${p.reason}.jpg`;
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, file), data);
    } catch (err) {
        console.error('bot screenshot not saved', err);
        return false;
    }

    const player = World.getPlayerByUsername(p.username);
    player?.addSessionLog(LoggerEventType.MODERATOR, `Bot check: screenshot taken (${p.reason}), ${file}`);
    return true;
}
