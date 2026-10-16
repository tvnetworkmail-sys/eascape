import Packet from '#/io/Packet.js';

// 377: each op message writes its fields in its own order and byte transform (as the
// 377 server's decoders read them).

export function writeOpObj(o: Packet, op: number, x: number, z: number, obj: number): void {
    if (op === 1) { o.p2_alt2(x); o.p2(z); o.p2_alt3(obj); }
    else if (op === 2) { o.p2(x); o.p2_alt2(z); o.p2_alt3(obj); }
    else if (op === 3) { o.p2_alt3(obj); o.p2_alt3(x); o.p2_alt2(z); }
    else if (op === 4) { o.p2_alt2(obj); o.p2_alt1(z); o.p2(x); }
    else { o.p2_alt1(obj); o.p2_alt2(x); o.p2(z); }
}

export function writeOpLoc(o: Packet, op: number, x: number, z: number, loc: number): void {
    if (op === 1) { o.p2_alt2(x); o.p2_alt1(z); o.p2_alt1(loc); }
    else if (op === 2) { o.p2(loc); o.p2(x); o.p2_alt2(z); }
    else if (op === 3) { o.p2_alt2(z); o.p2_alt1(loc); o.p2_alt3(x); }
    else if (op === 4) { o.p2(x); o.p2_alt1(z); o.p2(loc); }
    else { o.p2_alt1(loc); o.p2_alt1(z); o.p2(x); }
}

export function writeOpNpc(o: Packet, op: number, slot: number): void {
    if (op === 1 || op === 4 || op === 5) o.p2_alt1(slot);
    else if (op === 2) o.p2_alt2(slot);
    else o.p2_alt3(slot);
}

export function writeOpPlayer(o: Packet, op: number, slot: number): void {
    if (op === 1) o.p2_alt3(slot);
    else if (op === 2 || op === 5) o.p2_alt2(slot);
    else o.p2_alt1(slot);
}

export function writeOpHeld(o: Packet, op: number, obj: number, slot: number, com: number): void {
    if (op === 1) { o.p2_alt2(com); o.p2_alt1(slot); o.p2_alt1(obj); }
    else if (op === 2) { o.p2_alt1(com); o.p2_alt1(obj); o.p2_alt2(slot); }
    else if (op === 3) { o.p2_alt3(slot); o.p2_alt3(obj); o.p2_alt1(com); }
    else if (op === 4) { o.p2_alt1(slot); o.p2_alt2(obj); o.p2(com); }
    else { o.p2_alt1(slot); o.p2_alt3(obj); o.p2_alt3(com); }
}

export function writeInvButton(o: Packet, op: number, obj: number, slot: number, com: number): void {
    if (op === 1) { o.p2_alt2(obj); o.p2(com); o.p2(slot); }
    else if (op === 2) { o.p2_alt2(slot); o.p2_alt1(obj); o.p2_alt1(com); }
    else if (op === 3) { o.p2_alt1(obj); o.p2_alt3(slot); o.p2(com); }
    else if (op === 4) { o.p2_alt3(com); o.p2_alt1(slot); o.p2(obj); }
    else { o.p2_alt3(slot); o.p2_alt3(obj); o.p2_alt1(com); }
}
