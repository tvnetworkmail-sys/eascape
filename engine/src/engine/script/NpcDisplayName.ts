import NpcType from '#/cache/config/NpcType.js';
import ScriptState from '#/engine/script/ScriptState.js';

// EASCape: the name a player sees for an npc type. Many quest npcs are multinpcs whose base type has
// no name (Elena in Plague City, Reldo, the Feud bandits...); the client shows the variant's name,
// but npc_name gave "null" and nc_name the debug name ("elena2") in dialogue. Resolve the variant
// for the active player, else the first named variant.
export function npcDisplayName(state: ScriptState, type: NpcType): string | null {
    if (type.name) return type.name;
    if (!type.multinpc || !type.multinpc.length) return null;
    let player: any = null;
    try { player = state.activePlayer; } catch (_) { player = null; }
    if (player) {
        let v = -1;
        try {
            v = type.multivarp !== -1 ? (player.getVar(type.multivarp) as number) : type.multivarbit !== -1 ? player.getVarBit(type.multivarbit) : -1;
        } catch (_) { v = -1; }
        if (v >= 0 && v < type.multinpc.length && type.multinpc[v] !== -1) {
            const t = NpcType.get(type.multinpc[v]);
            if (t.name) return t.name;
        }
    }
    for (const id of type.multinpc) if (id !== -1 && NpcType.get(id).name) return NpcType.get(id).name;
    return null;
}
