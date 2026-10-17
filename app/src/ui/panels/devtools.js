'use strict';
// Developer Tools panel (shown while the Developer Tools plugin is on). Lists the live game
// data LostLite reads: the local player (2.1), run energy / weight / prayer / special
// attack (2.10), the inventory and worn equipment (2.3), and NPCs and players (2.2).
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h } = UI;
  const open = { player: true, inventory: true, equipment: true, npcs: true, players: false, objects: false, chat: false };

  function row(label, value, cls) {
    return h('div.small.dev-row', {}, h('span.muted', { text: label }), h('span', { class: cls || 'white', text: value == null ? '-' : String(value) }));
  }

  function section(key, title, body) {
    const sec = h('div', { class: open[key] ? 'cfg-section' : 'cfg-section closed' },
      h('div.cfg-section-header', {
        onclick: () => {
          open[key] = !open[key];
          sec.classList.toggle('closed', !open[key]);
        },
      }, h('span.arrow', {}, UI.icon('arrow_right.png')), h('span.sname', { text: title })),
      h('div.cfg-section-body', {}, ...body));
    return sec;
  }

  function itemText(it) {
    if (!it) return null;
    return `${it.name || '?'}${it.quantity > 1 ? ` x ${it.quantity.toLocaleString()}` : ''} (${it.id})`;
  }

  function playerRows(p) {
    if (!p) return [h('div.small.muted', { text: 'Waiting for game data...' })];
    const target = p.interacting ? `${p.interacting.type} #${p.interacting.index}` : 'none';
    return [
      row('Name: ', p.name),
      row('Combat level: ', p.combatLevel),
      row('World tile: ', `${p.x}, ${p.y}, ${p.plane}`),
      row('Scene tile: ', `${p.sceneX}, ${p.sceneY}`),
      row('Region: ', p.region),
      row('Animation: ', p.animation),
      row('Moving: ', p.moving ? 'yes' : 'no', p.moving ? 'green' : 'white'),
      row('Hitpoints: ', p.hitpoints != null ? `${p.hitpoints} / ${p.maxHitpoints}` : null),
      row('In combat: ', p.inCombat ? 'yes' : 'no', p.inCombat ? 'red' : 'white'),
      row('Target: ', target),
      row('Run energy: ', `${p.runEnergy}%`),
      row('Weight: ', `${p.weight} kg`),
      row('Prayer: ', p.prayer != null ? `${p.prayer} / ${p.maxPrayer}` : null),
      row('Special attack: ', p.specialAttack != null ? `${p.specialAttack}%${p.specialAttackOn ? ' (on)' : ''}` : null),
    ];
  }

  function inventoryRows(items) {
    if (!items) return [h('div.small.muted', { text: 'Waiting for game data...' })];
    const used = items.inventory.filter(Boolean).length;
    const rows = [row('Slots used: ', `${used} / 28`)];
    items.inventory.forEach((it, i) => { if (it) rows.push(row(`${i}: `, itemText(it))); });
    return rows;
  }

  function equipmentRows(items) {
    if (!items) return [h('div.small.muted', { text: 'Waiting for game data...' })];
    return Object.entries(items.equipment).map(([slot, it]) => row(`${slot[0].toUpperCase()}${slot.slice(1)}: `, itemText(it) || 'empty', it ? 'white' : 'muted'));
  }

  function entityRows(list, total, what) {
    if (!list) return [h('div.small.muted', { text: 'Waiting for game data...' })];
    const rows = [row(`${what} in the scene: `, total)];
    for (const e of list) {
      const target = e.interacting ? ` > ${e.interacting.type} #${e.interacting.index}` : '';
      rows.push(row(`#${e.index}: `, `${e.name || '?'}${e.level ? ` (lvl ${e.level})` : ''}${e.id !== undefined ? ` id ${e.id}` : ''} @ ${e.x}, ${e.y}${e.distance ? ` (${e.distance} tiles)` : ''}${e.animation >= 0 ? ` anim ${e.animation}` : ''}${e.health ? ` hp ${e.health}` : ''}${target}`, e.inCombat ? 'red' : 'white'));
    }
    return rows;
  }

  function chatRows(list) {
    if (!list || !list.length) return [h('div.small.muted', { text: 'No messages yet' })];
    return list.slice().reverse().map((m) => row(`${m.kind}${m.name ? ` ${m.name}` : ''}: `, m.text, m.kind === 'game' ? 'white' : m.kind.startsWith('private') ? 'qh-yellow' : 'green'));
  }

  function objectRows(list) {
    if (!list) return [h('div.small.muted', { text: 'Waiting for game data...' })];
    if (!list.length) return [h('div.small.muted', { text: 'None nearby' })];
    return list.map((o) => row(`${o.kind}: `, `${o.name || '?'} (${o.id}) @ ${o.x}, ${o.y}${o.distance ? ` (${o.distance} tiles)` : ''}`));
  }

  window.Panels.push({
    id: 'devtools',
    tooltip: 'Developer Tools',
    icon: 'devtools_icon.png',
    priority: 1,
    visible: () => App.config('lostlite', 'devtoolsPlugin', false) === true,
    watch: ['player', 'items', 'entities', 'loggedIn', 'chat'],
    render(root) {
      const s = App.state;
      root.replaceChildren(h('div.pad', {},
        h('div.small', { class: s.loggedIn ? 'green' : 'muted', text: s.loggedIn ? 'Logged in - live data' : 'Log in to see game data' }),
        section('player', 'Player', playerRows(s.player)),
        section('inventory', 'Inventory', inventoryRows(s.items)),
        section('equipment', 'Equipment', equipmentRows(s.items)),
        section('npcs', 'NPCs (nearest 30)', entityRows(s.entities && s.entities.npcs, s.entities && s.entities.npcCount, 'NPCs')),
        section('players', 'Players (nearest 30)', entityRows(s.entities && s.entities.players, s.entities && s.entities.playerCount, 'Players')),
        section('objects', 'Objects (nearest 30)', objectRows(s.entities && s.entities.objects)),
        section('chat', 'Chat messages (last 30)', chatRows(s.chat))));
    },
  });
})();
