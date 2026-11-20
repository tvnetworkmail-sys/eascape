// EASCape: in-game bot detection. Watches what each player does and how their mouse clicks
// arrive, and when something looks scripted it writes a "Bot check:" line to the player's
// session log (the website's staff pages can list and score those) and switches on full input
// recording for them, as a macro report already does (World.notifyPlayerReport). It only ever
// flags: nothing here bans, mutes, kicks or changes the game for the player.
//
// What it looks at, all in memory and cheap enough for every tick:
// - the same action over and over without anything else in between (auto-alching, auto-clicking
//   one fishing spot or furnace), and how long that run has lasted
// - the client's own click timing (EVENT_MOUSE_CLICK sends the time since the last click, in
//   50ms steps): autoclickers are far more even than people
// - the exact pixel of each click: a script or autoclicker hits the same pixel again and again
// - in-game actions that arrive with no mouse clicks at all (packet bots, injected input)
// - hours of non-stop activity

import Component from '#/cache/config/Component.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';

import World from '#/engine/World.js';

import type Player from '#/engine/entity/Player.js';

import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import IfButton from '#/network/game/client/model/IfButton.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import MoveClick from '#/network/game/client/model/MoveClick.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';
import OpHeldT from '#/network/game/client/model/OpHeldT.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';
import OpLocT from '#/network/game/client/model/OpLocT.js';
import OpLocU from '#/network/game/client/model/OpLocU.js';
import OpNpc from '#/network/game/client/model/OpNpc.js';
import OpNpcT from '#/network/game/client/model/OpNpcT.js';
import OpNpcU from '#/network/game/client/model/OpNpcU.js';
import OpObj from '#/network/game/client/model/OpObj.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

// thresholds (ticks are 0.6s)
const STREAK_MIN = 600; // the same action this many times in a row...
const STREAK_MIN_TICKS = 3000; // ...over at least 30 minutes
const CLICK_WINDOW = 200; // the last 200 clicks are kept
const PIXEL_SHARE = 0.5; // half of them on one exact pixel
const CLICK_CV = 0.08; // clicks spaced with less spread than this (people are usually 0.25 or more)
const NOCLICK_WINDOW_TICKS = 1000; // 10 minutes
const NOCLICK_ACTIONS = 100; // this many actions in 10 minutes with no clicks at all
const BREAK_TICKS = 500; // 5 minutes without an action is a break
const NONSTOP_TICKS = 36000; // 6 hours without a break
const REFLAG_TICKS = 6000; // the same signal is logged again at most once an hour

export type BotSignal = 'streak' | 'pixel' | 'timing' | 'noclicks' | 'nonstop';

const POINTS: Record<BotSignal, number> = { streak: 15, pixel: 25, timing: 30, noclicks: 40, nonstop: 15 };

function objName(id: number): string {
    return id >= 0 && id < ObjType.count ? (ObjType.get(id).name ?? ObjType.get(id).debugname ?? `obj ${id}`) : `obj ${id}`;
}

function comName(id: number): string {
    return Component.get(id)?.comName ?? `com ${id}`;
}

// a short readable name for an action, the same every time it's repeated
export function describeAction(message: ClientGameMessage): string | null {
    if (message instanceof OpHeldT) return `${comName(message.spellCom)} on ${objName(message.obj)}`;
    if (message instanceof OpHeld) return `op${message.op} ${objName(message.obj)}`;
    if (message instanceof OpHeldU) return `${objName(message.useObj)} on ${objName(message.obj)}`;
    if (message instanceof InvButton) return `${comName(message.com)} op${message.op} ${objName(message.obj)}`;
    if (message instanceof IfButton) return comName(message.com);
    if (message instanceof OpLoc) return `op${message.op} ${LocType.get(message.loc)?.name ?? `loc ${message.loc}`}`;
    if (message instanceof OpLocT) return `${comName(message.spellCom)} on ${LocType.get(message.loc)?.name ?? `loc ${message.loc}`}`;
    if (message instanceof OpLocU) return `${objName(message.useObj)} on ${LocType.get(message.loc)?.name ?? `loc ${message.loc}`}`;
    if (message instanceof OpObj) return `op${message.op} ground ${objName(message.obj)}`;
    if (message instanceof OpNpc || message instanceof OpNpcT || message instanceof OpNpcU) {
        const npc = World.getNpc(message.npcSlot);
        const name = npc ? (NpcType.get(npc.type).name ?? `npc ${npc.type}`) : 'an npc';
        if (message instanceof OpNpc) return `op${message.op} ${name}`;
        if (message instanceof OpNpcT) return `${comName(message.spellCom)} on ${name}`;
        return `${objName(message.useObj)} on ${name}`;
    }
    if (message instanceof OpPlayer) return `op${message.op} a player`;
    if (message instanceof MoveClick) return 'walk';
    return null;
}

