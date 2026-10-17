'use strict';
// Port of RuneLite's InfoPanel: version box, then link panels.
/* global UI, App */
window.Panels = window.Panels || [];

(() => {
  const { h, icon } = UI;
  const ISSUES = 'https://github.com/tvnetworkmail-sys/lostlite/issues';
  const SITE = 'https://2004.lostcity.rs/';

  function line(label, value, cls) {
    return h('div.small', {}, h('span.muted', { text: label }), h('span', { class: cls || 'white', text: value }));
  }

  function linkPanel(img, top, bottom, onclick) {
    return h('div.link-panel', { onclick, role: 'button', tabindex: '0' },
      icon(img),
      h('div.lp-text', {}, h('div.small.white', { text: top }), h('div.small.muted', { text: bottom })),
      icon('arrow_right.png', { class: 'lp-arrow' }));
  }

  function updateLine(u) {
    if (!u) return null;
    switch (u.state) {
      case 'checking': return line('Updates: ', 'checking...', 'muted');
      case 'current': return line('Updates: ', 'up to date', 'green');
      case 'downloading': return line('Updates: ', `downloading ${u.version || ''} ${u.percent ? u.percent + '%' : ''}`, 'amber');
      case 'ready': return null;
      case 'portable': return line('Updates: ', 'manual (portable version)', 'muted');
      case 'error': return line('Updates: ', 'check failed', 'muted');
      default: return null;
    }
  }

  window.Panels.push({
    id: 'info',
    tooltip: 'Info',
    icon: 'info_icon.png',
    priority: 9,
    watch: ['world', 'client', 'hooked', 'loggedIn', 'update', 'stats'],
    render(root) {
      const s = App.state;
      const c = s.client;
      const hook = !c ? ['loading...', 'amber'] : c.type === 'client-patched' ? ['connected', 'green'] : ['failed', 'red'];
      const f = c && c.features;
      const zoom = f ? (f.zoom ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const draw = f ? (f.drawDistance ? [`${f.drawDistance} tiles`, f.drawDistance > 25 ? 'green' : 'white'] : ['unavailable', 'red']) : null;
      const rotate = f ? (f.rotate ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const menu = f ? (f.menu ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const bank = f ? (f.bank && f.chat ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const overlay = f ? (f.overlay ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const esc = f ? (f.chat ? ['available', 'green'] : ['unavailable', 'red']) : null;
      const u = s.update;
      root.replaceChildren(h('div.pad', {},
        h('div.info-version', {},
          line('EASCape version: ', s.version),
          line('Lost City revision: ', '274'),
          line('World: ', s.world != null ? String(s.world) : '-'),
          line('Client hook: ', hook[0], hook[1]),
          zoom ? line('Camera zoom: ', zoom[0], zoom[1]) : null,
          rotate ? line('Mouse camera: ', rotate[0], rotate[1]) : null,
          draw ? line('Draw distance: ', draw[0], draw[1]) : null,
          menu ? line('Menu swaps: ', menu[0], menu[1]) : null,
          bank ? line('Bank search: ', bank[0], bank[1]) : null,
          esc ? line('Esc to close: ', esc[0], esc[1]) : null,
          overlay ? line('Overlays: ', overlay[0], overlay[1]) : null,
          line('Logged in: ', s.loggedIn ? 'yes' : 'no', s.loggedIn ? 'green' : 'muted'),
          updateLine(u),
          c && c.type === 'client-patch-failed' ? h('div.small.red', { text: c.error, style: 'margin-top:6px' }) : null),
        u && u.state === 'ready'
          ? h('button.btn.block', { style: 'margin-top:10px', onclick: () => window.lostlite.installUpdate() }, `Restart to update to ${u.version}`)
          : null,
        linkPanel('github_icon.png', 'Report an issue or', 'make a suggestion', () => window.lostlite.openExternal(ISSUES)),
        linkPanel('worldhopper_icon.png', 'Visit the Lost City', 'website and forums', () => window.lostlite.openExternal(SITE)),
        linkPanel('config_edit_icon.png', 'Open the folder with', 'EASCape\'s log files', () => window.lostlite.openLogs()),
        linkPanel('reset.png', 'Reload the game', 'if something looks stuck', () => window.lostlite.reloadGame())));
    },
  });
})();