const fmt = (v: number) => Math.round(v).toLocaleString('en-GB');
const pct = (v: number) => `${Math.round(v * 100)}%`;
function hm(ticks: number) {
    const m = Math.round((ticks * 0.6) / 60);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export default class BotWatch {
    private readonly player: Player;

    // the current run of one repeated action
    private streakAction: string | null = null;
    private streakCount = 0;
    private streakStart = -1;
    private lastActionTick = -1;
    private activeSince = -1;

    // the last CLICK_WINDOW clicks: screen pixel and the client's time since the click before
    private clickPos: number[] = [];
    private clickDelta: number[] = [];
    private clicksTotal = 0;
    private moves = 0;

    // actions and clicks in the current 10-minute window
    private windowStart = -1;
    private windowActions = 0;
    private windowClicks = 0;

    private lastFlag: Map<BotSignal, number> = new Map();
    private flagged: Map<BotSignal, string> = new Map();

    constructor(player: Player) {
        this.player = player;
    }

    action(message: ClientGameMessage): void {
        const tick = World.currentTick;
        if (tick === this.lastActionTick && message instanceof MoveClick) {
            return; // the walk sent with an op click is part of that click
        }

        if (this.lastActionTick === -1 || tick - this.lastActionTick > BREAK_TICKS) {
            this.activeSince = tick;
        }
        this.lastActionTick = tick;

        if (this.windowStart === -1) {
            this.windowStart = tick;
        }
        this.windowActions++;

        const name = describeAction(message);
        if (name !== null && name !== 'walk') {
            if (name === this.streakAction) {
                this.streakCount++;
            } else {
                this.streakAction = name;
                this.streakCount = 1;
                this.streakStart = tick;
            }
        } else if (name === 'walk') {
            this.streakAction = null;
            this.streakCount = 0;
        }

        this.check(tick);
    }

    click(info: number): void {
        const delta = info >>> 20;
        const pos = info & 0x7ffff;
        this.clickPos.push(pos);
        this.clickDelta.push(delta);
        if (this.clickPos.length > CLICK_WINDOW) {
            this.clickPos.shift();
            this.clickDelta.shift();
        }
        this.clicksTotal++;
        this.windowClicks++;
    }

    mouseMove(): void {
        this.moves++;
    }

    private check(tick: number): void {
        // same action over and over
        if (this.streakAction && this.streakCount >= STREAK_MIN && tick - this.streakStart >= STREAK_MIN_TICKS) {
            this.flag(tick, 'streak', `the same action ${fmt(this.streakCount)} times in a row with nothing else in between, over ${hm(tick - this.streakStart)} ("${this.streakAction}")`);
        }

        // clicks: one pixel, and the spacing between them
        if (this.clickPos.length >= CLICK_WINDOW) {
            const top = this.topPixel();
            if (top.share >= PIXEL_SHARE) {
                const x = top.pos % 765;
                const y = Math.floor(top.pos / 765);
                this.flag(tick, 'pixel', `${pct(top.share)} of the last ${CLICK_WINDOW} clicks were on one exact pixel (${x}, ${y})`);
            }
            const t = this.clickTiming();
            if (t && t.cv <= CLICK_CV) {
                this.flag(tick, 'timing', `the last ${t.n} clicks came ${(t.mean * 0.05).toFixed(2)}s apart with a spread of only ${pct(t.cv)} (people: 25% or more)`);
            }
        }

        // actions without any clicks
        if (tick - this.windowStart >= NOCLICK_WINDOW_TICKS) {
            if (this.windowActions >= NOCLICK_ACTIONS && this.windowClicks === 0) {
                this.flag(tick, 'noclicks', `${fmt(this.windowActions)} actions in ${hm(tick - this.windowStart)} with no mouse clicks from the game window at all`);
            }
            this.windowStart = tick;
            this.windowActions = 0;
            this.windowClicks = 0;
        }

        // hours without a break
        if (this.activeSince !== -1 && tick - this.activeSince >= NONSTOP_TICKS) {
            this.flag(tick, 'nonstop', `active for ${hm(tick - this.activeSince)} without a 5-minute break`);
        }
    }

    private topPixel(): { pos: number; share: number } {
        const counts = new Map<number, number>();
        let best = -1;
        let bestN = 0;
        for (const p of this.clickPos) {
            const n = (counts.get(p) ?? 0) + 1;
            counts.set(p, n);
            if (n > bestN) {
                bestN = n;
                best = p;
            }
        }
        return { pos: best, share: this.clickPos.length ? bestN / this.clickPos.length : 0 };
    }

    // a gap of 2047+ steps (the client's cap is 4095) is a pause, not part of the rhythm
    private clickTiming(): { n: number; mean: number; cv: number } | null {
        const gaps = this.clickDelta.filter(d => d > 0 && d < 2047);
        if (gaps.length < CLICK_WINDOW / 2) {
            return null;
        }
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gaps.length;
        return mean > 0 ? { n: gaps.length, mean, cv: Math.sqrt(variance) / mean } : null;
    }

    private flag(tick: number, signal: BotSignal, text: string): void {
        const last = this.lastFlag.get(signal);
        if (last !== undefined && tick - last < REFLAG_TICKS) {
            return;
        }
        this.lastFlag.set(signal, tick);
        this.flagged.set(signal, text);

        const score = [...this.flagged.keys()].reduce((sum, s) => sum + POINTS[s], 0);
        this.player.addSessionLog(LoggerEventType.MODERATOR, `Bot check: ${signal} (+${POINTS[signal]}, ${score} this session): suspected, ${text}`);
        // record their mouse and camera in full from now on, for staff to look at
        this.player.input.active = true;
    }

    // for the ::botcheck staff command
    summary(): string[] {
        const tick = World.currentTick;
        const lines: string[] = [];
        lines.push(this.streakAction ? `Doing: "${this.streakAction}" ${fmt(this.streakCount)} times in a row (${hm(tick - this.streakStart)})` : 'Doing: nothing repeated');
        lines.push(this.activeSince !== -1 && this.lastActionTick !== -1 && tick - this.lastActionTick <= BREAK_TICKS ? `Active for ${hm(tick - this.activeSince)} without a break` : 'Not active right now');
        if (this.clickPos.length) {
            const top = this.topPixel();
            const t = this.clickTiming();
            lines.push(`Clicks: ${fmt(this.clicksTotal)} this session, ${fmt(this.moves)} mouse moves`);
            lines.push(`Last ${this.clickPos.length}: top pixel ${pct(top.share)}${t ? `, ${(t.mean * 0.05).toFixed(2)}s apart, spread ${pct(t.cv)}` : ''}`);
        } else {
            lines.push(`Clicks: none this session (${fmt(this.moves)} mouse movement packets)`);
        }
        if (this.flagged.size) {
            const score = [...this.flagged.keys()].reduce((sum, s) => sum + POINTS[s], 0);
            lines.push(`Flagged this session (score ${score}): ${[...this.flagged.keys()].join(', ')}`);
            for (const [s, text] of this.flagged) {
                // the chatbox fits about 80 characters a line
                const words = `- ${s}: ${text}`.split(' ');
                let line = '';
                for (const w of words) {
                    if (line && line.length + w.length + 1 > 78) {
                        lines.push(line);
                        line = '  ' + w;
                    } else {
                        line = line ? `${line} ${w}` : w;
                    }
                }
                if (line) lines.push(line);
            }
        } else {
            lines.push('Not flagged this session');
        }
        lines.push(`Input recording: ${this.player.input.active ? 'on' : 'off'}`);
        return lines;
    }
}
